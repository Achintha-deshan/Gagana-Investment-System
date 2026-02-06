import { ipcMain } from 'electron';
import BackupService from '../services/BackupService.js';

/**
 * බැකප් එකට අදාළ IPC Handlers මෙහි ලියාපදිංචි කෙරේ.
 */
export function registerBackupHandlers() {
    
    // 🔹 Frontend එකේ window.api.system.runBackup කැඳවූ විට මෙය ක්‍රියාත්මක වේ.
    ipcMain.handle('system:run-backup', async (event, { year, month }) => {
        try {
            // Service එක හරහා බැකප් එක සිදු කිරීම
            const result = await BackupService.runMonthlyBackup(year, month);
            return result;
        } catch (error) {
            console.error("IPC Backup Handler Error:", error);
            return { success: false, error: error.message };
        }
    });
}