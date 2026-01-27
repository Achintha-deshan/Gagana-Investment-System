import db from '../config/db.js';

class CheckLoanService {

    // 🔹 Generate Next Check Loan ID (CHQ001)
    async generateNextCheckLoanId() {
        const [rows] = await db.execute(
            "SELECT LoanID FROM loans WHERE LoanType='CHECK' ORDER BY LoanID DESC LIMIT 1"
        );
        if (rows.length === 0) return 'CHQ001';
        const num = parseInt(rows[0].LoanID.replace('CHQ', ''));
        return 'CHQ' + (num + 1).toString().padStart(3, '0');
    }

    // 🔹 ඇපකරු සක්‍රීයදැයි බැලීම
    async checkBeneficiaryActive(name, phone) {
        const [rows] = await db.execute(`
            SELECT lb.LoanID 
            FROM loan_beneficiaries lb
            JOIN loans l ON lb.LoanID = l.LoanID
            WHERE lb.Name = ? AND lb.Phone = ? AND l.Status = 'ACTIVE'
        `, [name, phone]);
        return rows.length > 0;
    }

    // 🔹 නව ණයක් ඇතුළත් කිරීම (Transaction-safe)
    async addCheckLoan(data) {
        const loanId = await this.generateNextCheckLoanId();
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // 1️⃣ loans table
            await connection.execute(`
                INSERT INTO loans
                (LoanID, CustomerID, LoanType, LoanAmount, GivenAmount, LoanDate, InterestRate, NextDueDate, Status)
                VALUES (?, ?, 'CHECK', ?, ?, ?, ?, DATE_ADD(?, INTERVAL 1 MONTH), 'ACTIVE')
            `, [loanId, data.CustomerID, data.LoanAmount, data.GivenAmount, data.LoanDate, data.InterestRate, data.LoanDate]);

            // 2️⃣ check_details table
            await connection.execute(`
                INSERT INTO check_details
                (LoanID, CheckNumber, OwnerName, CheckDateNumber, BankAccountDetails)
                VALUES (?, ?, ?, ?, ?)
            `, [loanId, data.CheckNumber, data.OwnerName, data.CheckDateNumber, data.BankAccountDetails]);

            // 3️⃣ Beneficiaries
            if (!data.Beneficiaries || data.Beneficiaries.length === 0) {
                throw new Error("අවම වශයෙන් එක් ඇපකරුවෙකු අනිවාර්ය වේ.");
            }

            for (const b of data.Beneficiaries) {
                const isActive = await this.checkBeneficiaryActive(b.Name, b.Phone);
                if (isActive) throw new Error(`ඇපකරු ${b.Name} දැනටමත් සක්‍රීය ණයක සිටී!`);

                await connection.execute(`
                    INSERT INTO loan_beneficiaries (LoanID, Name, Phone, Address)
                    VALUES (?, ?, ?, ?)
                `, [loanId, b.Name, b.Phone, b.Address]);
            }

            await connection.commit();
            return { success: true, loanId };
        } catch (error) {
            await connection.rollback();
            return { success: false, error: error.message };
        } finally {
            connection.release();
        }
    }

    // 🔹 සියලුම චෙක්පත් ණය ලබා ගැනීම
    async getAllCheckLoans() {
        const [rows] = await db.execute(`
            SELECT 
                l.*, cd.*, 
                (SELECT GROUP_CONCAT(Name SEPARATOR ', ') 
                 FROM loan_beneficiaries WHERE LoanID = l.LoanID) AS BeneficiaryNames
            FROM loans l
            JOIN check_details cd ON l.LoanID = cd.LoanID
            WHERE l.LoanType = 'CHECK'
            ORDER BY l.CreatedAt DESC
        `);
        return rows;
    }

    // 🔹 නිශ්චිත Check Loan එකක සියලු විස්තර ලබා ගැනීම
async getCheckLoanById(loanId) {
    const [loan] = await db.execute(`
        SELECT 
            l.*, cd.*, 
            c.CustomerName, c.NIC, c.CustomerPhone
        FROM loans l
        JOIN check_details cd ON l.LoanID = cd.LoanID
        JOIN customers c ON l.CustomerID = c.CustomerID
        WHERE l.LoanID = ? AND l.LoanType = 'CHECK'
    `, [loanId]);

    if (loan.length === 0) return null;

    // ඇපකරුවන් ලබා ගැනීම
    const [beneficiaries] = await db.execute(
        "SELECT * FROM loan_beneficiaries WHERE LoanID = ?",
        [loanId]
    );

    return {
        ...loan[0],
        Beneficiaries: beneficiaries
    };
}
    // 🔹 චෙක්පත් ණය Update කිරීම
    async updateCheckLoan(data) {
        // Update loans table
        await db.execute(`
            UPDATE loans SET
                LoanAmount = ?, GivenAmount = ?, InterestRate = ?
            WHERE LoanID = ?
        `, [data.LoanAmount, data.GivenAmount, data.InterestRate, data.LoanID]);

        // Update check_details table
        await db.execute(`
            UPDATE check_details SET
                CheckNumber = ?, OwnerName = ?, CheckDateNumber = ?, BankAccountDetails = ?
            WHERE LoanID = ?
        `, [data.CheckNumber, data.OwnerName, data.CheckDateNumber, data.BankAccountDetails, data.LoanID]);

        return { success: true };
    }

    // 🔹 ණය මකා දැමීම
    async deleteCheckLoan(loanId) {
        await db.execute(`DELETE FROM loans WHERE LoanID = ?`, [loanId]);
        return { success: true };
    }

    // 🔹 ඇපකරු මකා දැමීම (ඔබ විමසූ කොටස)
    async deleteBeneficiary(beneficiaryId) {
        await db.execute(`DELETE FROM loan_beneficiaries WHERE BeneficiaryID = ?`, [beneficiaryId]);
        return { success: true };
    }

    // 🔹 ඇපකරුවන් ලබා ගැනීම (ඔබ විමසූ කොටස)
    async getBeneficiaries(loanId) {
        const [rows] = await db.execute(`SELECT * FROM loan_beneficiaries WHERE LoanID = ?`, [loanId]);
        return rows;
    }
}

export default new CheckLoanService();