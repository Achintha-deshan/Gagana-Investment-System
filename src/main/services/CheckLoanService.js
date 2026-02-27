// ============================================================
// CheckLoanService.js — Check Loan Backend Service
// DB Schema: loans + loan_disbursements + check_details + loan_beneficiaries
// ============================================================

import db from '../config/db.js';

class CheckLoanService {

    // ==========================================
    // 1. ඊළඟ Check Loan ID Generate (CHQ00001)
    // ==========================================
   async generateNextCheckLoanId() {
        try {
            const [rows] = await db.execute(
                "SELECT LoanID FROM loans WHERE LoanType='CHECK' ORDER BY LoanID DESC LIMIT 1"
            );
            if (rows.length === 0) return 'CHQ00001';
            const lastId = rows[0].LoanID;
            const numPart = parseInt(lastId.replace('CHQ', ''), 10);
            return 'CHQ' + String(numPart + 1).padStart(5, '0');
        } catch (err) {
            console.error("❌ generateNextCheckLoanId Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 2. සියලුම Check Loans ලබා ගැනීම
    // ==========================================
    async getAllCheckLoans() {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID, l.CustomerID, l.Status, l.CreatedAt,
                    cd.CheckNumber, cd.OwnerName, cd.CheckDateNumber,
                    COALESCE((
                        SELECT COUNT(*) FROM loan_disbursements 
                        WHERE LoanID = l.LoanID
                    ), 0) AS SubLoanCount,
                    COALESCE((
                        SELECT SUM(RemainingPrincipal) FROM loan_disbursements 
                        WHERE LoanID = l.LoanID AND DisbursementStatus = 'ACTIVE'
                    ), 0) AS TotalBalance
                FROM loans l
                JOIN check_details cd ON l.LoanID = cd.LoanID
                WHERE l.LoanType = 'CHECK'
                ORDER BY l.CreatedAt DESC
            `);
            return rows;
        } catch (err) {
            console.error("❌ getAllCheckLoans Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 3. නිශ්චිත ID එකකින් තනි ගිණුමක විස්තර
    // ==========================================
    async getCheckLoanById(loanId) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID, l.CustomerID, l.Status, l.CreatedAt,
                    cd.CheckNumber, cd.OwnerName, cd.CheckDateNumber, cd.BankAccountDetails
                FROM loans l
                JOIN check_details cd ON l.LoanID = cd.LoanID
                WHERE l.LoanID = ? AND l.LoanType = 'CHECK'
            `, [loanId]);

            if (rows.length === 0) return null;

            const [subLoans] = await db.execute(`
                SELECT * FROM loan_disbursements 
                WHERE LoanID = ? ORDER BY SubLoanNumber ASC
            `, [loanId]);

            const [beneficiaries] = await db.execute(`
                SELECT * FROM loan_beneficiaries WHERE LoanID = ?
            `, [loanId]);

            return {
                ...rows[0],
                SubLoans: subLoans || [],
                Beneficiaries: beneficiaries || []
            };
        } catch (err) {
            console.error("❌ getCheckLoanById Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 4. නව Check Loan (Master + Sub Loan #1)
    // ==========================================
  async addCheckLoan(data) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const loanId = await this.generateNextCheckLoanId();
            const loanAmount = parseFloat(data.LoanAmount) || 0;
            const interestRate = parseFloat(data.InterestRate) || 0;

            // A. Master Table (loans)
            await conn.execute(`
                INSERT INTO loans (LoanID, CustomerID, LoanType, Status, CreatedAt)
                VALUES (?, ?, 'CHECK', 'ACTIVE', NOW())
            `, [loanId, data.CustomerID]);

            // B. Disbursement Table (මුල්ම ණය මුදල)
            await conn.execute(`
                INSERT INTO loan_disbursements 
                (LoanID, SubLoanNumber, TotalAmount, RemainingPrincipal, GivenAmount,
                 InterestRate, LateFeePerDay, MonthlyPenaltyRate,
                 DisbursedDate, NextDueDate, DisbursementStatus, LastInterestDate)
                VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
            `, [
                loanId, 
                loanAmount, 
                loanAmount, 
                parseFloat(data.GivenAmount) || loanAmount,
                interestRate, 
                parseFloat(data.LateFeePerDay) || 0, 
                parseFloat(data.MonthlyPenaltyRate) || 0,
                data.LoanDate, 
                data.NextDueDate, 
                data.LoanDate 
            ]);

            // C. Check Specific Details (බැංකු විස්තර ඇතුළුව)
            await conn.execute(`
                INSERT INTO check_details (LoanID, CheckNumber, OwnerName, CheckDateNumber, BankAccountDetails)
                VALUES (?, ?, ?, ?, ?)
            `, [
                loanId, 
                data.CheckNumber || '', 
                data.OwnerName || null, 
                data.CheckDateNumber || null, 
                data.BankAccount || data.BankAccountDetails || null
            ]);

            // D. ඇපකරුවන් (Beneficiaries)
            if (Array.isArray(data.Beneficiaries) && data.Beneficiaries.length > 0) {
                for (const b of data.Beneficiaries) {
                    if (b.Name && b.Phone) {
                        await conn.execute(`
                            INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                            VALUES (?, ?, ?, ?)
                        `, [loanId, b.Name, b.Phone, b.Address || null]);
                    }
                }
            }

            await conn.commit();
            return { success: true, loanId };
        } catch (err) {
            await conn.rollback();
            console.error("❌ addCheckLoan Error:", err);
            return { success: false, error: err.message };
        } finally {
            conn.release();
        }
    }
    // ==========================================
    // 5. Sub Loan Add (Top-up)
    // ==========================================

async addSubLoan(data) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [countRows] = await conn.execute(
            "SELECT COUNT(*) as cnt FROM loan_disbursements WHERE LoanID = ?",
            [data.LoanID]
        );
        const nextSubNum = countRows[0].cnt + 1;

        if (nextSubNum > 5) throw new Error("Sub Loan 5ක සීමාව ඉක්මවා ඇත.");

        /**
         * වෙනස් කළ කොටස: 
         * DATE_ADD භාවිතා නොකර Frontend එකෙන් එවන 'data.NextDueDate' එක කෙලින්ම භාවිතා කරයි.
         */
        await conn.execute(`
            INSERT INTO loan_disbursements 
            (LoanID, SubLoanNumber, TotalAmount, RemainingPrincipal, GivenAmount,
             InterestRate, LateFeePerDay, MonthlyPenaltyRate,
             DisbursedDate, NextDueDate, DisbursementStatus, LastInterestDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
        `, [
            data.LoanID, 
            nextSubNum, 
            data.LoanAmount, 
            data.LoanAmount, 
            data.GivenAmount || data.LoanAmount,
            data.InterestRate, 
            data.LateFeePerDay || 0, 
            data.MonthlyPenaltyRate || 0,
            data.LoanDate, 
            data.NextDueDate, // <--- මෙතැනදී කෙලින්ම data එක ගනී
            data.LoanDate
        ]);

        await conn.commit();
        return { success: true, subNumber: nextSubNum };
    } catch (err) {
        await conn.rollback();
        return { success: false, error: err.message };
    } finally {
        conn.release();
    }
}

