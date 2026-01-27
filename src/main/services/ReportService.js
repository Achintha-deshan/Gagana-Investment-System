import db from '../config/db.js';

class ReportService {
    
    // 1. සාරාංශ දත්ත (Summary Cards සඳහා)
    async getDashboardSummary() {
        try {
            // මුළු හිඟ මුදල (NextDueDate පසු වූ සක්‍රීය ණය වල වාරික එකතුව)
            // සටහන: මෙහිදී සරලව පොලිය පමණක් හෝ සම්පූර්ණ ණය මුදල පෙන්විය හැක. 
            // දැනට සක්‍රීය ණය වල මුළු වටිනාකම මෙහි පෙන්වයි.
            const [arrears] = await db.execute(`
                SELECT SUM(LoanAmount) as totalArrears 
                FROM loans 
                WHERE Status = 'ACTIVE' AND NextDueDate < CURRENT_DATE
            `);

            // අද දින ලැබුණු මුළු ගෙවීම්
            const [todayCollection] = await db.execute(`
                SELECT SUM(PaidAmount) as todayTotal 
                FROM payment_history 
                WHERE DATE(PaymentDate) = CURRENT_DATE
            `);

            // දැනට පවතින සක්‍රීය ණය ගණන
            const [activeLoans] = await db.execute(`
                SELECT COUNT(LoanID) as count 
                FROM loans 
                WHERE Status = 'ACTIVE'
            `);

            return {
                totalArrears: arrears[0].totalArrears || 0,
                todayCollection: todayCollection[0].todayTotal || 0,
                activeLoansCount: activeLoans[0].count || 0
            };
        } catch (error) {
            console.error("Summary Error:", error);
            throw error;
        }
    }

    // 2. හිඟ වාරික වාර්තාව (Arrears Report)
    async getArrearsReport() {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID, 
                    c.CustomerName, 
                    c.CustomerPhone,
                    l.LoanType,
                    l.LoanAmount, 
                    l.NextDueDate,
                    DATEDIFF(CURRENT_DATE, l.NextDueDate) as DelayDays
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE l.Status = 'ACTIVE' AND l.NextDueDate < CURRENT_DATE
                ORDER BY DelayDays DESC
            `);
            return rows;
        } catch (error) {
            console.error("Arrears Report Error:", error);
            throw error;
        }
    }

    // 3. මුදල් එකතු කිරීමේ වාර්තාව (Collection Report)
    async getCollectionReport(startDate, endDate) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    ph.PaymentID,
                    ph.LoanID,
                    c.CustomerName,
                    ph.PaidAmount,
                    ph.PenaltyPaid,
                    ph.InterestPaid,
                    ph.CapitalPaid,
                    ph.PaymentDate
                FROM payment_history ph
                JOIN loans l ON ph.LoanID = l.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE ph.PaymentDate BETWEEN ? AND ?
                ORDER BY ph.PaymentDate DESC
            `, [startDate, endDate]);
            return rows;
        } catch (error) {
            console.error("Collection Report Error:", error);
            throw error;
        }
    }

    // 4. පියවා අවසන් කළ ණය වාර්තාව (Settled Loans)
    async getSettledLoansReport(startDate, endDate) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID,
                    c.CustomerName,
                    l.LoanType,
                    l.LoanAmount,
                    l.LoanDate,
                    l.CreatedAt as SettledAt
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE l.Status = 'CLOSED' AND l.CreatedAt BETWEEN ? AND ?
                ORDER BY l.CreatedAt DESC
            `, [startDate, endDate]);
            return rows;
        } catch (error) {
            console.error("Settled Report Error:", error);
            throw error;
        }
    }

async getLoanAgingData(testDate = null) {
    try {
        // testDate එකක් ආවොත් ඒක ගන්නවා, නැත්නම් අද දිනය (CURDATE) ගන්නවා
        const targetDate = testDate ? `'${testDate}'` : 'CURDATE()';

        const [rows] = await db.execute(`
            SELECT 
                l.LoanID, 
                c.CustomerName, 
                c.CustomerPhone, 
                l.LoanType, 
                l.LoanAmount, 
                l.NextDueDate,
                -- මෙතැන payment_history සහ PaidAmount ලෙස නිවැරදි කර ඇත
                (l.LoanAmount - IFNULL((SELECT SUM(PaidAmount) FROM payment_history WHERE LoanID = l.LoanID), 0)) AS RemainingBalance,
                DATEDIFF(${targetDate}, l.NextDueDate) AS DaysOverdue
            FROM loans l
            JOIN customers c ON l.CustomerID = c.CustomerID
            WHERE l.Status = 'ACTIVE' 
            HAVING DaysOverdue > 0
            ORDER BY DaysOverdue DESC
        `);

        // Summary ගණනය කිරීම
        const summary = { current: 0, days30: 0, days90: 0, over90: 0 };
        
        rows.forEach(loan => {
            const bal = parseFloat(loan.RemainingBalance);
            if (loan.DaysOverdue <= 30) summary.days30 += bal;
            else if (loan.DaysOverdue <= 90) summary.days90 += bal;
            else summary.over90 += bal;
        });

        return { success: true, data: rows, summary: summary };
    } catch (error) {
        console.error("Aging Report Backend Error:", error);
        return { success: false, error: error.message };
    }
}
}

export default new ReportService();