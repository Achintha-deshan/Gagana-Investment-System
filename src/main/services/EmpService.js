import db from '../config/db.js';

class EmployeeService {
    async generateNextEmployeeId() {
        const [rows] = await db.execute('SELECT EmployeeID FROM employee ORDER BY EmployeeID DESC LIMIT 1');
        if (rows.length === 0) return 'E001';

        const lastId = rows[0].EmployeeID;
        const lastNumber = parseInt(lastId.substring(1));
        return 'E' + (lastNumber + 1).toString().padStart(3, '0');
    }

    async getAll() {
        const [rows] = await db.execute('SELECT * FROM employee');
        return rows;
    }

    async add(employeeData) {
        const { EmployeeName, EmployeePhone, position } = employeeData;
        const nextId = await this.generateNextEmployeeId();
        
        await db.execute(
            'INSERT INTO employee (EmployeeID, EmployeeName, EmployeePhone, position) VALUES (?, ?, ?, ?)',
            [nextId, EmployeeName, EmployeePhone, position]
        );
        return { success: true, newId: nextId };
    }

    async update(employeeData) {
        const { EmployeeID, EmployeeName, EmployeePhone, position } = employeeData;
        await db.execute(
            'UPDATE employee SET EmployeeName = ?, EmployeePhone = ?, position = ? WHERE EmployeeID = ?',
            [EmployeeName, EmployeePhone, position, EmployeeID]
        );
        return { success: true };
    }

    async delete(employeeId) {
        await db.execute('DELETE FROM employee WHERE EmployeeID = ?', [employeeId]);
        return { success: true };
    }
}

export default new EmployeeService();