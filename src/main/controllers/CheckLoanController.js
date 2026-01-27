import { ipcMain } from "electron";
import CheckLoanService from "../services/CheckLoanService.js";

export function registerCheckLoanHandlers() {
    
    // 🔹 මීළඟ චෙක්පත් ණය ID එක ලබා ගැනීම (CHQ001...)
    ipcMain.handle('check-loan:get-next-id', () => 
        CheckLoanService.generateNextCheckLoanId()
    );

    // 🔹 නව චෙක්පත් ණයක් ඇතුළත් කිරීම
    ipcMain.handle('check-loan:add', (event, data) => 
        CheckLoanService.addCheckLoan(data)
    );

    // 🔹 සියලුම චෙක්පත් ණය වාර්තා ලබා ගැනීම
    ipcMain.handle('check-loan:get-all', () => 
        CheckLoanService.getAllCheckLoans()
    );

    // 🔹 චෙක්පත් ණය විස්තර යාවත්කාලීන කිරීම (Update)
    ipcMain.handle('check-loan:update', (event, data) => 
        CheckLoanService.updateCheckLoan(data)
    );

    // 🔹 සම්පූර්ණ ණය ගිණුම මකා දැමීම
    ipcMain.handle('check-loan:delete', (event, loanId) => 
        CheckLoanService.deleteCheckLoan(loanId)
    );

    // 🔹 එක් ණයකට අදාළ ඇපකරුවන් ලැයිස්තුව ලබා ගැනීම
    ipcMain.handle('check-loan:get-beneficiaries', (event, loanId) => 
        CheckLoanService.getBeneficiaries(loanId)
    );

    // 🔹 ඇපකරුවෙකු පද්ධතියෙන් මකා දැමීම
    ipcMain.handle('check-loan:delete-beneficiary', (event, beneficiaryId) => 
        CheckLoanService.deleteBeneficiary(beneficiaryId)
    );

    // 🔹 ඇපකරු දැනටමත් වෙනත් ACTIVE ණයක සිටීදැයි බැලීම
    ipcMain.handle('check-loan:check-active', (event, { name, phone }) => 
        CheckLoanService.checkBeneficiaryActive(name, phone)
    );

   // CheckLoanController.js තුළ
        ipcMain.handle('check-loan:get-by-id', async (event, loanId) => {
            return await CheckLoanService.getCheckLoanById(loanId); 
        });
}