    // ==========================================
    // 6. Update Check & Beneficiaries
    // ==========================================
 // ==========================================
// 6. Update Check & Beneficiaries (Sub Loan සහාය ඇතිව)
// ==========================================
async updateCheckLoan(data) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // A. Check Details Update
        await conn.execute(`
            UPDATE check_details SET 
                CheckNumber = ?, OwnerName = ?, CheckDateNumber = ?, BankAccountDetails = ?
            WHERE LoanID = ?
        `, [
            data.CheckNumber, 
            data.OwnerName || null, 
            data.CheckDateNumber || null, 
            data.BankAccount || data.BankAccountDetails || null, 
            data.LoanID
        ]);

        // B. අලුතින් එකතු කළ කොටස: Sub Loan එකක් වෙනස් කිරීමට අවශ්‍ය නම් එය Update කිරීම
        if (data.SubLoan && data.SubLoan.DisbursementID) {
            const sl = data.SubLoan;
            await conn.execute(`
                UPDATE loan_disbursements SET 
                    TotalAmount = ?, 
                    RemainingPrincipal = ?, 
                    GivenAmount = ?, 
                    InterestRate = ?, 
                    DisbursedDate = ?, 
                    NextDueDate = ?
                WHERE DisbursementID = ? AND LoanID = ?
            `, [
                sl.TotalAmount,
                sl.TotalAmount, // සාමාන්‍යයෙන් Update කරද්දී Remaining එකත් මුළු මුදලට සමාන කරයි (දැනට ගෙවා නැතිනම්)
                sl.GivenAmount,
                sl.InterestRate,
                sl.DisbursedDate,
                sl.NextDueDate,
                sl.DisbursementID,
                data.LoanID
            ]);
        }

