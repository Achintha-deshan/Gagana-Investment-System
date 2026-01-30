import { ipcMain } from 'electron';
import db from '../config/db.js'; // උඹේ db.js එක තියෙන තැන

export function registerStatusHandlers() {
    ipcMain.handle('db:check-status', async () => {
        let conn;
        try {
            // Pool එකෙන් connection එකක් අරන් බලනවා
            conn = await db.getConnection();
            await conn.ping(); 
            
            return { success: true, status: 'online' };
        } catch (err) {
            console.error("❌ DB Status Check Error:", err.code);

            // සර්වර් එකේ අවුලක් නම් (Provide.lk issues)
            const repairErrors = ['ETIMEDOUT', 'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR'];
            
            if (repairErrors.includes(err.code)) {
                return { success: false, status: 'repair', message: 'Server under maintenance' };
            }

            // වෙනත් ඕනෑම connection error එකක්
            return { success: false, status: 'offline', message: err.message };
        } finally {
            if (conn) conn.release(); 
        }
    });
}