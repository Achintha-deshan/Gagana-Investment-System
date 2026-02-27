import db from '../config/db.js';

class VehicleLoanService {

    // ==========================================
    // 1. ඊළඟ Loan ID Generate කිරීම (VLI00001)
    // ==========================================
    async generateNextLoanId() {
        try {
            const [rows] = await db.execute(
                "SELECT LoanID FROM loans WHERE LoanType='VEHICLE' ORDER BY LoanID DESC LIMIT 1"
            );
            if (rows.length === 0) return 'VLI00001';
            const lastId = rows[0].LoanID;
            const numPart = parseInt(lastId.replace('VLI', ''), 10);
            return 'VLI' + String(numPart + 1).padStart(5, '0');
        } catch (err) {
            console.error("❌ generateNextLoanId Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 2. සියලුම වාහන ණය ලබා ගැනීම
    // ==========================================
    async getAllVehicleLoans() {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID, 
                    l.CustomerID, 
                    l.Status,
                    l.CreatedAt,
                    v.VehicleNumber, 
                    v.OwnerName,
                    v.VehicleType,
                    COALESCE((
                        SELECT COUNT(*) FROM loan_disbursements 
                        WHERE LoanID = l.LoanID
                    ), 0) AS SubLoanCount,
                    COALESCE((
                        SELECT SUM(RemainingPrincipal) FROM loan_disbursements 
                        WHERE LoanID = l.LoanID AND DisbursementStatus = 'ACTIVE'
                    ), 0) AS TotalBalance
                FROM loans l
                JOIN vehicle_details v ON l.LoanID = v.LoanID
                WHERE l.LoanType = 'VEHICLE'
                ORDER BY l.CreatedAt DESC
            `);
            return rows;
        } catch (err) {
            console.error("❌ getAllVehicleLoans Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 3. නිශ්චිත Loan ID එකක සම්පූර්ණ විස්තර
    // ==========================================
    async getVehicleLoanById(loanId) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    l.LoanID, l.CustomerID, l.Status, l.CreatedAt,
                    v.OwnerName, v.VehicleNumber, v.VehicleType,
                    v.CurrentValue, v.LoanLimit,
                    v.RegistrationDate, v.Liyapadinchikalayuthudinaya
                FROM loans l
                JOIN vehicle_details v ON l.LoanID = v.LoanID
                WHERE l.LoanID = ? AND l.LoanType = 'VEHICLE'
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
            console.error("❌ getVehicleLoanById Error:", err);
            throw err;
        }
    }

    // ==========================================
    // 4. අලුත් Master Loan + Sub Loan #1 Save
    // ==========================================
    async addVehicleLoan(data) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [existing] = await conn.execute(`
                SELECT v.LoanID FROM vehicle_details v
                JOIN loans l ON v.LoanID = l.LoanID
                WHERE v.VehicleNumber = ? AND l.Status = 'ACTIVE'
            `, [data.VehicleNumber]);

            if (existing.length > 0) {
                throw new Error(`වාහන අංක "${data.VehicleNumber}" සඳහා දැනටමත් සක්‍රීය ණයක් ඇත. (${existing[0].LoanID})`);
            }

            const loanId = await this.generateNextLoanId();

            await conn.execute(`
                INSERT INTO loans (LoanID, CustomerID, LoanType, Status, CreatedAt)
                VALUES (?, ?, 'VEHICLE', 'ACTIVE', NOW())
            `, [loanId, data.CustomerID]);

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
            data.NextDueDate, // Frontend එකෙන් එවන නිවැරදි දිනය ගන්න
            data.LoanDate
        ]);

            await conn.execute(`
                INSERT INTO vehicle_details
                (LoanID, OwnerName, VehicleNumber, VehicleType,
                 CurrentValue, LoanLimit, RegistrationDate, Liyapadinchikalayuthudinaya)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                loanId,
                data.OwnerName,
                data.VehicleNumber,
                data.VehicleType || null,
                data.CurrentValue || 0,
                data.LoanLimit || 0,
                data.RegistrationDate || null,
                data.RegDeadlineDate || null
            ]);

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
            console.error("❌ addVehicleLoan Error:", err);
            return { success: false, error: err.message };
        } finally {
            conn.release();
        }
    }

