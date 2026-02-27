import { ipcMain } from 'electron';
import vehicleLoanService from '../services/VehicleLoanService.js';

export function registerVehicleLoanHandlers() {

    // 1. සියලුම වාහන ණය ලබා ගැනීම (Cards පෙන්වීම සඳහා)
    ipcMain.handle('vehicle-loans:get-all', async () => {
        try {
            return await vehicleLoanService.getAllVehicleLoans();
        } catch (error) {
            console.error("IPC Error (get-all):", error);
            return { success: false, error: error.message };
        }
    });

    // 2. පවතින ණයකට අලුත් Sub-loan එකක් එකතු කිරීම (මෙය අලුතින් එක් කරන ලදී)
    ipcMain.handle('vehicle-loans:add-sub', async (event, data) => {
        try {
            return await vehicleLoanService.addSubLoan(data);
        } catch (error) {
            console.error("IPC Error (add-sub):", error);
            return { success: false, error: error.message };
        }
    });

    // 3. අලුත්ම වාහන ණය ගිණුමක් ආරම්භ කිරීම (VLI අංකය සමඟ)
    ipcMain.handle('vehicle-loans:add', async (event, data) => {
        try {
            return await vehicleLoanService.addVehicleLoan(data);
        } catch (error) {
            console.error("IPC Error (add):", error);
            return { success: false, error: error.message };
        }
    });

    // 4. නිශ්චිත ණය ID එකකට අදාළ සියලුම විස්තර (Sub-loans 5, Beneficiaries) ලබා ගැනීම
    ipcMain.handle('vehicle-loans:get-by-id', async (event, loanId) => {
        try {
            return await vehicleLoanService.getVehicleLoanById(loanId);
        } catch (error) {
            console.error("IPC Error (get-by-id):", error);
            return { success: false, error: error.message };
        }
    });

    // 5. ඊළඟට එන Loan ID එක (VLIxxxxx) ලබා ගැනීම
    ipcMain.handle('vehicle-loans:get-next-id', async () => {
        try {
            return await vehicleLoanService.generateNextLoanId();
        } catch (error) {
            console.error("IPC Error (get-next-id):", error);
            return { success: false, error: error.message };
        }
    });

    // 6. වාහන ණය විස්තර යාවත්කාලීන කිරීම (Update)
    ipcMain.handle('vehicle-loans:update', async (event, data) => {
        try {
            return await vehicleLoanService.updateVehicleLoan(data);
        } catch (error) {
            console.error("IPC Error (update):", error);
            return { success: false, error: error.message };
        }
    });

    // 7. ණයක් සම්පූර්ණයෙන්ම මැකීම
    ipcMain.handle('vehicle-loans:delete', async (event, loanId) => {
        try {
            return await vehicleLoanService.deleteVehicleLoan(loanId);
        } catch (error) {
            console.error("IPC Error (delete):", error);
            return { success: false, error: error.message };
        }
    });

    // 8. ඇපකරුවෙකු දැනටමත් වෙනත් සක්‍රීය ණයකට සම්බන්ධ දැයි බැලීම
    ipcMain.handle('vehicle-loans:check-beneficiary-active', async (event, { name, phone }) => {
        try {
            return await vehicleLoanService.checkBeneficiaryActive(name, phone);
        } catch (error) {
            console.error("IPC Error (check-beneficiary):", error);
            return false; 
        }
    });

    // 9. සබ් ලෝන් එකක් පමණක් මැකීම (මෙය අලුතින් එක් කරන ලදී)
    ipcMain.handle('vehicle-loans:delete-sub', async (event, loanId, disbursementId) => {
        try {
            return await vehicleLoanService.deleteSubLoan(loanId, disbursementId);
        } catch (error) {
            console.error("IPC Error (delete-sub):", error);
            return { success: false, error: error.message };
        }
    });
}