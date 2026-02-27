import { ipcMain } from 'electron';
import BackupService from '../services/BackupService.js';

export function registerBackupHandlers() {

    // PDF Monthly Report Backup
    ipcMain.handle('system:run-backup', async (_event, params) => {
        try {
            // Preload: ipcRenderer.invoke('system:run-backup', { year, month })
            // ∴ params = { year, month }
            const y = parseInt(params?.year);
            const m = parseInt(params?.month);

            if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
                return { success: false, error: `Invalid year/month: ${params?.year}/${params?.month}` };
            }

            console.log(`📄 Starting PDF Backup: ${y}/${String(m).padStart(2,'0')}`);
            const result = await BackupService.runMonthlyBackup(y, m);
            
            if (result.success) {
                console.log(`✅ PDF saved: ${result.path}`);
            } else {
                console.error(`❌ PDF failed: ${result.error}`);
            }

            return result;

        } catch (err) {
            console.error('BackupController Error:', err);
            return { success: false, error: err.message };
        }
    });
}