        // C. Beneficiaries Update
        if (Array.isArray(data.Beneficiaries)) {
            await conn.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [data.LoanID]);
            for (const b of data.Beneficiaries) {
                if (b.Name && b.Phone) {
                    await conn.execute(`
                        INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                        VALUES (?, ?, ?, ?)
                    `, [data.LoanID, b.Name, b.Phone, b.Address || null]);
                }
            }
        }

        await conn.commit();
        return { success: true };
    } catch (err) {
        await conn.rollback();
        console.error("❌ updateCheckLoan Error:", err);
        return { success: false, error: err.message };
    } finally {
        conn.release();
    }
}

   // ============================================================
// 7. Sub Loan එකක් මැකීම සහ අංක පිළිවෙළ නැවත සැකසීම (Fixed CreatedAt Error)
// ============================================================
async deleteSubLoan(loanId, disbursementId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [countRows] = await conn.execute(
            "SELECT COUNT(*) as cnt FROM loan_disbursements WHERE LoanID = ?", [loanId]
        );
        
        if (countRows[0].cnt <= 1) {
            throw new Error("අවසාන Sub Loan එක මකාගත නොහැක. සම්පූර්ණ ගිණුමම මකා දමන්න.");
        }

        await conn.execute("DELETE FROM loan_disbursements WHERE DisbursementID = ?", [disbursementId]);

        // --- වෙනස් කළ කොටස (CreatedAt ඉවත් කළා) ---
        const [remaining] = await conn.execute(
            "SELECT DisbursementID FROM loan_disbursements WHERE LoanID = ? ORDER BY DisbursedDate ASC, DisbursementID ASC", 
            [loanId]
        );

        for (let i = 0; i < remaining.length; i++) {
            await conn.execute(
                "UPDATE loan_disbursements SET SubLoanNumber = ? WHERE DisbursementID = ?",
                [i + 1, remaining[i].DisbursementID]
            );
        }

        await conn.commit();
        return { success: true, message: "Sub Loan එක සාර්ථකව මකා දැමුවා." };
    } catch (err) {
        await conn.rollback();
        console.error("❌ deleteSubLoan Error:", err);
        return { success: false, error: err.message };
    } finally {
        conn.release();
    }
}

    // ============================================================
    // 8. සම්පූර්ණ ණය ගිණුමම මැකීම (Full Delete)
    // ============================================================
    async deleteCheckLoan(loanId) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // 1. ඇපකරුවන් මැකීම
            await conn.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [loanId]);
            
            // 2. චෙක්පත් විස්තර මැකීම
            await conn.execute("DELETE FROM check_details WHERE LoanID = ?", [loanId]);
            
            // 3. සියලුම Sub Loans (Disbursements) මැකීම
            await conn.execute("DELETE FROM loan_disbursements WHERE LoanID = ?", [loanId]);

            // 4. ප්‍රධාන Loan Record එක මැකීම
            const [result] = await conn.execute(
                "DELETE FROM loans WHERE LoanID = ? AND LoanType = 'CHECK'", 
                [loanId]
            );

            if (result.affectedRows === 0) {
                throw new Error("අදාළ ණය ගිණුම සොයාගත නොහැකි විය.");
            }

            await conn.commit();
            return { success: true, message: "සම්පූර්ණ ණය ගිණුම සාර්ථකව මකා දැමුවා." };
        } catch (err) {
            await conn.rollback();
            console.error("❌ deleteCheckLoan Error:", err);
            return { success: false, error: "මකා දැමීම අසාර්ථකයි: " + err.message };
        } finally {
            conn.release();
        }
    }

    async checkBeneficiaryActive(name, phone) {
        const [rows] = await db.execute(`
            SELECT COUNT(*) as cnt FROM loan_beneficiaries lb
            JOIN loans l ON lb.LoanID = l.LoanID
            WHERE lb.Name = ? AND lb.Phone = ? AND l.Status = 'ACTIVE'
        `, [name, phone]);
        return rows[0].cnt > 0;
    }
}

export default new CheckLoanService();