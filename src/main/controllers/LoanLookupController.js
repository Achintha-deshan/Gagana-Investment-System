import { ipcMain } from "electron";
import LoanLookupService from "../services/LoanLookupService.js";

export function registerLoanLookupHandlers() {
    
    // 1. සෙවුම් පියවර - නම, NIC හෝ ID එකෙන් Master Loans සොයයි
    ipcMain.handle('lookup:search-master', async (event, query) => {
        try {
            return await LoanLookupService.searchMasterLoans(query);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // 2. විශ්ලේෂණ පියවර - තෝරාගත් Master Loan එකක සම්පූර්ණ විස්තර ලබා ගනී
    ipcMain.handle('lookup:get-full-analysis', async (event, loanId) => {
        try {
            // මෙහිදී අපි කලින් ලියූ getFullLoanAnalysis function එක කැඳවයි
            return await LoanLookupService.getFullLoanAnalysis(loanId);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}