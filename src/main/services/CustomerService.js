import db from '../config/db.js';

class CustomerService {
    
    // 1. ඊළඟ Customer ID එක සාදා ගැනීම (C0001, C0002...)
async generateNextCustomerId() {
    try {
        const [rows] = await db.execute('SELECT CustomerID FROM customers ORDER BY CustomerID DESC LIMIT 1');
        
        // පද්ධතියේ පළමු පාරිභෝගිකයා නම් C0001 ලබා දෙන්න
        if (rows.length === 0) return 'C0001';

        const lastId = rows[0].CustomerID;
        
        // 'C' අකුර ඉවත් කර ඉතිරි අංකය ගෙන 1ක් එකතු කරන්න
        const lastNumber = parseInt(lastId.substring(1));
        
        // padStart(4, '0') මගින් C පසුව ඉලක්කම් 4ක දිගක් පවත්වා ගනී (උදා: C0001)
        return 'C' + (lastNumber + 1).toString().padStart(4, '0');
    } catch (error) {
        console.error("Customer ID Generation Error:", error);
        throw error;
    }
}

    // 2. සියලුම පාරිභෝගිකයින් ලබා ගැනීම (අලුත්ම අය මුලට)
    async getAll() {
        try {
            const [rows] = await db.execute('SELECT * FROM customers ORDER BY CustomerID DESC');
            return rows;
        } catch (error) {
            console.error("Fetch All Error:", error);
            throw error;
        }
    }

    // 3. අලුත් පාරිභෝගිකයෙකු ඇතුළත් කිරීම
    async add(customerData) {
        try {
            const { CustomerName, NIC, CustomerPhone, CustomerAddress, IsBlacklisted, BlacklistReason } = customerData;
            const nextId = await this.generateNextCustomerId();
            
            // true/false අගය 1/0 බවට පත් කිරීම
            const blacklistStatus = IsBlacklisted ? 1 : 0;
            // Blacklist නොවේ නම් reason එක null ලෙස තැබීම
            const reason = IsBlacklisted ? BlacklistReason : null;

            const sql = `
                INSERT INTO customers 
                (CustomerID, CustomerName, NIC, CustomerPhone, CustomerAddress, IsBlacklisted, BlacklistReason) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;

            await db.execute(sql, [nextId, CustomerName, NIC, CustomerPhone, CustomerAddress, blacklistStatus, reason]);
            
            return { success: true, newId: nextId };
        } catch (error) {
            console.error("Add Customer Error:", error);
            return { success: false, message: error.message };
        }
    }

    // 4. පාරිභෝගික තොරතුරු යාවත්කාලීන කිරීම
    async update(customerData) {
        try {
            const { CustomerID, CustomerName, NIC, CustomerPhone, CustomerAddress, IsBlacklisted, BlacklistReason } = customerData;
            const blacklistStatus = IsBlacklisted ? 1 : 0;
            const reason = IsBlacklisted ? BlacklistReason : null;

            const sql = `
                UPDATE customers 
                SET CustomerName = ?, NIC = ?, CustomerPhone = ?, CustomerAddress = ?, 
                    IsBlacklisted = ?, BlacklistReason = ? 
                WHERE CustomerID = ?`;

            await db.execute(sql, [CustomerName, NIC, CustomerPhone, CustomerAddress, blacklistStatus, reason, CustomerID]);
            
            return { success: true };
        } catch (error) {
            console.error("Update Customer Error:", error);
            return { success: false, message: error.message };
        }
    }

// 5. පාරිභෝගිකයෙකු පද්ධතියෙන් ඉවත් කිරීම (Manual Cascade Delete)
    async delete(customerId) {
        let conn;
        try {
            conn = await db.getConnection();
            await conn.beginTransaction(); // Transaction එකක් ආරම්භ කිරීම

            // 1. පාරිභෝගිකයාට අදාළ සියලුම ණය ID ලබා ගැනීම
            const [loans] = await conn.query('SELECT LoanID FROM loans WHERE CustomerID = ?', [customerId]);
            
            if (loans.length > 0) {
                const loanIds = loans.map(l => l.loanID);

                // 2. ණය වලට අදාළ අනු-වගු (Sub-tables) මැකීම
                // (Note: Schema එකේ cascade තියෙනවා නම් මේවා ඕන නැහැ, හැබැයි වැඩ නැති නිසා අපි මෙහෙම කරමු)
                await conn.query('DELETE FROM payment_history WHERE LoanID IN (?)', [loanIds]);
                await conn.query('DELETE FROM vehicle_details WHERE LoanID IN (?)', [loanIds]);
                await conn.query('DELETE FROM land_details WHERE LoanID IN (?)', [loanIds]);
                await conn.query('DELETE FROM check_details WHERE LoanID IN (?)', [loanIds]);
                await conn.query('DELETE FROM promissory_details WHERE LoanID IN (?)', [loanIds]);
                await conn.query('DELETE FROM loan_beneficiaries WHERE LoanID IN (?)', [loanIds]);
                
                // 3. ණය (Loans) මැකීම
                await conn.query('DELETE FROM loans WHERE CustomerID = ?', [customerId]);
            }

            // 4. අවසානයේ පාරිභෝගිකයාව මැකීම
            const [result] = await conn.query('DELETE FROM customers WHERE CustomerID = ?', [customerId]);

            await conn.commit(); // සියල්ල සාර්ථක නම් දත්ත ස්ථිරවම මකන්න

            if (result.affectedRows === 0) {
                return { success: false, message: "මෙම පාරිභෝගිකයා සොයාගත නොහැක." };
            }

            return { success: true, message: "සියලුම දත්ත සාර්ථකව ඉවත් කරන ලදී." };

        } catch (error) {
            if (conn) await conn.rollback(); // දෝෂයක් ආවොත් වෙනස්කම් අවලංගු කරන්න
            console.error("Delete Customer Error:", error);
            return { success: false, message: "දෝෂය: " + error.message };
        } finally {
            if (conn) conn.release();
        }
    }

    // 6. පාරිභෝගිකයින් සෙවීම (Search)
    async searchCustomer(query) {
        try {
            const sql = `
                SELECT * FROM customers 
                WHERE CustomerID = ? 
                OR CustomerName LIKE ? 
                OR NIC = ?
            `;
            const searchQuery = `%${query}%`; 
            const [rows] = await db.execute(sql, [query, searchQuery, query]);
            return rows; 
        } catch (error) {
            console.error("Search Customer Error:", error);
            throw error;
        }
    }
}

export default new CustomerService();