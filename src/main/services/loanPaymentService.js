import db from '../config/db.js';

class PaymentService {
    // පාරිභෝගිකයාගේ ID එක අනුව සක්‍රීය ණය සහ වාහන විස්තර ලබා ගැනීම
   async getActiveLoans(customerId) {
    try {
        const sql = `
            SELECT l.*, v.VehicleNumber, v.VehicleType
            FROM loans l
            LEFT JOIN vehicle_details v ON l.LoanID = v.LoanID
            WHERE l.CustomerID = ? AND l.Status = 'ACTIVE'
        `;
        const [rows] = await db.execute(sql, [customerId]);
        
        // rows කියන්නේ Array එකක් බව තහවුරු කරන්න
        return Array.isArray(rows) ? rows : []; 
    } catch (error) {
        console.error("Database Error:", error);
        return []; // Error එකකදී හිස් Array එකක් යවන්න
    }
}

    // ගෙවීම් වාර්තා කිරීම (Transaction-safe)
  // loanPaymentService.js

async processPayment(paymentData) {
    const { LoanID, PaidAmount, InterestAmount, PenaltyAmount, PaymentDate, MonthsPaid } = paymentData;
    
    const paid = parseFloat(PaidAmount) || 0;
    const interestDue = parseFloat(InterestAmount) || 0;
    const penaltyDue = parseFloat(PenaltyAmount) || 0;
    const monthsToIncrement = (parseInt(MonthsPaid) && parseInt(MonthsPaid) > 0) ? parseInt(MonthsPaid) : 1;

    const conn = await db.getConnection(); 
    try {
        await conn.beginTransaction();

        // 1. දැනට පවතින ණය මූලධනය ලබා ගැනීම
        const [loanRows] = await conn.execute('SELECT LoanAmount FROM loans WHERE LoanID = ?', [LoanID]);
        if (!loanRows.length) {
            throw new Error("ණය ගිණුම සොයාගත නොහැක!");
        }

        let currentCapital = parseFloat(loanRows[0].LoanAmount) || 0;
        let remaining = paid;
        
        // 2. මුදල් බෙදී යන ප්‍රමුඛතාවය (Priority Logic)
        const deductionFromPenalty = Math.min(remaining, penaltyDue);
        remaining -= deductionFromPenalty;

        const deductionFromInterest = Math.min(remaining, interestDue);
        remaining -= deductionFromInterest;

        // ඉතිරි මුදල මූලධනයෙන් කැපීම
        const deductionFromCapital = remaining; 
        const newCapital = Math.max(0, currentCapital - deductionFromCapital);

        // 3. payment_history වගුවට වාර්තාවක් එක් කිරීම
        const insertPaymentSql = `
            INSERT INTO payment_history 
            (LoanID, PaidAmount, PenaltyPaid, InterestPaid, CapitalPaid, PaymentDate) 
            VALUES (?, ?, ?, ?, ?, ?)`;
        
        await conn.execute(insertPaymentSql, [
            LoanID, paid, deductionFromPenalty, deductionFromInterest, deductionFromCapital, PaymentDate
        ]);

        // 4. loans වගුව යාවත්කාලීන කිරීම (සහ Status එක පරීක්ෂා කිරීම)
        // මූලධනය (New Capital) ශුන්‍ය නම් Status එක 'CLOSED' කළ යුතුය
        let statusUpdate = 'ACTIVE';
        if (newCapital <= 0) {
            statusUpdate = 'CLOSED';
        }

        const updateLoanSql = `
            UPDATE loans 
            SET LoanAmount = ?, 
                NextDueDate = DATE_ADD(NextDueDate, INTERVAL ? MONTH),
                LastInterestDate = ?,
                Status = ?
            WHERE LoanID = ?`;

        await conn.execute(updateLoanSql, [
            newCapital, 
            monthsToIncrement, 
            PaymentDate, 
            statusUpdate, // මෙතැනින් Status එක 'ACTIVE' හෝ 'CLOSED' ලෙස මාරු වේ
            LoanID
        ]);

        console.log(`--- Payment Processed for ${LoanID} ---`);
        console.log(`Status set to: ${statusUpdate}`);

        await conn.commit();
        
        return { 
            success: true, 
            newCapital: newCapital, 
            status: statusUpdate,
            monthsPaid: monthsToIncrement 
        };

    } catch (error) {
        await conn.rollback();
        console.error("Payment Process Error:", error);
        return { success: false, error: error.message };
    } finally {
        conn.release();
    }
}
    // loanPaymentService.js ඇතුළතට මෙම ශ්‍රිතය එක් කරන්න

async getPaymentHistory(loanId) {
    try {
        const sql = `
            SELECT * FROM payment_history 
            WHERE LoanID = ? 
            ORDER BY PaymentDate DESC, PaymentID DESC 
            LIMIT 10
        `;
        const [rows] = await db.execute(sql, [loanId]);
        return rows;
    } catch (error) {
        console.error("Database Error (getHistory):", error);
        return [];
    }
}

// Void (අවලංගු කිරීමේ) Logic එක
async voidPayment(paymentId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. මුලින්ම ගෙවීමේ විස්තර ලබාගන්න (මකා දැමීමට පෙර)
        const [payRows] = await conn.execute('SELECT * FROM payment_history WHERE PaymentID = ?', [paymentId]);
        if (!payRows.length) throw new Error("ගෙවීම සොයාගත නොහැක.");
        
        const payment = payRows[0];
        const { LoanID, CapitalPaid } = payment;

        // 2. ණය මුදල සහ දිනය ආපසු හැරවීම
        // මෙහිදී CapitalPaid මුදල නැවත ණයට එකතු කරන අතර, මාසය එකක් ආපස්සට ගෙන යයි
        const revertLoanSql = `
            UPDATE loans 
            SET LoanAmount = LoanAmount + ?, 
                NextDueDate = DATE_SUB(NextDueDate, INTERVAL 1 MONTH) 
            WHERE LoanID = ?`;

        await conn.execute(revertLoanSql, [CapitalPaid, LoanID]);

        // 3. එම ගෙවීමේ වාර්තාව ඉතිහාසයෙන් මකා දැමීම
        // (නැතිනම් Status = 'VOID' ලෙස update කරන්නත් පුළුවන්)
        await conn.execute('DELETE FROM payment_history WHERE PaymentID = ?', [paymentId]);

        await conn.commit();
        return { success: true };

    } catch (error) {
        await conn.rollback();
        console.error("Void Process Error:", error);
        return { success: false, error: error.message };
    } finally {
        conn.release();
    }
}

