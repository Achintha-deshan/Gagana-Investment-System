import { ipcMain } from 'electron';
import vehicleLoanService from '../services/VehicleLoanService.js';

export function registerVehicleLoanHandlers() {

    // 🔹 Get all vehicle loans
    ipcMain.handle('vehicle-loans:get-all', () =>
        vehicleLoanService.getAllVehicleLoans()
    );

    // 🔹 Get next Vehicle Loan ID
    ipcMain.handle('vehicle-loans:get-next-id', () =>
        vehicleLoanService.generateNextLoanId()
    );

    // 🔹 Add vehicle loan
    ipcMain.handle('vehicle-loans:add', (event, data) =>
        vehicleLoanService.addVehicleLoan(data)
    );

    // 🔹 Update vehicle loan
    ipcMain.handle('vehicle-loans:update', (event, data) =>
        vehicleLoanService.updateVehicleLoan(data)
    );

    // 🔹 Delete vehicle loan
    ipcMain.handle('vehicle-loans:delete', (event, loanId) =>
        vehicleLoanService.deleteVehicleLoan(loanId)
    );

    // 🔹 Add beneficiary check if active
ipcMain.handle('vehicle-loans:check-beneficiary-active', async (event, {name, phone}) =>
    vehicleLoanService.checkBeneficiaryActive(name, phone)
);


    // 🔹 Get beneficiaries by LoanID
    ipcMain.handle('vehicle-loans:get-beneficiaries', (event, loanId) =>
        vehicleLoanService.getBeneficiaries(loanId)
    );

    // 🔹 Delete beneficiary
    ipcMain.handle('vehicle-loans:delete-beneficiary', (event, beneficiaryId) =>
        vehicleLoanService.deleteBeneficiary(beneficiaryId)
    );

    ipcMain.handle('vehicle-loans:get-by-id', async (event, loanId) => {
    return await vehicleLoanService.getVehicleLoanById(loanId);
});
}