    // ==========================================
    // 5. Sub Loan (Top-up) එකක් එකතු කිරීම
    // ==========================================
async addSubLoan(data) {
    // 1. Backend Validation - අත්‍යවශ්‍ය දත්ත තිබේදැයි පරීක්ෂා කිරීම
    if (!data.LoanID) {
        return { success: false, error: "ප්‍රධාන ණය ගිණුම් අංකය (LoanID) අවශ්‍යයි." };
    }
    if (!data.LoanAmount || parseFloat(data.LoanAmount) <= 0) {
        return { success: false, error: "වලංගු ණය මුදලක් (Loan Amount) ඇතුළත් කරන්න." };
    }
    if (!data.LoanDate || !data.NextDueDate) {
        return { success: false, error: "ණය ලබාදුන් දිනය සහ ඊළඟ වාරික දිනය ඇතුළත් කරන්න." };
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 2. දැනට තියෙන Sub Loans ගණන පරීක්ෂා කිරීම (උපරිම 5 සීමාව සඳහා)
        const [existing] = await conn.execute(
            "SELECT COUNT(*) as count FROM loan_disbursements WHERE LoanID = ?", 
            [data.LoanID]
        );
        
        if (existing[0].count >= 5) {
            throw new Error("මෙම ගිණුම සඳහා උපරිම Sub Loans ප්‍රමාණය (5) ඉක්මවා ඇත.");
        }

        const nextSubNumber = existing[0].count + 1;

        // 3. Sub Loan එක ඇතුළත් කිරීම
        const [res] = await conn.execute(`
            INSERT INTO loan_disbursements (
                LoanID, SubLoanNumber, TotalAmount, RemainingPrincipal, 
                GivenAmount, InterestRate, DisbursedDate, NextDueDate, DisbursementStatus
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `, [
            data.LoanID,
            nextSubNumber,
            data.LoanAmount,
            data.LoanAmount, // මුලින්ම මුළු මුදලම ඉතිරි ශේෂය ලෙස දමයි
            data.GivenAmount || data.LoanAmount,
            data.InterestRate || 5,
            data.LoanDate,
            data.NextDueDate
        ]);

        await conn.commit();
        return { success: true, disbursementId: res.insertId };

    } catch (err) {
        await conn.rollback();
        console.error("❌ addSubLoan Error:", err);
        return { success: false, error: err.message };
    } finally {
        conn.release();
    }
}

  // ==========================================
// 7. ප්‍රධාන ගිණුම මකා දැමීම (Payments සමඟ)
// ==========================================
async deleteVehicleLoan(loanId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. සියලුම පේමන්ට් වාර්තා මකා දැමීම (මුලින්ම කළ යුතුයි)
        await conn.execute("DELETE FROM payment_history WHERE LoanID = ?", [loanId]);

        // 2. සියලුම සබ් ලෝන් මකා දැමීම
        await conn.execute("DELETE FROM loan_disbursements WHERE LoanID = ?", [loanId]);

        // 3. ඇපකරුවන් මකා දැමීම
        await conn.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [loanId]);

        // 4. වාහන විස්තර සහ ප්‍රධාන ණය මකා දැමීම (Cascade නැතිනම් මේවා අතින් කළ යුතුයි)
        await conn.execute("DELETE FROM vehicle_details WHERE LoanID = ?", [loanId]);
        const [result] = await conn.execute(
            "DELETE FROM loans WHERE LoanID = ? AND LoanType = 'VEHICLE'", 
            [loanId]
        );

        await conn.commit();
        return { success: true };
    } catch (err) {
        await conn.rollback();
        console.error("❌ deleteVehicleLoan Error:", err);
        return { success: false, error: err.message };
    } finally {
        conn.release();
    }
}

