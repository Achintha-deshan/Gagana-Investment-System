import db from '../config/db.js';

class DashboardService {
    async getSuperDashboardStats() {
        try {
            const today = new Date();
            // මේ මාසයේ පළමු දිනය (YYYY-MM-01)
            const firstDayOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

            // 1. මුළු ණය ආයෝජනය (Total Capital Out) - දැනට ACTIVE මට්ටමේ පවතින මුළු මුදල
            const [capOut] = await db.execute(`
                SELECT SUM(LoanAmount) as total 
                FROM loans 
                WHERE Status = 'ACTIVE'
            `);

            // 2. ලැබීමට ඇති පොලිය (Monthly Target Interest) 
            // සූත්‍රය: ACTIVE ණය වල (මුදල * පොලී අනුපාතය / 100)
            const [targetInt] = await db.execute(`
                SELECT SUM(LoanAmount * InterestRate / 100) as expected 
                FROM loans 
                WHERE Status = 'ACTIVE'
            `);

            // 3. මේ මාසයේ ඇත්තටම ලැබුණු පොලිය (Received Interest)
            const [receivedInt] = await db.execute(`
                SELECT SUM(InterestPaid) as got 
                FROM payment_history 
                WHERE PaymentDate >= ? AND IsVoided = 0
            `, [firstDayOfMonth]);

            // 4. අසාදු ලේඛනගත පාරිභෝගිකයින් (Blacklisted)
            const [blacklisted] = await db.execute(`
                SELECT COUNT(*) as count 
                FROM customers 
                WHERE IsBlacklisted = 1
            `);

            // 5. මුළු පාරිභෝගිකයින් සංඛ්‍යාව
            const [totalCust] = await db.execute("SELECT COUNT(*) as count FROM customers");

            // 6. ණය වර්ගීකරණය (Portfolio Distribution) - ප්‍රස්ථාරයට අවශ්‍ය වේ
            const [distribution] = await db.execute(`
                SELECT LoanType, COUNT(*) as count, SUM(LoanAmount) as totalAmount 
                FROM loans 
                WHERE Status = 'ACTIVE' 
                GROUP BY LoanType
            `);

            // 7. මෑතකාලීනව ලබාදුන් ණය (Recent 5 Loans)
            const [recentLoans] = await db.execute(`
                SELECT l.LoanID, c.CustomerName, l.LoanType, l.LoanAmount, l.InterestRate, l.LoanDate 
                FROM loans l
                JOIN customers c ON l.CustomerID = c.CustomerID 
                ORDER BY l.CreatedAt DESC 
                LIMIT 5
            `);

            return {
                capitalOut: capOut[0].total || 0,
                interestTarget: targetInt[0].expected || 0,
                interestReceived: receivedInt[0].got || 0,
                blacklistedCount: blacklisted[0].count || 0,
                totalCustomers: totalCust[0].count || 0,
                portfolio: distribution,
                recentLoans: recentLoans
            };
        } catch (error) {
            console.error("Dashboard Service Error:", error);
            throw error;
        }
    }
}

export default new DashboardService();