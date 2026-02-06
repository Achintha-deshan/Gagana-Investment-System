import db from '../config/db.js';

class PromissoryLoanService {

    // 🔹 Generate Next Promissory Loan ID (PRM00001)
async generateNextPromissoryId() {
    try {
        const [rows] = await db.execute(
            "SELECT LoanID FROM loans WHERE LoanType='PROMISSORY' ORDER BY LoanID DESC LIMIT 1"
        );

        // පළමු වාර්තාව නම් PRM00001 ලබා දෙන්න
        if (rows.length === 0) return 'PRM00001';

        // 'PRM' කොටස ඉවත් කර අංකය ලබාගෙන 1ක් එකතු කරන්න
        const num = parseInt(rows[0].LoanID.replace('PRM', ''));
        
        // padStart(5, '0') මගින් PRM පසුව ඉලක්කම් 5ක දිගක් පවත්වා ගනී
        return 'PRM' + (num + 1).toString().padStart(5, '0');
    } catch (error) {
        console.error("Promissory ID Generation Error:", error);
        throw error;
    }
}

    async checkBeneficiaryActive(name, phone) {
        const [rows] = await db.execute(`
            SELECT lb.LoanID FROM loan_beneficiaries lb
            JOIN loans l ON lb.LoanID = l.LoanID
            WHERE lb.Name = ? AND lb.Phone = ? AND l.Status = 'ACTIVE'
        `, [name, phone]);
        return rows.length > 0;
    }

    // 🔹 Add Loan
    async addPromissoryLoan(data) {
        const loanId = await this.generateNextPromissoryId();
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // PenaltyRateOnInterest එකට InterestRate එකම ලබා දීම
            await connection.execute(`
                INSERT INTO loans
                (LoanID, CustomerID, LoanType, LoanAmount, GivenAmount, LoanDate, InterestRate, PenaltyRateOnInterest, NextDueDate, Status, SmsDate, SmsMessage)
                VALUES (?, ?, 'PROMISSORY', ?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL 1 MONTH), 'ACTIVE', ?, ?)
            `, [
                loanId, data.CustomerID, data.LoanAmount, data.GivenAmount, data.LoanDate,
                data.InterestRate, data.InterestRate, // Rates දෙකම එකයි
                data.LoanDate, data.SmsDate || null, data.SmsMessage || null
            ]);

            await connection.execute(`
                INSERT INTO promissory_details (LoanID, PromissoryNumber) VALUES (?, ?)
            `, [loanId, data.PromissoryNumber]);

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
            return { success: false, error: error.message };
        } finally { connection.release(); }
    }

    // 🔹 Update Loan
    async updatePromissoryLoan(data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const loanDate = data.LoanDate?.trim() || null;
            const smsDate = data.SmsDate?.trim() || null;
            const smsMessage = data.SmsMessage?.trim() || null;

            await connection.execute(`
                UPDATE loans SET
                    LoanAmount = ?, GivenAmount = ?, InterestRate = ?, PenaltyRateOnInterest = ?, 
                    LoanDate = ?, SmsDate = ?, SmsMessage = ?
                WHERE LoanID = ?
            `, [
                data.LoanAmount, data.GivenAmount, data.InterestRate, 
                data.InterestRate, // Penalty update
                loanDate, smsDate, smsMessage, data.LoanID
            ]);

            await connection.execute(`
                UPDATE promissory_details SET PromissoryNumber = ? WHERE LoanID = ?
            `, [data.PromissoryNumber, data.LoanID]);

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
            return { success: false, error: error.message };
        } finally { connection.release(); }
    }

    // Get & Delete methods (Keep as is...)
    async getAllPromissoryLoans() {
        const [rows] = await db.execute(`
            SELECT l.*, pd.PromissoryNumber, 
            (SELECT GROUP_CONCAT(Name SEPARATOR ', ') FROM loan_beneficiaries WHERE LoanID = l.LoanID) AS BeneficiaryNames
            FROM loans l JOIN promissory_details pd ON l.LoanID = pd.LoanID
            WHERE l.LoanType = 'PROMISSORY' ORDER BY l.CreatedAt DESC
        `);
        return rows;
    }

    async getPromissoryLoanById(loanId) {
        const [rows] = await db.execute(`
            SELECT l.*, pd.PromissoryNumber, c.CustomerName, c.NIC, c.CustomerPhone
            FROM loans l JOIN promissory_details pd ON l.LoanID = pd.LoanID
            JOIN customers c ON l.CustomerID = c.CustomerID
            WHERE l.LoanID = ? AND l.LoanType = 'PROMISSORY'
        `, [loanId]);
        if (rows.length === 0) return null;
        const [beneficiaries] = await db.execute("SELECT * FROM loan_beneficiaries WHERE LoanID = ?", [loanId]);
        return { ...rows[0], Beneficiaries: beneficiaries };
    }

    async deletePromissoryLoan(loanId) {
        await db.execute(`DELETE FROM loans WHERE LoanID = ?`, [loanId]);
        return { success: true };
    }
}
export default new PromissoryLoanService();