//Lan Loarn Controller
import { ipcMain } from "electron";
import LanLoanService  from "../services/LanLoanService.js";

export function registerLandLoanHandlers() {
    // 🔹 Get all Land loans
        ipcMain.handle('land-loans:get-all', () =>
            LanLoanService.getAllLandLoans()
        );
    
        // 🔹 Get next Vehicle Loan ID
        ipcMain.handle('land-loans:get-next-id', () =>
            LanLoanService.generateNextLanLoanId()
        );
    
        // 🔹 Add vehicle loan
        ipcMain.handle('land-loans:add', (event, data) =>
            LanLoanService.addLanLoan(data)
        );
    
        // 🔹 Update vehicle loan
        ipcMain.handle('land-loans:update', (event, data) =>
            LanLoanService.updateLanLoan(data)
        );
            
            ipcMain.handle('land-loans:delete', async (event, loanId) => {
            // නිවැරදි function නම (deleteLandLoan)
            return await LanLoanService.deleteLandLoan(loanId); 
        });
            
        // 🔹 Add beneficiary check if active
        ipcMain.handle('land-loans:check-beneficiary-active', async (event, {name, phone}) =>
            LanLoanService.checkBeneficiaryActive(name, phone)
        );
    
    
        // 🔹 Get beneficiaries by LoanID
        ipcMain.handle('land-loans:get-beneficiaries', (event, loanId) =>
            LanLoanService.getBeneficiaries(loanId)
        );
    
        // 🔹 Delete beneficiary
        ipcMain.handle('land-loans:delete-beneficiary', (event, beneficiaryId) =>
            LanLoanService.deleteBeneficiary(beneficiaryId)
        );

        ipcMain.handle('land-loans:get-by-id', async (event, loanId) => {
    return await LanLoanService.getLandLoanById(loanId);
});
}

