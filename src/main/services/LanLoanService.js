//Lan Loarn Service
import db from '../config/db.js';

class LanLoanService {

    // 🔹 Generate Next Lan Loan ID (LLI001)
    async generateNextLanLoanId() {
        const [rows] = await db.execute(
            "SELECT LoanID FROM loans WHERE LoanType='LAND' ORDER BY LoanID DESC LIMIT 1"
        );
        if (rows.length === 0) return 'LLI001';
        const num = parseInt(rows[0].LoanID.replace('LLI', ''));
        return 'LLI' + (num + 1).toString().padStart(3, '0');
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

    // 🔹 Add Lan Loan with Beneficiaries (Transaction-safe)
    async addLanLoan(data) {
        const loanId = await this.generateNextLanLoanId();
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // 1️⃣ Insert into loans table
            await connection.execute(`
                INSERT INTO loans
                (LoanID, CustomerID, LoanType, LoanAmount, GivenAmount, LoanDate, InterestRate, NextDueDate, Status)
                VALUES (?, ?, 'LAND', ?, ?, ?, ?, DATE_ADD(?, INTERVAL 1 MONTH), 'ACTIVE')
            `, [
                loanId,
                data.CustomerID,
                data.LoanAmount,
                data.GivenAmount,
                data.LoanDate,
                data.InterestRate,
                data.LoanDate
            ]);

            // 2️⃣ Insert into lan_details
            await connection.execute(`
                INSERT INTO land_details
                (LoanID, LanNumber, Location, Size, CurrentValue, LoanLimit)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                loanId,
                data.LanNumber,
                data.Location,
                data.Size,
                data.CurrentValue,
                data.LoanLimit
            ]);

            // 3️⃣ Insert beneficiaries
            if (!data.Beneficiaries || data.Beneficiaries.length === 0) {
                throw new Error("අවම වශයෙන් එක් ඇපකරුවෙකු අනිවාර්ය වේ.");
            }

            for (const b of data.Beneficiaries) {
                // Check if already ACTIVE
                const isActive = await this.checkBeneficiaryActive(b.Name, b.Phone);
                if (isActive) throw new Error(`ඇපකරු ${b.Name} දැනටමත් සක්‍රීය ඉඩම් ණයක සිටී!`);

                await connection.execute(`
                    INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                    VALUES (?, ?, ?, ?)
                `, [loanId, b.Name, b.Phone, b.Address]);
            }

            await connection.commit();
            return { success: true, loanId };
        } catch (error) {
            await connection.rollback();
            console.error("Add Land Loan Error:", error);
            return { success: false, error: error.message };
        } finally {
            connection.release();
        }
    }

  // 🔹 Get all Land Loans with beneficiaries
async getAllLandLoans() {
    const [rows] = await db.execute(`
        SELECT 
            l.*, 
            ld.*, 
            (SELECT GROUP_CONCAT(Name SEPARATOR ', ') 
             FROM loan_beneficiaries 
             WHERE LoanID = l.LoanID) AS BeneficiaryNames
        FROM loans l
        JOIN land_details ld ON l.LoanID = ld.LoanID
        WHERE l.LoanType = 'LAND'
        ORDER BY l.CreatedAt DESC
    `);
    return rows;
}

// src/main/services/LanLoanService.js

async getLandLoanById(loanId) {
    try {
        const [rows] = await db.execute(`
            SELECT 
                l.*, 
                ld.*, 
                c.CustomerName, 
                c.CustomerPhone as CustomerPhone, -- මෙතන c.Mobile තිබුණ එක CustomerPhone කළා
                c.NIC 
            FROM loans l
            JOIN land_details ld ON l.LoanID = ld.LoanID
            JOIN customers c ON l.CustomerID = c.CustomerID
            WHERE l.LoanID = ?
        `, [loanId]);

        if (rows.length > 0) {
            const loan = rows[0];
            const [beneficiaries] = await db.execute(
                "SELECT * FROM loan_beneficiaries WHERE LoanID = ?", 
                [loanId]
            );
            loan.Beneficiaries = beneficiaries;
            return loan;
        }
        return null;
    } catch (error) {
        console.error("Get Land Loan By ID Error:", error);
        throw error;
    }
}

// 🔹 Update Land Loan (Transaction-safe)
async updateLanLoan(data) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Loans table එක update කිරීම
        await connection.execute(`
            UPDATE loans SET
                LoanAmount = ?, GivenAmount = ?, InterestRate = ?, LoanDate = ?
            WHERE LoanID = ?
        `, [data.LoanAmount, data.GivenAmount, data.InterestRate, data.LoanDate, data.LoanID]);

        // 2. Land details table එක update කිරීම
        await connection.execute(`
            UPDATE land_details SET
                LanNumber = ?, Location = ?, Size = ?, CurrentValue = ?, LoanLimit = ?
            WHERE LoanID = ?
        `, [data.LanNumber, data.Location, data.Size, data.CurrentValue, data.LoanLimit, data.LoanID]);

        // 3. පරණ ඇපකරුවන් ඉවත් කර අලුත් අය ඇතුළත් කිරීම
        await connection.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [data.LoanID]);
        
        for (const b of data.Beneficiaries) {
            await connection.execute(`
                INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                VALUES (?, ?, ?, ?)
            `, [data.LoanID, b.Name, b.Phone, b.Address]);
        }

        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        console.error("Update Land Loan Error:", error);
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

// 🔹 Delete Land Loan (Cascade delete නිසා details ඉබේම මැකේ)
async deleteLandLoan(loanId) {
    try {
        await db.execute(`DELETE FROM loans WHERE LoanID = ?`, [loanId]);
        return { success: true };
    } catch (error) {
        console.error("Delete Land Loan Error:", error);
        return { success: false, error: error.message };
    }
}

    // 🔹 Delete Beneficiary
    async deleteBeneficiary(beneficiaryId) {
        await db.execute(`DELETE FROM loan_beneficiaries WHERE BeneficiaryID = ?`, [beneficiaryId]);
        return { success: true };
    }

    // 🔹 Get Beneficiaries by LoanID
    async getBeneficiaries(loanId) {
        const [rows] = await db.execute(`SELECT * FROM loan_beneficiaries WHERE LoanID = ?`, [loanId]);
        return rows;
    }
}

export default new LanLoanService();
