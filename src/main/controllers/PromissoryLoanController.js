import { ipcMain } from "electron";
import PromissoryLoanService from "../services/PromissoryLoanService.js";

export function registerPromissoryLoanHandlers() {
    ipcMain.handle('prm-loans:get-all', () => 
        PromissoryLoanService.getAllPromissoryLoans()
    );

    // මෙතැන නිවැරදි කරන ලදී: Service එකේ ඇත්තේ generateNextLoanId මිස generateNextPromissoryId නොවේ
    ipcMain.handle('prm-loans:get-next-id', () => 
        PromissoryLoanService.generateNextLoanId() 
    );

    ipcMain.handle('prm-loans:add', (event, data) => 
        PromissoryLoanService.addPromissoryLoan(data)
    );

    // කලින් මග හැරී තිබූ Handler එක:
    ipcMain.handle('prm-loans:add-sub-loan', (event, data) => 
        PromissoryLoanService.addSubLoan(data)
    );

    ipcMain.handle('prm-loans:update', (event, data) => 
        PromissoryLoanService.updatePromissoryLoan(data)
    );

    ipcMain.handle('prm-loans:delete', (event, loanId) => 
        PromissoryLoanService.deletePromissoryLoan(loanId)
    );

    ipcMain.handle('prm-loans:delete-sub-loan', (event, { loanId, disbursementId }) => 
        PromissoryLoanService.deleteSubLoan(loanId, disbursementId)
    );

    ipcMain.handle('prm-loans:check-beneficiary-active', (event, { name, phone }) => 
        PromissoryLoanService.checkBeneficiaryActive(name, phone)
    );

    ipcMain.handle('prm-loans:get-by-id', async (event, loanId) => {
        return await PromissoryLoanService.getPromissoryLoanById(loanId);
    });
}