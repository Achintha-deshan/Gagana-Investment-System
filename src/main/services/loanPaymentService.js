import db from '../config/db.js';

class PaymentService {
    
    async getActiveLoans(customerId) {
        try {
            const sql = `
                SELECT l.*, v.VehicleNumber, v.VehicleType
                FROM loans l
                LEFT JOIN vehicle_details v ON l.LoanID = v.LoanID
                WHERE l.CustomerID = ? AND l.Status = 'ACTIVE'
            `;
            const [rows] = await db.execute(sql, [customerId]);
            return Array.isArray(rows) ? rows : []; 
        } catch (error) {
            console.error("Database Error (getActiveLoans):", error);
            return [];
        }
    } 
    async processPayment(paymentData) {
        const { LoanID, PaidAmount, InterestAmount, PenaltyAmount, PaymentDate, MonthsPaid } = paymentData;
        
        const paid = parseFloat(PaidAmount) || 0;
        const interestDue = parseFloat(InterestAmount) || 0;
        const penaltyDue = parseFloat(PenaltyAmount) || 0;
        const monthsToIncrement = parseInt(MonthsPaid) || 0;

        const conn = await db.getConnection(); 
        try {
            await conn.beginTransaction();

            const [loanRows] = await conn.execute('SELECT LoanAmount FROM loans WHERE LoanID = ?', [LoanID]);
            if (!loanRows.length) throw new Error("ණය ගිණුම සොයාගත නොහැක!");

            let currentCapital = parseFloat(loanRows[0].LoanAmount) || 0;
            let remaining = paid;
            
            const deductionFromPenalty = Math.min(remaining, penaltyDue);
            remaining -= deductionFromPenalty;

            const deductionFromInterest = Math.min(remaining, interestDue);
            remaining -= deductionFromInterest;

            const deductionFromCapital = remaining; 
            const newCapital = Math.max(0, currentCapital - deductionFromCapital);

            const insertPaymentSql = `INSERT INTO payment_history (LoanID, PaidAmount, PenaltyPaid, InterestPaid, CapitalPaid, PaymentDate) VALUES (?, ?, ?, ?, ?, ?)`;
            await conn.execute(insertPaymentSql, [LoanID, paid, deductionFromPenalty, deductionFromInterest, deductionFromCapital, PaymentDate]);

            const statusUpdate = newCapital <= 0 ? 'CLOSED' : 'ACTIVE';

            const updateLoanSql = `
                UPDATE loans 
                SET LoanAmount = ?, 
                    NextDueDate = DATE_ADD(NextDueDate, INTERVAL ? MONTH),
                    LastInterestDate = ?,
                    Status = ?
                WHERE LoanID = ?`;

            await conn.execute(updateLoanSql, [newCapital, monthsToIncrement, PaymentDate, statusUpdate, LoanID]);

            await conn.commit();
            return { success: true, newCapital: newCapital, status: statusUpdate };

        } catch (error) {
            await conn.rollback();
            return { success: false, error: error.message };
        } finally {
            conn.release();
        }
    }

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

