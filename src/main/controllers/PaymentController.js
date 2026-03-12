import { ipcMain } from 'electron';
import loanPaymentService from '../services/loanPaymentService.js';

export function registerPaymentHandlers() {
    
    // 1. Master Loan එක සහ ඒ යටතේ ඇති සියලුම Sub-loans ලබා ගැනීම
    // (Payment.js හි "window.api.payment.getLoanWithSubLoans" සඳහා)
    ipcMain.handle('payment:getLoanWithSubLoans', async (event, masterLoanId) => {
        try {
            return await loanPaymentService.getLoanWithSubLoans(masterLoanId);
        } catch (error) {
            console.error("IPC Error (getLoanWithSubLoans):", error);
            return null;
        }
    });

    // 2. තෝරාගත් දිනයට අදාළව පොලිය සහ දඩ ගණනය කිරීම
    // (Payment.js හි "window.api.payment.getSubLoanBreakdown" සඳහා)
    ipcMain.handle('payment:getSubLoanBreakdown', async (event, { disbursementId, customDate }) => {
        try {
            return await loanPaymentService.getSubLoanBreakdown(disbursementId, customDate);
        } catch (error) {
            console.error("IPC Error (getSubLoanBreakdown):", error);
            return null;
        }
    });

    // 3. ගෙවීමක් සිදු කිරීම
    ipcMain.handle('payment:process', async (event, paymentData) => {
        try {
            return await loanPaymentService.processPayment(paymentData);
        } catch (error) {
            console.error("IPC Error (processPayment):", error);
            return { success: false, error: error.message };
        }
    });

ipcMain.handle('payment:getHistory', async (event, disbursementId) => {
    try {
        return await loanPaymentService.getPaymentHistory(disbursementId);
    } catch (error) {
        console.error("IPC Error (getHistory):", error);
        return [];
    }
});

    // 5. ගෙවීමක් අවලංගු කිරීම (Void Payment)
    ipcMain.handle('payment:void', async (event, paymentId) => {
        try {
            return await loanPaymentService.voidPayment(paymentId);
        } catch (error) {
            console.error("IPC Error (voidPayment):", error);
            return { success: false, error: error.message };
        }
    });

    // 6. පියවීම් (Settlement) සඳහා සෙවීම
    ipcMain.handle('settlement:searchLoan', async (event, searchText) => {
        try {
            return await loanPaymentService.searchSettlement(searchText);
        } catch (error) {
            console.error("IPC Error (searchLoan):", error);
            return [];
        }
    });

    // 7. Master Loan එකක සම්පූර්ණ හිඟ මුදල (Total Due) ලබා ගැනීම
    ipcMain.handle('payment:getTotalOutstandingForMaster', async (event, masterLoanId) => {
        try {
            return await loanPaymentService.getTotalOutstandingForMaster(masterLoanId);
        } catch (error) {
            console.error("IPC Error (getTotalOutstandingForMaster):", error);
            return { success: false, totalOutstanding: 0 };
        }
    });
}