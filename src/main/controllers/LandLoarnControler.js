// ============================================================
// landLoanHandlers.js — IPC Handlers for Land Loans
// main.js ට import කරලා registerLandLoanHandlers() call කරන්න
// ============================================================

import { ipcMain } from 'electron';
import LanLoanService from '../services/LanLoanService.js';

export function registerLandLoanHandlers() {

    // Next ID
    ipcMain.handle('land-loans:get-next-id', () =>
        LanLoanService.generateNextLanLoanId()
    );

    // Get All (customer filter සඳහා)
    ipcMain.handle('land-loans:get-all', () =>
        LanLoanService.getAllLandLoans()
    );

    // Get By ID (Sub Loans + Beneficiaries සහිතව)
    ipcMain.handle('land-loans:get-by-id', async (_, loanId) =>
        LanLoanService.getLandLoanById(loanId)
    );

    // Add New Master Loan + Sub #1
    ipcMain.handle('land-loans:add', (_, data) =>
        LanLoanService.addLanLoan(data)
    );

    // Add Sub Loan (Top-up)  ← preload එකේ addSub call කරනවා
    ipcMain.handle('land-loans:add-sub', (_, data) =>
        LanLoanService.addSubLoan(data)
    );

    // Update Land Details
    ipcMain.handle('land-loans:update', (_, data) =>
        LanLoanService.updateLanLoan(data)
    );

    // Delete Sub Loan
    ipcMain.handle('land-loans:delete-sub', (_, loanId, disbursementId) =>
        LanLoanService.deleteSubLoan(loanId, disbursementId)
    );

    // Delete Full Account
    ipcMain.handle('land-loans:delete', (_, loanId) =>
        LanLoanService.deleteLandLoan(loanId)
    );

    // Beneficiary active check
    ipcMain.handle('land-loans:check-beneficiary-active', (_, { name, phone }) =>
        LanLoanService.checkBeneficiaryActive(name, phone)
    );

    // Get beneficiaries
    ipcMain.handle('land-loans:get-beneficiaries', (_, loanId) =>
        LanLoanService.getBeneficiaries(loanId)
    );

    // Delete single beneficiary
    ipcMain.handle('land-loans:delete-beneficiary', (_, beneficiaryId) =>
        LanLoanService.deleteBeneficiary(beneficiaryId)
    );
}