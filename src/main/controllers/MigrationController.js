import { ipcMain } from 'electron';
import migrationService from '../services/MigrationService.js'; 

export function registerMigrationHandlers() {

    ipcMain.handle('migration:searchLoans', async (event, query) => {
        try {
            const results = await migrationService.getActiveLoansForMigration(query);
            return { success: true, loans: results };
        } catch (error) {
            console.error("IPC Error (migration:searchLoans):", error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('migration:process', async (event, migrationData) => {
        try {
            const result = await migrationService.processMigration(migrationData);
            return result;
        } catch (error) {
            console.error("IPC Error (migration:process):", error);
            return { success: false, error: error.message };
        }
    });
}