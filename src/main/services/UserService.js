// src/main/services/UserService.js
import db from '../config/db.js';
import bcrypt from 'bcryptjs';

class UserService {
    async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    }
    async getAllUsers() {
        const [rows] = await db.execute('SELECT UserID, Username, Phone, Role FROM Users');
        return rows;
    }

   async generateNextUserId() {
    // Database එකේ තියෙන ලොකුම UserID එක ගන්නවා
    const [rows] = await db.execute('SELECT UserID FROM Users ORDER BY UserID DESC LIMIT 1');
    
    if (rows.length === 0) {
        return 'U001'; // කිසිම user කෙනෙක් නැත්නම් පළමු ID එක
    }

    const lastId = rows[0].UserID; // උදා: 'U005'
    const lastNumber = parseInt(lastId.substring(1)); // 'U' අකුර අයින් කරලා අංකය විතරක් ගන්නවා (5)
    const nextNumber = lastNumber + 1; // ඊළඟ අංකය (6)
    
    // ආපහු 'U' අකුර එකතු කරලා ඉලක්කම් 3ක් වෙන විදිහට සකසනවා (U006)
    return 'U' + nextNumber.toString().padStart(3, '0');
}

async addUser(userData) {
    // UI එකෙන් එන UserID එක වෙනුවට අලුතෙන් generate කරපු ID එක ගන්නවා
    const nextId = await this.generateNextUserId();
    const { Username, Password, Phone, Role } = userData;
    
    const passwordHash = await this.hashPassword(Password);
    const [result] = await db.execute(
        'INSERT INTO Users (UserID, Username, PasswordHash, Phone, Role) VALUES (?, ?, ?, ?, ?)',
        [nextId, Username, passwordHash, Phone, Role]
    );
    
    return { success: true, newId: nextId };
}   

    async login(username, password) {
        const [users] = await db.execute('SELECT * FROM Users WHERE Username = ?', [username]);
        if (users.length === 0) return { success: false, error: "User not found" };

        const isMatch = await bcrypt.compare(password, users[0].PasswordHash);
        if (isMatch) {
            return { success: true, user: { Username: users[0].Username, Role: users[0].Role } };
        }
        return { success: false, error: "Invalid password" };
    }
    async updateUser(userData) {
        const { UserID, Username, Password, Phone, Role } = userData;
        if (Password) {
            // Password එකත් වෙනස් කරනවා නම්
            const passwordHash = await this.hashPassword(Password);
            return await db.execute(
                'UPDATE Users SET Username = ?, PasswordHash = ?, Phone = ?, Role = ? WHERE UserID = ?',
                [Username, passwordHash, Phone, Role, UserID]
            );
        } else {
            // Password එක වෙනස් කරන්නේ නැතිනම්
            return await db.execute(
                'UPDATE Users SET Username = ?, Phone = ?, Role = ? WHERE UserID = ?',
                [Username, Phone, Role, UserID]
            );
        }
    }

    // User කෙනෙක් ඉවත් කිරීම
    async deleteUser(userId) {
        return await db.execute('DELETE FROM Users WHERE UserID = ?', [userId]);
    }    

}

export default new UserService();