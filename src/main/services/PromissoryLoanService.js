import db from '../config/db.js';

class PromissoryLoanService {

    // ==========================================
    // 1. ඊළඟ Loan ID Generate කිරීම (PRM00001)
    // ==========================================
  async generateNextLoanId() {
    try {
        const [rows] = await db.execute(
            "SELECT LoanID FROM loans WHERE LoanType='PROMISSORY' ORDER BY CreatedAt DESC LIMIT 1"
        );

        if (rows.length === 0) return 'PRM00001';

        const lastId = rows[0].LoanID;

        // RegExp ( /PRM/g ) භාවිතා කර සියලුම PRM අකුරු ඉවත් කිරීම වඩාත් සුදුසුයි
        // එසේත් නැතිනම් slice භාවිතා කළ හැක.
        const numPart = parseInt(lastId.replace(/PRM/g, ''), 10);

        // පරීක්ෂා කරන්න numPart එක අංකයක්ද කියා
        if (isNaN(numPart)) {
            console.error("❌ Could not parse ID number from:", lastId);
            return 'PRM00001'; // දෝෂයක් ආවොත් මුල සිට පටන් ගන්න
        }

        return 'PRM' + String(numPart + 1).padStart(5, '0');
    } catch (err) {
        console.error("❌ generateNextLoanId Error:", err);
        throw err;
    }
}

    // ==========================================
    // 2. සියලුම ප්‍රොමිසරි නෝට්ටු ණය ලබා ගැනීම
    // ==========================================
    async getAllPromissoryLoans() {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID, 
                    l.CustomerID, 
                    l.Status,
                    l.CreatedAt,
                    pd.PromissoryNumber,
                    COALESCE((
                        SELECT COUNT(*) FROM loan_disbursements 
                        WHERE LoanID = l.LoanID
                    ), 0) AS SubLoanCount,
                    COALESCE((
                        SELECT SUM(RemainingPrincipal) FROM loan_disbursements 
                        WHERE LoanID = l.LoanID AND DisbursementStatus = 'ACTIVE'
                    ), 0) AS TotalBalance
                FROM loans l
                JOIN promissory_details pd ON l.LoanID = pd.LoanID
                WHERE l.LoanType = 'PROMISSORY'
                ORDER BY l.CreatedAt DESC
            `);
            return rows;
        } catch (err) {
            console.error("❌ getAllPromissoryLoans Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 3. නිශ්චිත Loan ID එකක සම්පූර්ණ විස්තර
    // ==========================================
    async getPromissoryLoanById(loanId) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID, l.CustomerID, l.Status, l.CreatedAt,
                    pd.PromissoryNumber,
                    c.CustomerName, c.NIC, c.CustomerPhone
                FROM loans l
                JOIN promissory_details pd ON l.LoanID = pd.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE l.LoanID = ? AND l.LoanType = 'PROMISSORY'
            `, [loanId]);

            if (rows.length === 0) return null;

            const [subLoans] = await db.execute(`
                SELECT 
                    DisbursementID, SubLoanNumber,
                    TotalAmount, RemainingPrincipal,
                    GivenAmount, InterestRate,
                    LateFeePerDay, MonthlyPenaltyRate,
                    CurrentArrears, DisbursedDate,
                    NextDueDate, DisbursementStatus
                FROM loan_disbursements
                WHERE LoanID = ?
                ORDER BY SubLoanNumber ASC
            `, [loanId]);

            const [beneficiaries] = await db.execute(`
                SELECT BeneficiaryID, Name, Phone, Address
                FROM loan_beneficiaries
                WHERE LoanID = ?
            `, [loanId]);

