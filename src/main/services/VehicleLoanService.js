import db from '../config/db.js';

class VehicleLoanService {

   // 🔹 Generate Next Vehicle Loan ID (VLI00001)
async generateNextLoanId() {
    try {
        const [rows] = await db.execute(
            "SELECT LoanID FROM loans WHERE LoanType='VEHICLE' ORDER BY LoanID DESC LIMIT 1"
        );

        // පළමු වාර්තාව නම් VLI00001 ලබා දෙන්න
        if (rows.length === 0) return 'VLI00001';

        // 'VLI' කොටස ඉවත් කර අංකය ලබාගෙන 1ක් එකතු කරන්න
        const num = parseInt(rows[0].LoanID.replace('VLI', ''));
        
        // padStart(5, '0') මගින් VLI පසුව ඉලක්කම් 5ක දිගක් පවත්වා ගනී (උදා: VLI00001)
        return 'VLI' + (num + 1).toString().padStart(5, '0');
    } catch (error) {
        console.error("Vehicle Loan ID Generation Error:", error);
        throw error;
    }
}

    // 🔹 Check if beneficiary is already ACTIVE
    async checkBeneficiaryActive(name, phone) {
        const [rows] = await db.execute(`
            SELECT lb.LoanID 
            FROM loan_beneficiaries lb
            JOIN loans l ON lb.LoanID = l.LoanID
            WHERE lb.Name = ? AND lb.Phone = ? AND l.Status = 'ACTIVE'
        `, [name, phone]);
        return rows.length > 0;
    }

    // 🔹 Get Single Vehicle Loan by ID
    async getVehicleLoanById(loanId) {
        try {
            const [rows] = await db.execute(`
                SELECT l.*, v.*, c.CustomerName, c.NIC, c.CustomerPhone 
                FROM loans l
                JOIN vehicle_details v ON l.LoanID = v.LoanID
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE l.LoanID = ?
            `, [loanId]);

            if (rows.length > 0) {
                const [beneficiaries] = await db.execute(
                    "SELECT * FROM loan_beneficiaries WHERE LoanID = ?", 
                    [loanId]
                );
                rows[0].Beneficiaries = beneficiaries;
                return rows[0];
            }
            return null;
        } catch (error) {
            console.error("Error in getVehicleLoanById:", error);
            throw error;
        }
    }

    // 🔹 Add Vehicle Loan with Beneficiaries (Transaction-safe)
    async addVehicleLoan(data) {
        const loanId = await this.generateNextLoanId();
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // 1️⃣ loans table එකට Insert කිරීම
            // PenaltyRateOnInterest එකටත් data.InterestRate ම යවා ඇත.
            await connection.execute(`
                INSERT INTO loans
                (LoanID, CustomerID, LoanType, LoanAmount, GivenAmount, LoanDate, InterestRate, PenaltyRateOnInterest, NextDueDate, Status)
                VALUES (?, ?, 'VEHICLE', ?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL 1 MONTH), 'ACTIVE')
            `, [
                loanId,
                data.CustomerID,
                data.LoanAmount,
                data.GivenAmount,
                data.LoanDate,
                data.InterestRate,      // Interest Rate
                data.InterestRate,      // Penalty Rate (දඩයත් පොලී අනුපාතයම වේ)
                data.LoanDate
            ]);

            // 2️⃣ vehicle_details table එකට Insert කිරීම
            await connection.execute(`
                INSERT INTO vehicle_details
                (LoanID, OwnerName, VehicleNumber, VehicleType, CurrentValue, LoanLimit, RegistrationDate)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                loanId,
                data.OwnerName,
                data.VehicleNumber,
                data.VehicleType,
                data.CurrentValue,
                data.LoanLimit,
                data.RegistrationDate
            ]);

            // 3️⃣ Beneficiaries Insert කිරීම
            if (!data.Beneficiaries || data.Beneficiaries.length === 0) {
                throw new Error("අවම වශයෙන් එක් ඇපකරුවෙකු අනිවාර්ය වේ.");
            }

            for (const b of data.Beneficiaries) {
                const isActive = await this.checkBeneficiaryActive(b.Name, b.Phone);
                if (isActive) throw new Error(`ඇපකරු ${b.Name} දැනටමත් සක්‍රීය වාහන ණයක සිටී!`);

                await connection.execute(`
                    INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                    VALUES (?, ?, ?, ?)
                `, [loanId, b.Name, b.Phone, b.Address]);
            }

            await connection.commit();
            return { success: true, loanId };
        } catch (error) {
            await connection.rollback();
            console.error("Add Vehicle Loan Error:", error);
            return { success: false, error: error.message };
        } finally {
            connection.release();
        }
    }

    // 🔹 Get all Vehicle Loans
    async getAllVehicleLoans() {
        const [rows] = await db.execute(`
            SELECT l.*, v.*, 
            (SELECT GROUP_CONCAT(Name SEPARATOR ', ') 
                FROM loan_beneficiaries 
                WHERE LoanID = l.LoanID) AS BeneficiaryNames
            FROM loans l
            JOIN vehicle_details v ON l.LoanID = v.LoanID
            WHERE l.LoanType='VEHICLE'
            ORDER BY l.CreatedAt DESC
        `);
        return rows;
    }

    // 🔹 Update Vehicle Loan (Transaction-safe)
    async updateVehicleLoan(data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Loans Table එක Update කිරීම (PenaltyRate එකත් සමඟ)
            await connection.execute(`
                UPDATE loans SET 
                    LoanAmount = ?, GivenAmount = ?, InterestRate = ?, PenaltyRateOnInterest = ?
                WHERE LoanID = ?
            `, [data.LoanAmount, data.GivenAmount, data.InterestRate, data.InterestRate, data.LoanID]);

            // 2. Vehicle Details Table එක Update කිරීම
            await connection.execute(`
                UPDATE vehicle_details SET 
                    OwnerName = ?, VehicleNumber = ?, VehicleType = ?, 
                    CurrentValue = ?, LoanLimit = ?
                WHERE LoanID = ?
            `, [data.OwnerName, data.VehicleNumber, data.VehicleType, data.CurrentValue, data.LoanLimit, data.LoanID]);

            // 3. ඇපකරුවන් Update කිරීම (Delete and Re-insert)
            if (data.Beneficiaries) {
                await connection.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [data.LoanID]);
                for (const b of data.Beneficiaries) {
                    await connection.execute(`
                        INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                        VALUES (?, ?, ?, ?)
                    `, [data.LoanID, b.Name, b.Phone, b.Address]);
                }
            }

            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            console.error("Update Vehicle Loan Error:", error);
            return { success: false, error: error.message };
        } finally {
            connection.release();
        }
    }

    // 🔹 Delete Vehicle Loan
    async deleteVehicleLoan(loanId) {
        await db.execute(`DELETE FROM loans WHERE LoanID = ?`, [loanId]);
        return { success: true };
    }

    async deleteBeneficiary(beneficiaryId) {
        await db.execute(`DELETE FROM loan_beneficiaries WHERE BeneficiaryID = ?`, [beneficiaryId]);
        return { success: true };
    }

    async getBeneficiaries(loanId) {
        const [rows] = await db.execute(`SELECT * FROM loan_beneficiaries WHERE LoanID = ?`, [loanId]);
        return rows;
    }
}

export default new VehicleLoanService();