// ණයක සම්පූර්ණ විස්තරය සහ දඩ මුදල් ගණනය කිරීම
    async getLoanBreakdown(loanId) {
        try {
            const query = `
                SELECT l.*, 
                IFNULL((SELECT SUM(CapitalPaid) FROM payment_history WHERE LoanID = l.LoanID), 0) as PaidCapital
                FROM loans l 
                WHERE l.LoanID = ?`;
            const [rows] = await db.execute(query, [loanId]);
            if (rows.length === 0) return { success: false };

            const loan = rows[0];
            const capitalBalance = parseFloat(loan.LoanAmount) - parseFloat(loan.PaidCapital);
            
            // දින ගණනය (අද දිනට)
            const today = new Date();
            const dueDate = new Date(loan.NextDueDate);
            const diffTime = today - dueDate;
            const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

            // ගණනය කිරීම (පොලිය 5% සහ දඩය පොලියෙන් 5% බැගින් දිනකට)
            const monthlyInterest = capitalBalance * (parseFloat(loan.InterestRate) / 100);
            const penalty = overdueDays > 0 ? 
                (monthlyInterest * (parseFloat(loan.PenaltyRateOnInterest) / 100) * overdueDays) : 0;

            return {
                success: true,
                data: {
                    ...loan,
                    capitalBalance,
                    monthlyInterest,
                    penaltyDue: penalty,
                    overdueDays,
                    grandTotal: capitalBalance + monthlyInterest + penalty
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

export default new PaymentService();