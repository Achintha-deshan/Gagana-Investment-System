import db from '../config/db.js';

class DashboardService {
    async getSuperDashboardStats() {
        try {
            const today = new Date();
            // මේ මාසයේ පළමු සහ අවසන් දින සකසා ගැනීම
            const firstDayOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

            // 1. ACTIVE LOANS: දැනට ලබා දී ඇති මුළු ප්‍රාග්ධනය (Total Out)
            const [capOut] = await db.execute(`
                SELECT SUM(TotalAmount) as total 
                FROM loan_disbursements 
                WHERE DisbursementStatus = 'ACTIVE'
            `);

            // 2. MONTHLY TARGET: මේ මාසයේ Due Date එක යෙදී ඇති ණය වල පොලී එකතුව පමණි
            // NextDueDate එක මේ මාසයේ පළමු දින සහ අවසන් දින අතර තිබිය යුතුය
            const [targetInt] = await db.execute(`
                SELECT SUM(RemainingPrincipal * InterestRate / 100) as expected 
                FROM loan_disbursements 
                WHERE DisbursementStatus = 'ACTIVE' 
                AND NextDueDate BETWEEN ? AND ?
            `, [firstDayOfMonth, lastDayOfMonth]);

            // 3. RECEIVED INTEREST: මේ මාසය තුළදී පාරිභෝගිකයන් විසින් ගෙවා ඇති මුළු පොලිය
            const [receivedInt] = await db.execute(`
                SELECT SUM(InterestPaid) as got 
                FROM payment_history 
                WHERE PaymentDate BETWEEN ? AND ? AND IsVoided = 0
            `, [firstDayOfMonth, lastDayOfMonth]);

            // 4. RISK ALERT: Blacklisted පාරිභෝගිකයින් ගණන
            const [blacklisted] = await db.execute(`
                SELECT COUNT(*) as count 
                FROM customers 
                WHERE IsBlacklisted = 1
            `);

            // 5. මුළු පාරිභෝගිකයින් ගණන
            const [totalCust] = await db.execute("SELECT COUNT(*) as count FROM customers");

            // 6. Portfolio Distribution
            const [distribution] = await db.execute(`
                SELECT l.LoanType, COUNT(ld.DisbursementID) as count, SUM(ld.RemainingPrincipal) as totalAmount 
                FROM loans l
                JOIN loan_disbursements ld ON l.LoanID = ld.LoanID
                WHERE ld.DisbursementStatus = 'ACTIVE'
                GROUP BY l.LoanType
            `);

            // 7. මෑතකදී ලබාදුන් ණය 5
            const [recentLoans] = await db.execute(`
                SELECT l.LoanID, c.CustomerName, l.LoanType, ld.TotalAmount as LoanAmount, ld.InterestRate, ld.DisbursedDate as LoanDate 
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID 
                JOIN loan_disbursements ld ON l.LoanID = ld.LoanID
                ORDER BY ld.DisbursementID DESC 
                LIMIT 5
            `);

            return {
                capitalOut: capOut[0].total || 0,
                interestTarget: targetInt[0].expected || 0,
                interestReceived: receivedInt[0].got || 0,
                blacklistedCount: blacklisted[0].count || 0,
                totalCustomers: totalCust[0].count || 0,
                portfolio: distribution,
                recentLoans: recentLoans
            };
        } catch (error) {
            console.error("❌ Dashboard Service Error:", error);
            throw error;
        }
    }
}

export default new DashboardService();