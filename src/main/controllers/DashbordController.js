import { ipcMain } from 'electron';
import DashboardService from '../services/dashbordService.js';

export function registerDashbordHandlers() {
  // Super Dashboard එකට අවශ්‍ය සියලුම සංඛ්‍යාලේඛන ලබා ගැනීම
    ipcMain.handle('get-dashboard-stats', async () => {
        try {
            // Dashboard Service එකෙන් Calculated Data ලබා ගනී
            const stats = await DashboardService.getSuperDashboardStats();
            return stats;
        } catch (error) {
            console.error("IPC Handle Error (get-dashboard-stats):", error);
            // දෝෂයක් ඇති වුවහොත් හිස් දත්ත මාලාවක් ලබා දෙයි
            return {
                capitalOut: 0,
                interestTarget: 0,
                interestReceived: 0,
                blacklistedCount: 0,
                totalCustomers: 0,
                portfolio: [],
                recentLoans: []
            };
        }
    });
}