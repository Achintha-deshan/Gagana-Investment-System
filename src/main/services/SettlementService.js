import db from '../config/db.js';

class SettlementService {
    
    /**
     * 1. පියවීම සඳහා ණය සෙවීම (Search)
     */
    async searchLoansForSettlement(query) {
        const sql = `
            SELECT 
                l.LoanID, l.LoanType, l.Status,
                c.CustomerID, c.CustomerName, c.NIC, c.CustomerPhone,
                v.VehicleNumber, p.PromissoryNumber AS PRMNo
            FROM loans l
            JOIN customers c ON l.CustomerID = c.CustomerID
            LEFT JOIN vehicle_details v ON l.LoanID = v.LoanID
            LEFT JOIN promissory_details p ON l.LoanID = p.LoanID
            WHERE (l.LoanID LIKE ? OR c.NIC LIKE ? OR c.CustomerName LIKE ? OR c.CustomerID LIKE ?)
            AND l.Status = 'ACTIVE'
            GROUP BY l.LoanID
        `;
        try {
            const searchTerm = `%${query}%`;
            const [rows] = await db.execute(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);

            if (rows.length === 0) return [];

            const resultsWithSubs = [];
            for (let loan of rows) {
                const [subs] = await db.execute(
                    `SELECT * FROM loan_disbursements WHERE LoanID = ? AND DisbursementStatus = 'ACTIVE' ORDER BY SubLoanNumber ASC`,
                    [loan.LoanID]
                );
                resultsWithSubs.push({ ...loan, SubLoans: subs });
            }
            return resultsWithSubs;
        } catch (error) {
            console.error("Settlement Search Error:", error);
            return [];
        }
    }

    /**
     * 2. ගාස්තු ගණනය කිරීම (Settlement Breakdown)
     * මෙහි interestRate අගය දත්ත අතරට එක් කර ඇත.
     */
    async getSettlementBreakdown(disbursementId) {
        try {
            const [rows] = await db.execute(`SELECT * FROM loan_disbursements WHERE DisbursementID = ?`, [disbursementId]);
            if (rows.length === 0) return null;

            const sub = rows[0];
            const principal = parseFloat(sub.RemainingPrincipal);
            const interestRate = parseFloat(sub.InterestRate || 0);
            const monthlyInterest = (principal * interestRate) / 100;
            
            const today = new Date();
            const lastDate = new Date(sub.LastInterestDate || sub.DisbursedDate);
            
            const diffTime = Math.abs(today - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let interestToPay = 0;
            // දින රීතිය (Custom Logic)
            if (diffDays <= 2) {
                interestToPay = 0;
            } else if (diffDays <= 7) {
                interestToPay = monthlyInterest / 4;
            } else if (diffDays <= 14) {
                interestToPay = monthlyInterest / 2;
            } else {
                interestToPay = monthlyInterest;
            }

            return {
                success: true,
                data: {
                    disbursementId: sub.DisbursementID,
                    principal: principal,
                    interest: interestToPay,
                    interestRate: interestRate, // Frontend එකේ ගණනය කිරීම් සඳහා මෙය අත්‍යවශ්‍ය වේ
                    arrears: parseFloat(sub.CurrentArrears || 0),
                    daysPassed: diffDays,
                    lastInterestDate: sub.LastInterestDate || sub.DisbursedDate
                }
            };
        } catch (error) {
            console.error("Breakdown Error:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 3. සම්පූර්ණ පියවීම සැකසීම (Process Settlement)
     */
    async processSettlement(data) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const {
                DisbursementID, LoanID, CapitalPaid, InterestPaid, 
                PenaltyPaid, TotalPaid, PaymentDate, CollectedBy
            } = data;

            const activeUserID = CollectedBy;

            // 1. වත්මන් Arrears ප්‍රමාණය ලබා ගැනීම
            const [subRows] = await conn.execute(
                `SELECT CurrentArrears FROM loan_disbursements WHERE DisbursementID = ? FOR UPDATE`,
                [DisbursementID]
            );
            const arrearsBefore = subRows.length > 0 ? parseFloat(subRows[0].CurrentArrears || 0) : 0;

            // 2. Payment History වාර්තාව ඇතුළත් කිරීම (Remarks නොමැතිව)
            const historySql = `
                INSERT INTO payment_history (
                    DisbursementID, LoanID, TotalPaid, PrincipalPaid, 
                    InterestPaid, LateFeePaid, PenaltyPaid, ArrearsAdded, 
                    ArrearsSettled, BalanceArrears, BalancePrincipal, 
                    PaymentDate, CollectedBy
                ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, 0, 0, ?, ?)
            `;

            await conn.execute(historySql, [
                DisbursementID, 
                LoanID, 
                TotalPaid, 
                CapitalPaid, 
                InterestPaid, 
                PenaltyPaid, 
                arrearsBefore, 
                PaymentDate, 
                activeUserID
            ]);

            // 3. Sub Loan එක CLOSED ලෙස Update කිරීම
            await conn.execute(`
                UPDATE loan_disbursements
                SET DisbursementStatus = 'CLOSED',
                    RemainingPrincipal = 0,
                    CurrentArrears = 0,
                    LastPaymentDate = ?,
                    LastInterestDate = ?
                WHERE DisbursementID = ?
            `, [PaymentDate, PaymentDate, DisbursementID]);

            // 4. Master Loan එක Auto-Close කිරීම (සියලුම Sub Loans CLOSED නම්)
            const [activeSubs] = await conn.execute(
                `SELECT COUNT(*) AS count FROM loan_disbursements WHERE LoanID = ? AND DisbursementStatus = 'ACTIVE'`,
                [LoanID]
            );

            if (activeSubs[0].count === 0) {
                await conn.execute(`UPDATE loans SET Status = 'CLOSED' WHERE LoanID = ?`, [LoanID]);
            }

            await conn.commit();
            return { success: true };

        } catch (error) {
            await conn.rollback();
            console.error('❌ processSettlement Error:', error);
            return { success: false, error: "දත්ත ගබඩා කිරීමේ දෝෂයකි: " + error.message };
        } finally {
            conn.release();
        }
    }

    /**
     * 4. පියවීමක් අවලංගු කිරීම (Void Settlement)
     */
    async voidSettlement(paymentId) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [history] = await conn.execute(
                `SELECT * FROM payment_history WHERE PaymentID = ? AND IsVoided = 0`, [paymentId]
            );
            
            if (!history.length) throw new Error("පෙර ගෙවීම් වාර්තාවක් හමු නොවීය.");
            const pay = history[0];

            await conn.execute(`UPDATE payment_history SET IsVoided = 1 WHERE PaymentID = ?`, [paymentId]);

            // Sub Loan එක නැවත ACTIVE කිරීම
            await conn.execute(`
                UPDATE loan_disbursements 
                SET DisbursementStatus = 'ACTIVE',
                    RemainingPrincipal = TotalAmount,
                    CurrentArrears = ?
                WHERE DisbursementID = ?
            `, [pay.ArrearsSettled, pay.DisbursementID]);

            // Master Loan එක නැවත ACTIVE කිරීම
            await conn.execute(`UPDATE loans SET Status = 'ACTIVE' WHERE LoanID = ?`, [pay.LoanID]);

            await conn.commit();
            return { success: true };

        } catch (error) {
            await conn.rollback();
            console.error('❌ voidSettlement Error:', error);
            return { success: false, error: "අවලංගු කිරීමේදී දෝෂයක් සිදුවිය: " + error.message };
        } finally {
            conn.release();
        }
    }
}

export default new SettlementService();