            return {
                ...rows[0],
                SubLoans: subLoans || [],
                Beneficiaries: beneficiaries || []
            };
        } catch (err) {
            console.error("❌ getPromissoryLoanById Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 4. අලුත් Master Loan + Sub Loan #1 Save
    // ==========================================
  async addPromissoryLoan(data) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const loanId = await this.generateNextLoanId();

            // 1. Master Loan Table
            await conn.execute(`
                INSERT INTO loans (LoanID, CustomerID, LoanType, Status, CreatedAt)
                VALUES (?, ?, 'PROMISSORY', 'ACTIVE', NOW())
            `, [loanId, data.CustomerID]);

            // 2. Promissory Details Table
            await conn.execute(`
                INSERT INTO promissory_details (LoanID, PromissoryNumber)
                VALUES (?, ?)
            `, [loanId, data.PromissoryNumber]);

            // 3. First Disbursement Table 
            // ✅ වෙනස: DATE_ADD ඉවත් කර Frontend එකෙන් එවන data.NextDueDate භාවිතා කරයි
            await conn.execute(`
                INSERT INTO loan_disbursements 
                (LoanID, SubLoanNumber, TotalAmount, RemainingPrincipal, GivenAmount,
                 InterestRate, LateFeePerDay, MonthlyPenaltyRate,
                 DisbursedDate, NextDueDate, DisbursementStatus, LastInterestDate)
                VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
            `, [
                loanId,
                data.LoanAmount,
                data.LoanAmount,
                data.GivenAmount || data.LoanAmount,
                data.InterestRate,
                data.LateFeePerDay || 0,
                data.MonthlyPenaltyRate || 0,
                data.LoanDate,
                data.NextDueDate, // <--- Frontend එකේ ගණනය කළ නිවැරදි දිනය
                data.LoanDate
            ]);

            // 4. Beneficiaries (පරණ කේතය එලෙසමයි...)
            if (Array.isArray(data.Beneficiaries)) {
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
            console.error("❌ addPromissoryLoan Error:", err);
            return { success: false, error: err.message };
        } finally {
            conn.release();
        }
    }
    // ==========================================
    // 5. Sub Loan (Top-up) එකක් එකතු කිරීම
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

            if (nextSubNum > 5) {
                throw new Error("Sub Loan 5ක සීමාව ඉක්මවා ඇත.");
            }

            // ✅ වෙනස: DATE_ADD ඉවත් කර Frontend එකෙන් එවන data.NextDueDate භාවිතා කරයි
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
                data.NextDueDate, // <--- Frontend එකේ ගණනය කළ නිවැරදි දිනය
                data.LoanDate
            ]);

            await conn.commit();
            return { success: true, subNumber: nextSubNum };
        } catch (err) {
            await conn.rollback();
            console.error("❌ addSubLoan Error:", err);
            return { success: false, error: err.message };
        } finally {
            conn.release();
        }
    }

  // ==========================================
    // 6. Promissory Details & Sub Loan Update
    // ==========================================
    async updatePromissoryLoan(data) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // 1. ප්‍රොමිසරි නෝට්ටු අංකය යාවත්කාලීන කිරීම
            if (data.PromissoryNumber) {
                await conn.execute(`
                    UPDATE promissory_details SET PromissoryNumber = ?
                    WHERE LoanID = ?
                `, [data.PromissoryNumber, data.LoanID]);
            }

            // 2. ඇපකරුවන් යාවත්කාලීන කිරීම (Delete & Re-insert)
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

            // 3. යම් හෙයකින් Sub Loan (Disbursement) දත්ත එවා ඇත්නම් ඒවා update කිරීම
            if (data.SubLoan && data.SubLoan.DisbursementID) {
                const s = data.SubLoan;
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
                    s.TotalAmount,
                    s.TotalAmount, // සාමාන්‍යයෙන් මුල් මුදල වෙනස් වන විට balance එකත් ඒ අනුවම සකසයි
                    s.GivenAmount,
                    s.InterestRate,
                    s.DisbursedDate,
                    s.NextDueDate,
                    s.DisbursementID,
                    data.LoanID
                ]);
            }

            await conn.commit();
            return { success: true, message: "දත්ත සාර්ථකව යාවත්කාලීන කළා." };
        } catch (err) {
            await conn.rollback();
            console.error("❌ updatePromissoryLoan Error:", err);
            return { success: false, error: err.message };
        } finally {
            conn.release();
        }
    }
 // ==========================================
    // 7. සම්පූර්ණ ගිණුම මකා දැමීම (Manual Cascade)
    // ==========================================
    async deletePromissoryLoan(loanId) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // 1. ගෙවීම් වාර්තා (Payments) මකා දැමීම
            await conn.execute("DELETE FROM payment_history WHERE LoanID = ?", [loanId]);

            // 2. සියලුම සබ් ලෝන් (Disbursements) මකා දැමීම
            await conn.execute("DELETE FROM loan_disbursements WHERE LoanID = ?", [loanId]);

            // 3. ඇපකරුවන් (Beneficiaries) මකා දැමීම
            await conn.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [loanId]);

            // 4. ප්‍රොමිසරි විස්තර (Promissory Details) මකා දැමීම
            await conn.execute("DELETE FROM promissory_details WHERE LoanID = ?", [loanId]);

            // 5. ප්‍රධාන ණය වාර්තාව (Master Loan) මකා දැමීම
            const [result] = await conn.execute(
                "DELETE FROM loans WHERE LoanID = ? AND LoanType = 'PROMISSORY'", 
                [loanId]
            );

            await conn.commit();
            return { success: true, message: "සම්පූර්ණ ප්‍රොමිසරි නෝට්ටු ගිණුම මකා දැමුවා." };
        } catch (err) {
            await conn.rollback();
            console.error("❌ deletePromissoryLoan Error:", err);
            return { success: false, error: "මකා දැමීම අසාර්ථකයි: " + err.message };
        } finally {
            conn.release();
        }
    }

