import { ipcMain } from 'electron';
import DashboardService from '../services/dashbordService.js';

export function registerDashbordHandlers() {
    ipcMain.handle('get-dashboard-stats', async () => {
        try {
            const stats = await DashboardService.getSuperDashboardStats();
            return stats;
        } catch (error) {
            console.error("IPC Handle Error (get-dashboard-stats):", error);
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