import { ipcMain } from 'electron';
import migrationService from '../services/MigrationService.js'; 

export function registerMigrationHandlers() {
    /**
     * පරණ දත්ත ඇතුළත් කිරීමේ ප්‍රධාන Handler එක
     */
    ipcMain.handle('migration:insertOldLoan', async (event, payload) => {
        try {
            // මෙහිදී payload එක ඇතුළේ loanID, customerID, loanType, subLoan, typeDetails අඩංගු විය යුතුයි
            const result = await migrationService.insertOldLoan(payload);
            return result;
        } catch (error) {
            console.error("IPC Migration Error:", error);
            return { 
                success: false, 
                error: error.message || "දත්ත ඇතුළත් කිරීමේදී පද්ධති දෝෂයක් සිදුවිය." 
            };
        }
    });

    /**
     * අවශ්‍ය නම් Customer කෙනෙකුගේ දැනට පවතින Loan IDs පරීක්ෂා කිරීමට (Duplicate වැළැක්වීමට)
     */
    ipcMain.handle('migration:checkLoanID', async (event, loanID) => {
        try {
            // DB එකේ මෙම ID එක දැනටමත් තියෙනවද කියා බැලීමට (Optional logic)
            // const exists = await migrationService.checkIfLoanExists(loanID);
            // return exists;
            return false; 
        } catch (error) {
            return { error: error.message };
        }
    });
}