// ==========================================
    // 8. Sub Loan Delete (With Payment Removal & Auto Re-numbering)
    // ==========================================
    async deleteSubLoan(loanId, disbursementId) {
        const conn = await db.getConnection();
        try {
            // ගනුදෙනුව ආරම්භ කිරීම
            await conn.beginTransaction();

            // 1. දැනට පවතින සබ් ලෝන් ගණන පරීක්ෂා කිරීම
            const [countRows] = await conn.execute(
                "SELECT COUNT(*) as cnt FROM loan_disbursements WHERE LoanID = ?",
                [loanId]
            );

            // අවසාන සබ් ලෝන් එක මැකීමට උත්සාහ කරන්නේ නම් දෝෂයක් පෙන්වන්න
            if (countRows[0].cnt <= 1) {
                throw new Error("අවසාන සබ් ලෝන් එක මැකිය නොහැක. සම්පූර්ණ ගිණුමම මකා දමන්න.");
            }

            // 2. මෙම සබ් ලෝන් එකට (DisbursementID) අදාළ සියලුම ගෙවීම් වාර්තා (Payments) මකා දැමීම
            // සටහන: Column name එක ඔබේ database එකේ ඇති පරිදි (DisbursementID) භාවිතා කර ඇත
            await conn.execute(
                "DELETE FROM payment_history WHERE DisbursementID = ?",
                [disbursementId]
            );

            // 3. සබ් ලෝන් (Disbursement) වාර්තාව මකා දැමීම
            await conn.execute(
                "DELETE FROM loan_disbursements WHERE DisbursementID = ?",
                [disbursementId]
            );

            // 4. ඉතිරි සබ් ලෝන් වල අංක (SubLoanNumber) නැවත අනුපිළිවෙළට සැකසීම (Re-numbering)
            // දිනය අනුව නැවත අංක කිරීම (1, 2, 3...)
            const [remaining] = await conn.execute(
                "SELECT DisbursementID FROM loan_disbursements WHERE LoanID = ? ORDER BY DisbursedDate ASC",
                [loanId]
            );

            for (let i = 0; i < remaining.length; i++) {
                await conn.execute(
                    "UPDATE loan_disbursements SET SubLoanNumber = ? WHERE DisbursementID = ?",
                    [i + 1, remaining[i].DisbursementID]
                );
            }

            // සියල්ල සාර්ථක නම් පමණක් Database එකට ස්ථිරවම ඇතුළත් කිරීම
            await conn.commit();
            return { success: true, message: "සබ් ලෝන් එක සහ ඊට අදාළ සියලු ගෙවීම් සාර්ථකව මකා දැමුණා." };

        } catch (err) {
            // දෝෂයක් ආවොත් කළ වෙනස්කම් අවලංගු කිරීම
            await conn.rollback();
            console.error("❌ deleteSubLoan Error:", err);
            return { success: false, error: err.message };
        } finally {
            // Connection එක නිදහස් කිරීම
            conn.release();
        }
    }
    // ==========================================
    // 9. Beneficiary Active Check
    // ==========================================
    async checkBeneficiaryActive(name, phone) {
        try {
            const [rows] = await db.execute(`
                SELECT COUNT(*) AS cnt FROM loan_beneficiaries lb
                JOIN loans l ON lb.LoanID = l.LoanID
                WHERE lb.Name = ? AND lb.Phone = ? AND l.Status = 'ACTIVE'
            `, [name, phone]);
            return rows[0].cnt > 0;
        } catch (err) {
            return false;
        }
    }
}

export default new PromissoryLoanService();