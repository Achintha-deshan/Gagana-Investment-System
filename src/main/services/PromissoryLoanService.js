import db from '../config/db.js';

class PromissoryLoanService {

    // 🔹 මීළඟ Promissory Loan ID එක සෑදීම (PRM001)
    async generateNextPromissoryId() {
        const [rows] = await db.execute(
            "SELECT LoanID FROM loans WHERE LoanType='PROMISSORY' ORDER BY LoanID DESC LIMIT 1"
        );
        if (rows.length === 0) return 'PRM001';
        
        // PRM කොටස ඉවත් කර අංකය පමණක් ලබාගෙන 1ක් එකතු කිරීම
        const num = parseInt(rows[0].LoanID.replace('PRM', ''));
        return 'PRM' + (num + 1).toString().padStart(3, '0');
    }

    // 🔹 ඇපකරුවෙකු දැනටමත් සක්‍රීය ණයක සිටීදැයි පරීක්ෂා කිරීම
    async checkBeneficiaryActive(name, phone) {
        const [rows] = await db.execute(`
            SELECT lb.LoanID 
            FROM loan_beneficiaries lb
            JOIN loans l ON lb.LoanID = l.LoanID
            WHERE lb.Name = ? AND lb.Phone = ? AND l.Status = 'ACTIVE'
        `, [name, phone]);
        return rows.length > 0;
    }

    // 🔹 Promissory Loan එකක් එකතු කිරීම (Transaction-safe)
    async addPromissoryLoan(data) {
        const loanId = await this.generateNextPromissoryId();
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // 1️⃣ පොදු loans වගුවට දත්ත ඇතුළත් කිරීම
            await connection.execute(`
                INSERT INTO loans
                (LoanID, CustomerID, LoanType, LoanAmount, GivenAmount, LoanDate, InterestRate, NextDueDate, Status, SmsDate, SmsMessage)
                VALUES (?, ?, 'PROMISSORY', ?, ?, ?, ?, DATE_ADD(?, INTERVAL 1 MONTH), 'ACTIVE', ?, ?)
            `, [
                loanId,
                data.CustomerID,
                data.LoanAmount,
                data.GivenAmount,
                data.LoanDate,
                data.InterestRate,
                data.LoanDate,
                data.SmsDate || null,
                data.SmsMessage || null
            ]);

            // 2️⃣ promissory_details වගුවට දත්ත ඇතුළත් කිරීම
            await connection.execute(`
                INSERT INTO promissory_details
                (LoanID, PromissoryNumber)
                VALUES (?, ?)
            `, [
                loanId,
                data.PromissoryNumber
            ]);

            // 3️⃣ ඇපකරුවන් ඇතුළත් කිරීම
            if (!data.Beneficiaries || data.Beneficiaries.length === 0) {
                throw new Error("අවම වශයෙන් එක් ඇපකරුවෙකු අනිවාර්ය වේ.");
            }

            for (const b of data.Beneficiaries) {
                // ඇපකරු දැනටමත් වෙනත් සක්‍රීය ණයක ඇපකරුවෙක්දැයි බැලීම
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
            console.error("Add Promissory Loan Error:", error);
            return { success: false, error: error.message };
        } finally {
            connection.release();
        }
    }

    // 🔹 සියලුම Promissory Loans ලබා ගැනීම
    async getAllPromissoryLoans() {
        const [rows] = await db.execute(`
            SELECT 
                l.*, 
                pd.PromissoryNumber,
                (SELECT GROUP_CONCAT(Name SEPARATOR ', ') 
                 FROM loan_beneficiaries 
                 WHERE LoanID = l.LoanID) AS BeneficiaryNames
            FROM loans l
            JOIN promissory_details pd ON l.LoanID = pd.LoanID
            WHERE l.LoanType = 'PROMISSORY'
            ORDER BY l.CreatedAt DESC
        `);
        return rows;
    }

// 🔹 නිශ්චිත Promissory Loan එකක සියලු විස්තර ලබා ගැනීම
async getPromissoryLoanById(loanId) {
    try {
        // [rows] ලෙස ලබා ගැනීම වඩාත් පැහැදිලියි
        const [rows] = await db.execute(`
            SELECT 
                l.*, 
                pd.PromissoryNumber,
                c.CustomerName, c.NIC, c.CustomerPhone
            FROM loans l
            JOIN promissory_details pd ON l.LoanID = pd.LoanID
            JOIN customers c ON l.CustomerID = c.CustomerID
            WHERE l.LoanID = ? AND l.LoanType = 'PROMISSORY'
        `, [loanId]);

        // පේළි කිසිවක් නැතිනම් null යවන්න
        if (rows.length === 0) return null;

        const loanData = rows[0];

        // එම ණයට අදාළ ඇපකරුවන් ලබා ගැනීම
        const [beneficiaries] = await db.execute(
            "SELECT * FROM loan_beneficiaries WHERE LoanID = ?",
            [loanId]
        );

        return {
            ...loanData,
            Beneficiaries: beneficiaries
        };
    } catch (error) {
        console.error("Get Promissory Loan By ID Error:", error);
        throw error;
    }
}

// 🔹 Update Promissory Loan (නිවැරදි කළ සංස්කරණය)
async updatePromissoryLoan(data) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 🟢 හිස් String පරීක්ෂා කර NULL බවට පත් කිරීම (Data Sanitization)
        // දිනයන් සහ මැසේජ් එක හිස් නම් MySQL වලට '' වෙනුවට null යැවිය යුතුය.
        const loanDate = data.LoanDate && data.LoanDate.trim() !== '' ? data.LoanDate : null;
        const smsDate = data.SmsDate && data.SmsDate.trim() !== '' ? data.SmsDate : null;
        const smsMessage = data.SmsMessage && data.SmsMessage.trim() !== '' ? data.SmsMessage : null;

        // 1. Loans වගුව Update කිරීම
        await connection.execute(`
            UPDATE loans SET
                LoanAmount = ?,
                GivenAmount = ?,
                InterestRate = ?,
                LoanDate = ?,
                SmsDate = ?,
                SmsMessage = ?
            WHERE LoanID = ?
        `, [
            data.LoanAmount, 
            data.GivenAmount, 
            data.InterestRate, 
            loanDate,   // සකස් කළ අගය
            smsDate,    // සකස් කළ අගය
            smsMessage, // සකස් කළ අගය
            data.LoanID
        ]);

        // 2. Promissory Details Update කිරීම
        await connection.execute(`
            UPDATE promissory_details SET
                PromissoryNumber = ?
            WHERE LoanID = ?
        `, [data.PromissoryNumber, data.LoanID]);

        // 3. ඇපකරුවන් Update කිරීම
        await connection.execute("DELETE FROM loan_beneficiaries WHERE LoanID = ?", [data.LoanID]);
        
        if (data.Beneficiaries && data.Beneficiaries.length > 0) {
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
        console.error("Update Promissory Loan Error:", error);
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

    // 🔹 Promissory Loan එකක් Delete කිරීම
    async deletePromissoryLoan(loanId) {
        // Table එකේ ON DELETE CASCADE දමා ඇති නිසා ලේසියෙන්ම Delete කළ හැක
        await db.execute(`DELETE FROM loans WHERE LoanID = ?`, [loanId]);
        return { success: true };
    }
}

export default new PromissoryLoanService();