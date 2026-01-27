import db from '../config/db.js';

class CustomerService {
    
    // 1. ඊළඟ Customer ID එක සාදා ගැනීම (C001, C002...)
    async generateNextCustomerId() {
        try {
            const [rows] = await db.execute('SELECT CustomerID FROM customers ORDER BY CustomerID DESC LIMIT 1');
            if (rows.length === 0) return 'C001';

            const lastId = rows[0].CustomerID;
            const lastNumber = parseInt(lastId.substring(1));
            return 'C' + (lastNumber + 1).toString().padStart(3, '0');
        } catch (error) {
            console.error("ID Generation Error:", error);
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

    // 5. පාරිභෝගිකයෙකු පද්ධතියෙන් ඉවත් කිරීම
    async delete(customerId) {
        try {
            await db.execute('DELETE FROM customers WHERE CustomerID = ?', [customerId]);
            return { success: true };
        } catch (error) {
            console.error("Delete Customer Error:", error);
            return { success: false, message: error.message };
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