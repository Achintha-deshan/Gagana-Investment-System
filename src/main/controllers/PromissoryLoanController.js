import { ipcMain } from "electron";
import PromissoryLoanService from "../services/PromissoryLoanService.js";

export function registerPromissoryLoanHandlers() {
    // 🔹 සියලුම Promissory Loans ලබා ගැනීම
    ipcMain.handle('prm-loans:get-all', () => 
        PromissoryLoanService.getAllPromissoryLoans()
    );

    // 🔹 මීළඟ PRM ID එක ලබා ගැනීම
    ipcMain.handle('prm-loans:get-next-id', () => 
        PromissoryLoanService.generateNextPromissoryId()
    );

    // 🔹 නව Promissory Loan එකක් ඇතුළත් කිරීම
    ipcMain.handle('prm-loans:add', (event, data) => 
        PromissoryLoanService.addPromissoryLoan(data)
    );

    // 🔹 Promissory Loan එකක් Update කිරීම
    ipcMain.handle('prm-loans:update', (event, data) => 
        PromissoryLoanService.updatePromissoryLoan(data)
    );

    // 🔹 Promissory Loan එකක් මකා දැමීම
    ipcMain.handle('prm-loans:delete', (event, loanId) => 
        PromissoryLoanService.deletePromissoryLoan(loanId)
    );

    // 🔹 ඇපකරු සක්‍රීයදැයි පරීක්ෂා කිරීම
    ipcMain.handle('prm-loans:check-beneficiary-active', (event, { name, phone }) => 
        PromissoryLoanService.checkBeneficiaryActive(name, phone)
    );

// Controller තුළ තිබිය යුතු ආකාරය
ipcMain.handle('prm-loans:get-by-id', async (event, loanId) => {
    return await PromissoryLoanService.getPromissoryLoanById(loanId);
});
}