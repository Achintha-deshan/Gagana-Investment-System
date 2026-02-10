import db from '../config/db.js';

class VehicleLoanService {

    // -----------------------------------------
    // 1. Generate Next Loan ID
    // -----------------------------------------
    async generateNextLoanId() {
        try {
            const [rows] = await db.execute(
                "SELECT LoanID FROM loans WHERE LoanType='VEHICLE' ORDER BY LoanID DESC LIMIT 1"
            );

            if (rows.length === 0) return 'VLI00001';

            const num = parseInt(rows[0].LoanID.replace('VLI', ''));
            return 'VLI' + (num + 1).toString().padStart(5, '0');
        } catch (error) {
            console.error("Vehicle Loan ID Generation Error:", error);
            throw error;
        }
    }

    // -----------------------------------------
    // 2. Check Beneficiary Activity
    // -----------------------------------------
    async checkBeneficiaryActive(name, phone) {
        const [rows] = await db.execute(`
            SELECT lb.LoanID 
            FROM loan_beneficiaries lb
            JOIN loans l ON lb.LoanID = l.LoanID
            WHERE lb.Name = ? AND lb.Phone = ? AND l.Status = 'ACTIVE'
        `, [name, phone]);
        return rows.length > 0;
    }

    // -----------------------------------------
    // 3. Get Vehicle Loan By ID
    // -----------------------------------------
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

    // -----------------------------------------
    // 4. Add New Vehicle Loan
    // -----------------------------------------
    async addVehicleLoan(data) {
        const loanId = await this.generateNextLoanId();
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // Loans table insert
            await connection.execute(`
                INSERT INTO loans
                (LoanID, CustomerID, LoanType, LoanAmount, GivenAmount, LoanDate, InterestRate, PenaltyRateOnInterest, NextDueDate, Status)
                VALUES (?, ?, 'VEHICLE', ?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL 1 MONTH), 'ACTIVE')
            `, [
                loanId,
                data.CustomerID,
                data.LoanAmount || 0,
                data.GivenAmount || 0,
                data.LoanDate || null,
                data.InterestRate || 0,
                data.InterestRate || 0,
                data.LoanDate || null
            ]);

            // Vehicle details insert (Handles undefined with '|| null')
            await connection.execute(`
                INSERT INTO vehicle_details
                (LoanID, OwnerName, VehicleNumber, VehicleType, CurrentValue, LoanLimit, RegistrationDate, Liyapadinchikalayuthudinaya)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                loanId,
                data.OwnerName || null,
                data.VehicleNumber || null,
                data.VehicleType || null,
                data.CurrentValue || 0,
                data.LoanLimit || 0,
                data.RegistrationDate || null,
                data.RegDeadlineDate || null
            ]);

            if (data.Beneficiaries && data.Beneficiaries.length > 0) {
                for (const b of data.Beneficiaries) {
                    await connection.execute(`
                        INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                        VALUES (?, ?, ?, ?)
                    `, [loanId, b.Name, b.Phone, b.Address]);
                }
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

    // -----------------------------------------
    // 5. Update Vehicle Loan (FULL CORRECTED CODE)
    // -----------------------------------------
    async updateVehicleLoan(data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Update loans table
            await connection.execute(`
                UPDATE loans SET 
                    LoanAmount = ?, 
                    GivenAmount = ?, 
                    InterestRate = ?, 
                    PenaltyRateOnInterest = ?
                WHERE LoanID = ?
            `, [
                data.LoanAmount || 0, 
                data.GivenAmount || 0, 
                data.InterestRate || 0, 
                data.InterestRate || 0, 
                data.LoanID
            ]);

            // Update vehicle_details table 
            // Ensures no 'undefined' values are passed to SQL
            await connection.execute(`
                UPDATE vehicle_details SET 
                    OwnerName = ?, 
                    VehicleNumber = ?, 
                    VehicleType = ?, 
                    CurrentValue = ?, 
                    LoanLimit = ?, 
                    Liyapadinchikalayuthudinaya = ?
                WHERE LoanID = ?
            `, [
                data.OwnerName || null, 
                data.VehicleNumber || null, 
                data.VehicleType || null, 
                data.CurrentValue || 0, 
                data.LoanLimit || 0, 
                data.RegDeadlineDate || null, // Important: handles the date
                data.LoanID
            ]);

            // Update beneficiaries (Delete old and re-insert)
            if (data.Beneficiaries) {
                await connection.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [data.LoanID]);
                for (const b of data.Beneficiaries) {
                    await connection.execute(`
                        INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                        VALUES (?, ?, ?, ?)
                    `, [data.LoanID, b.Name || null, b.Phone || null, b.Address || null]);
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

    // -----------------------------------------
    // 6. Utility Functions (Get All, Delete)
    // -----------------------------------------
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

    async deleteVehicleLoan(loanId) {
        try {
            await db.execute(`DELETE FROM loans WHERE LoanID = ?`, [loanId]);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

export default new VehicleLoanService();