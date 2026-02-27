import { ipcMain } from "electron";
import CheckLoanService from "../services/CheckLoanService.js";

export function registerCheckLoanHandlers() {
    
    // 1. ඊළඟ Loan ID එක ලබා ගැනීම (CHQ00001)
    ipcMain.handle('check-loan:get-next-id', () => 
        CheckLoanService.generateNextCheckLoanId()
    );

    // 2. අලුත් Master Loan + පළමු Sub Loan එක ඇතුළත් කිරීම
    ipcMain.handle('check-loan:add', (event, data) => 
        CheckLoanService.addCheckLoan(data)
    );

    // 3. පවතින Loan එකකට අලුතින් Sub Loan (Top-up) එකක් එකතු කිරීම
    ipcMain.handle('check-loan:add-sub-loan', (event, data) => 
        CheckLoanService.addSubLoan(data)
    );

    // 4. සියලුම Check Loans ලැයිස්තුව ලබා ගැනීම (Cards/Table සඳහා)
    ipcMain.handle('check-loan:get-all', () => 
        CheckLoanService.getAllCheckLoans()
    );

    // 5. නිශ්චිත ID එකකින් සම්පූර්ණ විස්තර ලබා ගැනීම
    ipcMain.handle('check-loan:get-by-id', async (event, loanId) => {
        return await CheckLoanService.getCheckLoanById(loanId); 
    });

    // 6. චෙක්පතේ විස්තර සහ ඇපකරුවන්ගේ විස්තර Update කිරීම
    ipcMain.handle('check-loan:update', (event, data) => 
        CheckLoanService.updateCheckLoan(data)
    );

    // 7. සම්පූර්ණ Loan එකම (Master + All Sub Loans) මකා දැමීම
    ipcMain.handle('check-loan:delete', (event, loanId) => 
        CheckLoanService.deleteCheckLoan(loanId)
    );

    // 8. නිශ්චිත Sub Loan එකක් පමණක් මකා දැමීම (Renumbering සහිතව)
    // මෙතනදී arguments විදිහට loanId එකයි, disbursementId එකයි දෙනවා
    ipcMain.handle('check-loan:delete-sub-loan', (event, loanId, disbursementId) => 
        CheckLoanService.deleteSubLoan(loanId, disbursementId)
    );

    // 9. ඇපකරුවෙකු දැනටමත් වෙනත් සක්‍රීය ණයක ඉන්නවාදැයි බැලීම
    ipcMain.handle('check-loan:check-active', (event, { name, phone }) => 
        CheckLoanService.checkBeneficiaryActive(name, phone)
    );

    // --- පරණ handlers තිබුනොත් මේවා අවශ්‍ය වෙන්න පුළුවන් (Optional) ---
    ipcMain.handle('check-loan:get-beneficiaries', (event, loanId) => 
        CheckLoanService.getBeneficiaries(loanId)
    );

    ipcMain.handle('check-loan:delete-beneficiary', (event, beneficiaryId) => 
        CheckLoanService.deleteBeneficiary(beneficiaryId)
    );
}