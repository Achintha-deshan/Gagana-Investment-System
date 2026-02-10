import db from '../config/db.js';

class MigrationService {
    /**
     * පාරිභෝගිකයාගේ සක්‍රීය ණය පරීක්ෂා කිරීම
     * මෙහිදී Vehicle, Land, Check, Promissory යන ඕනෑම වර්ගයකට අදාළ ණය සෙවිය හැක
     */
    async getActiveLoansForMigration(query) {
        try {
            const sql = `
                SELECT l.*, c.CustomerName, c.NIC 
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID
                WHERE (l.CustomerID LIKE ? OR c.NIC LIKE ? OR c.CustomerName LIKE ?) 
                AND l.Status = 'ACTIVE'
            `;
            const searchTerm = `%${query}%`;
            const [rows] = await db.execute(sql, [searchTerm, searchTerm, searchTerm]);
            return rows;
        } catch (error) {
            console.error("Migration Search Error:", error);
            throw error;
        }
    }

    /**
     * පරණ දත්ත පද්ධතියට එක් කිරීමේ ප්‍රධාන Logic එක
     */
    async processMigration(data) {
        const {
            LoanID,
            PaidAmount,
            PenaltyPaid,
            InterestPaid,
            CapitalPaid,
            ArrearsRemaining, // පරණ පොතේ දැනට පවතින පොලී/දඩ හිඟය
            MonthsPaid,
            PaymentDate, // පරණ පොතේ අන්තිමට ගෙවූ දිනය
            CurrentLoanBalance // මෙම ගෙවීමෙන් පසු ඉතිරි මුළු ණය මුදල (Remaining Capital)
        } = data;

        const conn = await db.getConnection();

        try {
            await conn.beginTransaction();

            // 1. Payment History එකට පරණ ගෙවීමේ රෙකෝඩ් එක ඇතුළත් කිරීම
            // උඹේ schema එකේ ArrearsAmount කොලම් එක මේකට හරියටම ගැලපෙනවා
            const historySql = `
                INSERT INTO payment_history 
                (LoanID, PaidAmount, PenaltyPaid, InterestPaid, CapitalPaid, ArrearsAmount, MonthsPaid, PaymentDate, IsVoided) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `;
            await conn.execute(historySql, [
                LoanID, 
                PaidAmount || 0, 
                PenaltyPaid || 0, 
                InterestPaid || 0, 
                CapitalPaid || 0, 
                ArrearsRemaining || 0, 
                MonthsPaid || 1, 
                PaymentDate
            ]);

            // 2. Loans Table එක Update කිරීම
            // වැදගත්: Schema එකේ ArrearsAmount තිබිය යුතුය. 
            // LoanAmount එකට අපි දාන්නේ දැනට ඉතිරි මූලධනයයි.
            const updateLoanSql = `
                UPDATE loans 
                SET LoanAmount = ?, 
                    ArrearsAmount = ?, 
                    NextDueDate = DATE_ADD(?, INTERVAL 1 MONTH),
                    LastInterestDate = ?
                WHERE LoanID = ?
            `;
            
            await conn.execute(updateLoanSql, [
                CurrentLoanBalance, 
                ArrearsRemaining, 
                PaymentDate, // NextDueDate සෑදීමට පදනම් වන දිනය
                PaymentDate, // අවසන් වරට පොලිය ගණනය කළ දිනය
                LoanID
            ]);

            await conn.commit();
            return { success: true, message: "Migration completed successfully" };

        } catch (error) {
            await conn.rollback();
            console.error("Migration Process Error:", error);
            return { success: false, error: error.message };
        } finally {
            conn.release();
        }
    }
}

export default new MigrationService();