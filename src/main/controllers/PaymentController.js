import { ipcMain } from 'electron';
// පාරිභෝගිකයාගේ Service එකත් අවශ්‍ය වෙයි නම් මෙතනට එකතු කරගන්න
import loanPaymentService from '../services/loanPaymentService.js';

export function registerPaymentHandlers() {
    
    // 1. පාරිභෝගිකයාගේ සක්‍රීය ණය ලබා ගැනීම
    ipcMain.handle('payment:getActiveLoans', async (event, customerId) => {
        try {
            // මෙහිදී 'loanPaymentService' ලෙස import කළ නමම භාවිතා කරන්න
            return await loanPaymentService.getActiveLoans(customerId);
        } catch (error) {
            console.error("IPC Error (getActiveLoans):", error);
            return { success: false, error: error.message };
        }
    });

    // 2. ගෙවීම් වාර්තා කිරීම (Process Payment)
    ipcMain.handle('payment:process', async (event, paymentData) => {
        try {
            return await loanPaymentService.processPayment(paymentData);
        } catch (error) {
            console.error("IPC Error (processPayment):", error);
            return { success: false, error: error.message };
        }
    });

    // 3. (අමතර) යම් ණයක ගෙවීම් ඉතිහාසය බැලීමට අවශ්‍ය නම්
    ipcMain.handle('payment:getHistory', async (event, loanId) => {
        try {
            return await loanPaymentService.getPaymentHistory(loanId);
        } catch (error) {
            console.error("IPC Error (getHistory):", error);
            return { success: false, error: error.message };
        }
    });
    // PaymentController.js ඇතුළත
ipcMain.handle('payment:void', async (event, paymentId) => {
    try {
        return await loanPaymentService.voidPayment(paymentId);
    } catch (error) {
        return { success: false, error: error.message };
    }
});
}