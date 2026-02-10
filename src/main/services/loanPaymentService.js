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
        let remaining = parseFloat(PaidAmount) || 0;
        const conn = await db.getConnection();

        try {
            await conn.beginTransaction();

            const [loanRows] = await conn.execute(
                'SELECT LoanAmount, ArrearsAmount FROM loans WHERE LoanID = ?', [LoanID]
            );
            let currentCapital = parseFloat(loanRows[0].LoanAmount);
            let currentArrears = parseFloat(loanRows[0].ArrearsAmount);

            let arrearsPaid = 0;
            let penaltyPaid = 0;
            let interestPaid = 0;
            let capitalPaid = 0;

            // 1. Arrears පියවීම
            if (remaining > 0 && currentArrears > 0) {
                arrearsPaid = Math.min(remaining, currentArrears);
                remaining -= arrearsPaid;
            }

            // 2. Penalty පියවීම
            if (remaining > 0) {
                penaltyPaid = Math.min(remaining, parseFloat(PenaltyAmount));
                remaining -= penaltyPaid;
            }

            // 3. Interest පියවීම
            if (remaining > 0) {
                interestPaid = Math.min(remaining, parseFloat(InterestAmount));
                remaining -= interestPaid;
            }

            // 4. Capital පියවීම
            if (remaining > 0) {
                capitalPaid = remaining;
                remaining = 0;
            }

            const newCapital = Math.max(0, currentCapital - capitalPaid);
            
            // වැදගත්: නොගෙවූ දඩ සහ පොලී තිබේ නම් ඒවා නව Arrears ලෙස එකතු වේ
            const unpaidCharges = (parseFloat(PenaltyAmount) - penaltyPaid) + (parseFloat(InterestAmount) - interestPaid);
            const newArrears = Math.max(0, currentArrears - arrearsPaid) + unpaidCharges;

            // History එකට දාද්දී 'ArrearsAmount' ලෙස සේව් කරන්නේ මේ ගෙවීමේදී පියවූ Arrears ප්‍රමාණයයි
            await conn.execute(
                `INSERT INTO payment_history 
                (LoanID, PaidAmount, PenaltyPaid, InterestPaid, CapitalPaid, ArrearsAmount, PaymentDate, MonthsPaid, IsVoided) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [LoanID, PaidAmount, penaltyPaid, interestPaid, capitalPaid, arrearsPaid, PaymentDate, MonthsPaid]
            );

            await conn.execute(
                `UPDATE loans 
                 SET LoanAmount = ?, ArrearsAmount = ?, NextDueDate = DATE_ADD(NextDueDate, INTERVAL ? MONTH)
                 WHERE LoanID = ?`,
                [newCapital, newArrears, MonthsPaid, LoanID]
            );

            await conn.commit();
            return { success: true };
        } catch (error) {
            await conn.rollback();
            return { success: false, error: error.message };
        } finally {
            conn.release();
        }
    }

    async voidPayment(paymentId) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [payRows] = await conn.execute(`
                SELECT * FROM payment_history WHERE PaymentID = ? AND IsVoided = 0`, [paymentId]);

            if (!payRows.length) throw new Error("ගෙවීම සොයාගත නොහැක.");
            
            const { LoanID, PaidAmount, CapitalPaid, ArrearsAmount, PenaltyPaid, InterestPaid, MonthsPaid } = payRows[0];

            // 1. අවලංගු කිරීම සටහන් කරන්න
            await conn.execute('UPDATE payment_history SET IsVoided = 1 WHERE PaymentID = ?', [paymentId]);

            // 2. Logic එක:
            // Revert විය යුතු Arrears = (මේ ගෙවීමේදී පියවූ ArrearsAmount) + (ගෙවීමට තිබී නොගෙවූ දඩ/පොලී)
            // නමුත් වඩාත් නිවැරදි ක්‍රමය: PaidAmount එකෙන් Capital එකට ගිය ටික අඩු කර ඉතිරි මුළු මුදලම Arrears වලට එකතු කිරීමයි.
            
            const [currentLoan] = await conn.execute('SELECT PenaltyRateOnInterest, InterestRate, LoanAmount FROM loans WHERE LoanID = ?', [LoanID]);
            
            // ගෙවීමේදී පියවූ Arrears, Penalty සහ Interest යන සියල්ලම නැවත Arrears වලට එකතු විය යුතුයි.
            const totalArrearsToRestore = parseFloat(ArrearsAmount) + parseFloat(PenaltyPaid) + parseFloat(InterestPaid);

            const revertLoanSql = `
                UPDATE loans 
                SET LoanAmount = LoanAmount + ?, 
                    ArrearsAmount = ArrearsAmount + ?,
                    NextDueDate = DATE_SUB(NextDueDate, INTERVAL ? MONTH)
                WHERE LoanID = ?`;

            await conn.execute(revertLoanSql, [CapitalPaid, totalArrearsToRestore, MonthsPaid, LoanID]);

            await conn.commit();
            return { success: true };
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

            // processSettlement ඇතුළත Insert Query එක මෙහෙම වෙනස් කරන්න
const insertHistorySql = `
    INSERT INTO payment_history 
    (LoanID, PaidAmount, PenaltyPaid, InterestPaid, CapitalPaid, ArrearsAmount, PaymentDate) 
    VALUES (?, ?, ?, ?, ?, 0, ?)`; // ArrearsAmount එකට 0 දාන්න
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