  async voidPayment(paymentId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. මේ ගෙවීමේ විස්තර සහ ණය ලබාගත් මුල් දිනය (LoanDate) ලබාගන්න
        const [payRows] = await conn.execute(`
            SELECT ph.*, l.LoanDate 
            FROM payment_history ph
            JOIN loans l ON ph.LoanID = l.LoanID
            WHERE ph.PaymentID = ?`, [paymentId]);

        if (!payRows.length) throw new Error("ගෙවීම සොයාගත නොහැක.");
        
        const { LoanID, CapitalPaid, LoanDate } = payRows[0];

        // 2. දැනට පවතින ගෙවීම් ඉතිහාසයෙන් මේ ගෙවීම ඉවත් කරන්න
        await conn.execute('DELETE FROM payment_history WHERE PaymentID = ?', [paymentId]);

        // 3. දැන් ඉතිරිව ඇති ගෙවීම් වාර්තා වලින් මුළු ගෙවූ මාස ගණන ගණනය කරන්න
        // (මෙහිදී MonthsPaid කියන column එකේ එකතුව ලබා ගැනීම වඩාත් නිවැරදි වේ)
        const [historySummary] = await conn.execute(
            'SELECT SUM(MonthsPaid) as TotalMonthsPaid FROM payment_history WHERE LoanID = ? AND IsVoided = 0', 
            [LoanID]
        );
        
        const totalMonthsPaid = parseInt(historySummary[0].TotalMonthsPaid) || 0;

        // 4. නිවැරදි NextDueDate එක ගණනය කිරීම:
        // මුල් දිනය + (දැනට ඉතිරිව ඇති ගෙවූ මාස ගණන + 1) = මීළඟට ගෙවිය යුතු දිනය
        const monthsToAddForNextDue = totalMonthsPaid + 1;

        const revertLoanSql = `
            UPDATE loans 
            SET LoanAmount = LoanAmount + ?, 
                NextDueDate = DATE_ADD(LoanDate, INTERVAL ? MONTH),
                Status = 'ACTIVE' 
            WHERE LoanID = ?`;

        await conn.execute(revertLoanSql, [CapitalPaid, monthsToAddForNextDue, LoanID]);

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

    async getLoanBreakdown(loanId) {
        try {
            const query = `
                SELECT l.*, 
                IFNULL((SELECT SUM(CapitalPaid) FROM payment_history WHERE LoanID = l.LoanID), 0) as TotalCapitalPaid
                FROM loans l 
                WHERE l.LoanID = ?`;
            const [rows] = await db.execute(query, [loanId]);
            if (rows.length === 0) return { success: false };

            const loan = rows[0];
            const currentBalance = parseFloat(loan.LoanAmount);
            
            const today = new Date();
            const dueDate = new Date(loan.NextDueDate);
            const diffTime = today - dueDate;
            const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

            const monthlyInterest = currentBalance * (parseFloat(loan.InterestRate) / 100);
            const penalty = overdueDays > 0 ? 
                (monthlyInterest * (parseFloat(loan.PenaltyRateOnInterest) / 100) * overdueDays) : 0;

            return {
                success: true,
                data: {
                    ...loan,
                    capitalBalance: currentBalance,
                    monthlyInterest,
                    penaltyDue: penalty,
                    overdueDays,
                    grandTotal: currentBalance + monthlyInterest + penalty
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async processSettlement(settleData) {
        const { LoanID, TotalPaid, CapitalPaid, InterestPaid, PenaltyPaid, PaymentDate } = settleData;
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const insertHistorySql = `
                INSERT INTO payment_history 
                (LoanID, PaidAmount, PenaltyPaid, InterestPaid, CapitalPaid, PaymentDate) 
                VALUES (?, ?, ?, ?, ?, ?)`;
            
            const [result] = await conn.execute(insertHistorySql, [
                LoanID, TotalPaid, PenaltyPaid, InterestPaid, CapitalPaid, PaymentDate
            ]);

            const closeLoanSql = `UPDATE loans SET LoanAmount = 0, Status = 'CLOSED' WHERE LoanID = ?`;
            await conn.execute(closeLoanSql, [LoanID]);

            await conn.commit();
            return { success: true, paymentId: result.insertId }; 
        } catch (error) {
            await conn.rollback();
            return { success: false, error: error.message };
        } finally {
            conn.release();
        }
    }

    async searchSettlement(query) {
        const sql = `
            SELECT 
                l.*, c.CustomerName, c.NIC, c.CustomerID,
                v.VehicleNumber, v.VehicleType
            FROM loans l
            JOIN customers c ON l.CustomerID = c.CustomerID
            LEFT JOIN vehicle_details v ON l.LoanID = v.LoanID
            WHERE (
                l.LoanID LIKE ? 
                OR c.NIC LIKE ? 
                OR c.CustomerName LIKE ? 
                OR c.CustomerID LIKE ?
            ) 
            AND l.Status = 'ACTIVE'
        `;
        try {
            const searchTerm = `%${query}%`;
            const [rows] = await db.execute(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);
            return rows; 
        } catch (error) {
            console.error("Database Error (searchSettlement):", error);
            return [];
        }
    }
}

export default new PaymentService();