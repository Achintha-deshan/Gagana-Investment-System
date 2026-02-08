import db from '../config/db.js';

class PaymentService {
    
    // 1. පාරිභෝගිකයාගේ ID එක අනුව සක්‍රීය ණය ලබා ගැනීම
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
    } // <--- මෙන්න මේ Brace එක කලින් තිබුණේ නැහැ.

    // 2. ගෙවීම් Process කිරීම
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
            
            // Deduction Priority: Penalty -> Interest -> Capital
            const deductionFromPenalty = Math.min(remaining, penaltyDue);
            remaining -= deductionFromPenalty;

            const deductionFromInterest = Math.min(remaining, interestDue);
            remaining -= deductionFromInterest;

            const deductionFromCapital = remaining; 
            const newCapital = Math.max(0, currentCapital - deductionFromCapital);

            // History වාර්තාව
            const insertPaymentSql = `INSERT INTO payment_history (LoanID, PaidAmount, PenaltyPaid, InterestPaid, CapitalPaid, PaymentDate) VALUES (?, ?, ?, ?, ?, ?)`;
            await conn.execute(insertPaymentSql, [LoanID, paid, deductionFromPenalty, deductionFromInterest, deductionFromCapital, PaymentDate]);

            const statusUpdate = newCapital <= 0 ? 'CLOSED' : 'ACTIVE';

            // Loans Table Update - NextDueDate එක මාස ගණනකින් ඉදිරියට ගෙන යාම
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

    // 3. ගෙවීම් ඉතිහාසය ලබා ගැනීම
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

    // 4. ගෙවීමක් අවලංගු කිරීම (Void)
    async voidPayment(paymentId) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [payRows] = await conn.execute('SELECT * FROM payment_history WHERE PaymentID = ?', [paymentId]);
            if (!payRows.length) throw new Error("ගෙවීම සොයාගත නොහැක.");
            
            const { LoanID, CapitalPaid } = payRows[0];

            // ණය මුදල ආපසු වැඩි කිරීම සහ Due Date එක මාසයක් ආපසු හැරවීම
            const revertLoanSql = `
                UPDATE loans 
                SET LoanAmount = LoanAmount + ?, 
                    NextDueDate = DATE_SUB(NextDueDate, INTERVAL 1 MONTH),
                    Status = 'ACTIVE' 
                WHERE LoanID = ?`;

            await conn.execute(revertLoanSql, [CapitalPaid, LoanID]);
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

    // 5. ණයක විස්තර සහ දඩ ගණනය කිරීම
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

    // 6. Settlement (ණය සම්පූර්ණ පියවීම)
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

    // 7. Settlement සඳහා සෙවීම
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