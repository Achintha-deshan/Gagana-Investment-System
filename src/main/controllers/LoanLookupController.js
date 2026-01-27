import { ipcMain } from "electron";
import LoanLookupService from "../services/LoanLookupService.js";

/**
 * Loan Lookup සම්බන්ධ IPC Handlers ලියාපදිංචි කිරීම
 */
export function registerLoanLookupHandlers() {
    
    // ණය අංකය (LoanID) අනුව සම්පූර්ණ විශ්ලේෂණය ලබා ගැනීම
    ipcMain.handle('lookup:get-details', async (event, loanId) => {
        try {
            return await LoanLookupService.getDetailedBreakdown(loanId);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // පාරිභෝගිකයාගේ සියලුම ණය ලැයිස්තුව ලබා ගැනීම
    ipcMain.handle('lookup:get-customer-loans', async (event, customerId) => {
        try {
            return await LoanLookupService.getCustomerLoans(customerId);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}