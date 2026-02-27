// ============================================================
// LanLoanService.js — Land Loan Backend Service
// DB Schema: loans + loan_disbursements + land_details + loan_beneficiaries
// Vehicle pattern එකටම exactly match වෙනවා
// ============================================================

import db from '../config/db.js';

class LanLoanService {

    // ==========================================
    // 1. ඊළඟ Land Loan ID Generate (LLI00001)
    // ==========================================
  async generateNextLanLoanId() {
    try {
        // CreatedAt මත පදනම්ව අන්තිම LAND loan එක ගැනීම වඩාත් නිවැරදියි
        const [rows] = await db.execute(
            "SELECT LoanID FROM loans WHERE LoanType='LAND' ORDER BY CreatedAt DESC LIMIT 1"
        );
        
        if (rows.length === 0) return 'LLI00001';
        
        const lastId = rows[0].LoanID;
        
        // අංකය වෙන් කරගැනීමේදී LLI අකුරු ඉවත් කිරීම (Case-insensitive)
        const numPart = parseInt(lastId.toUpperCase().replace('LLI', ''), 10);
        
        if (isNaN(numPart)) return 'LLI00001'; // දත්ත දෝෂයක් ඇත්නම්

        return 'LLI' + String(numPart + 1).padStart(5, '0');
    } catch (err) {
        console.error("❌ generateNextLanLoanId Error:", err);
        throw err;
    }
}

    // ==========================================
    // 2. සියලුම Land Loans (Cards සඳහා)
    // ==========================================
    async getAllLandLoans() {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID,
                    l.CustomerID,
                    l.Status,
                    l.CreatedAt,
                    ld.LandNumber,
                    ld.Location,
                    ld.Size,
                    COALESCE((
                        SELECT COUNT(*) FROM loan_disbursements 
                        WHERE LoanID = l.LoanID
                    ), 0) AS SubLoanCount,
                    COALESCE((
                        SELECT SUM(RemainingPrincipal) FROM loan_disbursements 
                        WHERE LoanID = l.LoanID AND DisbursementStatus = 'ACTIVE'
                    ), 0) AS TotalBalance
                FROM loans l
                JOIN land_details ld ON l.LoanID = ld.LoanID
                WHERE l.LoanType = 'LAND'
                ORDER BY l.CreatedAt DESC
            `);
            return rows;
        } catch (err) {
            console.error("❌ getAllLandLoans Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 3. Loan ID එකෙන් සම්පූර්ණ විස්තර
    //    (Sub Loans + Beneficiaries සහිතව)
    // ==========================================
    async getLandLoanById(loanId) {
        try {
            // Master + Land Details
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID, l.CustomerID, l.Status, l.CreatedAt,
                    ld.LandNumber, ld.Location, ld.Size,
                    ld.CurrentValue, ld.LoanLimit
                FROM loans l
                JOIN land_details ld ON l.LoanID = ld.LoanID
                WHERE l.LoanID = ? AND l.LoanType = 'LAND'
            `, [loanId]);

            if (rows.length === 0) return null;

            // Sub Loans
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

            // Beneficiaries
            const [beneficiaries] = await db.execute(`
                SELECT BeneficiaryID, Name, Phone, Address
                FROM loan_beneficiaries
                WHERE LoanID = ?
            `, [loanId]);

            return {
                ...rows[0],
                SubLoans:      subLoans      || [],
                Beneficiaries: beneficiaries || []
            };
        } catch (err) {
            console.error("❌ getLandLoanById Error:", err);
            throw err;
        }
    }