// ==========================================
// 8. සබ් ලෝන් එකක් මකා දැමීම (Payments සමඟ)
// ==========================================
async deleteSubLoan(loanId, disbursementId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. මෙම Sub Loan එකට අදාළ පේමන්ට් පමණක් මකා දැමීම
        await conn.execute(
            "DELETE FROM payment_history WHERE DisbursementID = ?",
            [disbursementId]
        );

        // 2. පවතින සබ් ලෝන් ගණන බලන්න
        const [countRows] = await conn.execute(
            "SELECT COUNT(*) as cnt FROM loan_disbursements WHERE LoanID = ?",
            [loanId]
        );

        if (countRows[0].cnt <= 1) {
            throw new Error("අවසාන සබ් ලෝන් එක මැකිය නොහැක. සම්පූර්ණ ගිණුමම මකන්න.");
        }

        // 3. Sub Loan එක මැකීම
        await conn.execute(
            "DELETE FROM loan_disbursements WHERE DisbursementID = ?",
            [disbursementId]
        );

        // 4. ඉතිරි Sub Loans වල අංක (Numbering) නැවත පිළිවෙලට සැකසීම
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

        await conn.commit();
        return { success: true };

    } catch (err) {
        await conn.rollback();
        console.error("❌ deleteSubLoan Error:", err);
        return { success: false, error: err.message };
    } finally {
        conn.release();
    }
}

// ==========================================
// 6. UPDATE (Main Acc & Sub Loan වෙන වෙනම)
// ==========================================
async updateVehicleLoan(data) {
    const conn = await db.getConnection();
    try {
        // 1. ප්‍රධාන දත්ත තිබේදැයි පරීක්ෂා කිරීම (Validation)
        if (!data.LoanID) {
            return { success: false, error: "Loan ID එක සොයාගත නොහැක." };
        }
        if (!data.OwnerName || !data.VehicleNumber) {
            return { success: false, error: "හිමිකරුගේ නම සහ වාහන අංකය අනිවාර්ය වේ." };
        }

        // 2. Sub Loan එකක් update කිරීමට යන්නේ නම් එහි දත්ත පරීක්ෂා කිරීම
        if (data.DisbursementID) {
            if (!data.TotalAmount || parseFloat(data.TotalAmount) <= 0) {
                return { success: false, error: "සබ් ලෝන් මුදල (Total Amount) වලංගු විය යුතුය." };
            }
            if (!data.DisbursedDate || !data.NextDueDate) {
                return { success: false, error: "සබ් ලෝන් දිනයන් (Dates) ඇතුළත් කළ යුතුය." };
            }
        }

        await conn.beginTransaction();

        // A. ප්‍රධාන වාහන විස්තර යාවත්කාලීන කිරීම
        await conn.execute(`
            UPDATE vehicle_details SET
                OwnerName = ?, VehicleNumber = ?, VehicleType = ?,
                CurrentValue = ?, LoanLimit = ?,
                Liyapadinchikalayuthudinaya = ?
            WHERE LoanID = ?
        `, [
            data.OwnerName, 
            data.VehicleNumber, 
            data.VehicleType || null,
            data.CurrentValue ?? 0, 
            data.LoanLimit ?? 0,
            data.RegDeadlineDate || null, 
            data.LoanID
        ]);

        // B. සබ් ලෝන් විස්තර යාවත්කාලීන කිරීම (DisbursementID එකක් තිබේ නම් පමණක්)
        if (data.DisbursementID) {
            // මෙහිදී '??' භාවිතා කළේ undefined අගයන් නිසා එන errors නැති කිරීමටයි
            await conn.execute(`
                UPDATE loan_disbursements SET
                    TotalAmount = ?, 
                    RemainingPrincipal = ?, 
                    GivenAmount = ?, 
                    InterestRate = ?,
                    DisbursedDate = ?, 
                    NextDueDate = ?
                WHERE DisbursementID = ?
            `, [
                data.TotalAmount ?? 0, 
                data.RemainingPrincipal ?? data.TotalAmount ?? 0, 
                data.GivenAmount ?? 0, 
                data.InterestRate ?? 0,
                data.DisbursedDate ?? null, 
                data.NextDueDate ?? null, 
                data.DisbursementID
            ]);
        }

        // C. ඇපකරුවන් යාවත්කාලීන කිරීම
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
        if (conn) await conn.rollback();
        console.error("❌ update Error:", err);
        return { success: false, error: "Update කිරීමේදී දෝෂයක් ඇතිවිය: " + err.message };
    } finally {
        if (conn) conn.release();
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

export default new VehicleLoanService();