import db from '../config/db.js';

class CustomerService {
    // ඊළඟ Customer ID එක සාදා ගැනීම
    async generateNextCustomerId() {
        const [rows] = await db.execute('SELECT CustomerID FROM customers ORDER BY CustomerID DESC LIMIT 1');
        if (rows.length === 0) return 'C001';

        const lastId = rows[0].CustomerID;
        const lastNumber = parseInt(lastId.substring(1));
        return 'C' + (lastNumber + 1).toString().padStart(3, '0');
    }

    async getAll() {
        // අලුත්ම පාරිභෝගිකයා මුලට එන සේ ලබා ගැනීම
        const [rows] = await db.execute('SELECT * FROM customers ORDER BY CustomerID DESC');
        return rows;
    }

    async add(customerData) {
        const { CustomerName, NIC, CustomerPhone, CustomerAddress, IsBlacklisted } = customerData;
        const nextId = await this.generateNextCustomerId();
        
        // true/false අගය 1/0 බවට පත් කිරීම
        const blacklistStatus = IsBlacklisted ? 1 : 0;

        await db.execute(
            'INSERT INTO customers (CustomerID, CustomerName, NIC, CustomerPhone, CustomerAddress, IsBlacklisted) VALUES (?, ?, ?, ?, ?, ?)',
            [nextId, CustomerName, NIC, CustomerPhone, CustomerAddress, blacklistStatus]
        );
        return { success: true, newId: nextId };
    }

    async update(customerData) {
        const { CustomerID, CustomerName, NIC, CustomerPhone, CustomerAddress, IsBlacklisted } = customerData;
        const blacklistStatus = IsBlacklisted ? 1 : 0;

        await db.execute(
            'UPDATE customers SET CustomerName = ?, NIC = ?, CustomerPhone = ?, CustomerAddress = ?, IsBlacklisted = ? WHERE CustomerID = ?',
            [CustomerName, NIC, CustomerPhone, CustomerAddress, blacklistStatus, CustomerID]
        );
        return { success: true };
    }

    async delete(customerId) {
        await db.execute('DELETE FROM customers WHERE CustomerID = ?', [customerId]);
        return { success: true };
    }

    async searchCustomer(query) {
        const sql = `
            SELECT * FROM customers 
            WHERE CustomerID = ? 
            OR CustomerName LIKE ? 
            OR NIC = ?
        `;
        const searchQuery = `%${query}%`; 
        const [rows] = await db.execute(sql, [query, searchQuery, query]);
        return rows; 
    }
}

export default new CustomerService();