// ==========================================
    // 4. නව Master Loan + Sub Loan #1 Save
    // ==========================================
    async addLanLoan(data) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const loanId = data.LoanID || await this.generateNextLanLoanId();

            // A. loans table
            await conn.execute(`
                INSERT INTO loans (LoanID, CustomerID, LoanType, Status, CreatedAt)
                VALUES (?, ?, 'LAND', 'ACTIVE', NOW())
            `, [loanId, data.CustomerID]);

            // B. loan_disbursements (Sub Loan #1)
            // ✅ FIX: DATE_ADD ඉවත් කර Frontend එකෙන් එවන NextDueDate එක කෙලින්ම භාවිතා කරයි
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
                data.LateFeePerDay      || 0,
                data.MonthlyPenaltyRate || 0,
                data.LoanDate,
                data.NextDueDate, // ✅ Frontend එකෙන් එන නිවැරදි දිනය
                data.LoanDate
            ]);

            // C. land_details (ඉඩමේ විස්තර)
            await conn.execute(`
                INSERT INTO land_details
                (LoanID, LandNumber, Location, Size, CurrentValue, LoanLimit)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                loanId,
                data.LandNumber   || null,
                data.Location     || null,
                data.Size         || null,
                data.CurrentValue || 0,
                data.LoanLimit    || 0
            ]);

            // D. Beneficiaries (ඇපකරුවන්)
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
            console.error("❌ addLanLoan Error:", err);
            return { success: false, error: err.message };
        } finally {
            conn.release();
        }
    }

    // ==========================================
    // 5. Sub Loan (Top-up) Add
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

            // ✅ FIX: මෙතැනදීත් NextDueDate එක කෙලින්ම Frontend එකෙන් ලබා ගනී
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
                data.LateFeePerDay      || 0,
                data.MonthlyPenaltyRate || 0,
                data.LoanDate,
                data.NextDueDate, // ✅ Frontend එකෙන් එන දිනය
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
    // 6. Land Details + Beneficiaries Update (Sub Loan සහාය ඇතිව)
    // ==========================================
    async updateLanLoan(data) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // A. Land Details Update
            await conn.execute(`
                UPDATE land_details SET
                    LandNumber   = ?,
                    Location     = ?,
                    Size         = ?,
                    CurrentValue = ?,
                    LoanLimit    = ?
                WHERE LoanID = ?
            `, [
                data.LandNumber   || null,
                data.Location     || null,
                data.Size         || null,
                data.CurrentValue || 0,
                data.LoanLimit    || 0,
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
                    sl.TotalAmount, // සාමාන්‍යයෙන් Update කරද්දී Remaining එකත් මුළු මුදලට සමාන කරයි
                    sl.GivenAmount,
                    sl.InterestRate,
                    sl.DisbursedDate,
                    sl.NextDueDate,
                    sl.DisbursementID,
                    data.LoanID
                ]);
            }

            // C. Beneficiaries — delete & re-insert
            if (Array.isArray(data.Beneficiaries)) {
                await conn.execute(
                    "DELETE FROM loan_beneficiaries WHERE LoanID = ?",
                    [data.LoanID]
                );
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
            console.error("❌ updateLanLoan Error:", err);
            return { success: false, error: err.message };
        } finally {
            conn.release();
        }
    }

  // ==========================================
    // 7. Sub Loan Delete + Renumber (Fixed CreatedAt Error)
    // ==========================================
    async deleteSubLoan(loanId, disbursementId) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [countRows] = await conn.execute(
                "SELECT COUNT(*) as cnt FROM loan_disbursements WHERE LoanID = ?",
                [loanId]
            );
            if (countRows[0].cnt <= 1) {
                throw new Error("අවසාන Sub Loan එක මකාගත නොහැක. සම්පූර්ණ ගිණුමම මකා දමන්න.");
            }

            await conn.execute(
                "DELETE FROM loan_disbursements WHERE DisbursementID = ?",
                [disbursementId]
            );

            // Renumber remaining sub loans (DisbursementID මත පදනම්ව පිළිවෙළට සැකසීම)
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
// ==========================================
    // 8. සම්පූර්ණ ඉඩම් ණය ගිණුමම මකා දැමීම (Manual Cascade)
    // ==========================================
    async deleteLandLoan(loanId) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // 1. සියලුම ගෙවීම් වාර්තා (Payment History) මකා දැමීම
            await conn.execute("DELETE FROM payment_history WHERE LoanID = ?", [loanId]);

            // 2. සියලුම වාරික (Sub Loans / Disbursements) මකා දැමීම
            await conn.execute("DELETE FROM loan_disbursements WHERE LoanID = ?", [loanId]);

            // 3. සියලුම ඇපකරුවන් (Beneficiaries) මකා දැමීම
            await conn.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [loanId]);

            // 4. ඉඩමේ විස්තර (Land Details) මකා දැමීම
            await conn.execute("DELETE FROM land_details WHERE LoanID = ?", [loanId]);

            // 5. අවසාන වශයෙන් ප්‍රධාන ණය වාර්තාව (Master Loan) මකා දැමීම
            const [result] = await conn.execute(
                "DELETE FROM loans WHERE LoanID = ? AND LoanType = 'LAND'", 
                [loanId]
            );

            if (result.affectedRows === 0) {
                throw new Error("අදාළ ණය ගිණුම සොයාගත නොහැකි විය.");
            }

            await conn.commit();
            return { success: true, message: "සම්පූර්ණ ඉඩම් ණය ගිණුම සාර්ථකව මකා දැමුවා." };

        } catch (err) {
            await conn.rollback();
            console.error("❌ deleteLandLoan Error:", err);
            return { success: false, error: "මකා දැමීම අසාර්ථකයි: " + err.message };
        } finally {
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

    // ==========================================
    // 10. Get / Delete Single Beneficiary
    // ==========================================
    async getBeneficiaries(loanId) {
        const [rows] = await db.execute(
            "SELECT * FROM loan_beneficiaries WHERE LoanID = ?",
            [loanId]
        );
        return rows;
    }

    async deleteBeneficiary(beneficiaryId) {
        await db.execute(
            "DELETE FROM loan_beneficiaries WHERE BeneficiaryID = ?",
            [beneficiaryId]
        );
        return { success: true };
    }
}

export default new LanLoanService();