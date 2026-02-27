import { ipcMain } from 'electron';
import settlementService from '../services/SettlementService.js';

export function registerSettlementHandlers() {

    // 1. ණය සෙවීම (Search)
    // සටහන: Preload එකේ settlement:search ලෙස ඇත්නම් නම එයට ගැලපිය යුතුයි
    ipcMain.handle('settlement:search', async (_e, query) => {
        try {
            return await settlementService.searchLoansForSettlement(query);
        } catch (err) {
            console.error('IPC settlement:search error:', err);
            return [];
        }
    });

    // 2. දින ගණන අනුව පොලිය සහ ගෙවිය යුතු මුදල ගණනය කිරීම (Breakdown)
    // මෙය ඉතා වැදගත් - Card එක click කළ විට වැඩ කරන්නේ මෙයයි
    ipcMain.handle('settlement:get-breakdown', async (_e, disbursementId) => {
        try {
            return await settlementService.getSettlementBreakdown(disbursementId);
        } catch (err) {
            console.error('IPC settlement:get-breakdown error:', err);
            return { success: false, error: err.message };
        }
    });

    // 3. සම්පූර්ණ පියවීම සිදු කිරීම (Process)
    ipcMain.handle('settlement:process', async (_e, data) => {
        try {
            return await settlementService.processSettlement(data);
        } catch (err) {
            console.error('IPC settlement:process error:', err);
            return { success: false, error: err.message };
        }
    });

    // 4. පියවීමක් අවලංගු කිරීම (Void)
    // සටහන: ඔබ කලින් payment:void ලෙස දමා තිබුණත්, settlement:void ලෙස තැබීම වඩාත් පැහැදිලියි
    ipcMain.handle('settlement:void', async (_e, paymentId) => {
        try {
            return await settlementService.voidSettlement(paymentId);
        } catch (err) {
            console.error('IPC settlement:void error:', err);
            return { success: false, error: err.message };
        }
    });

    console.log('✅ Settlement handlers registered successfully');
}