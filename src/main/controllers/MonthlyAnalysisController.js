import { ipcMain } from "electron";
import MonthlyAnalysisService from "../services/MonthlyAnalysisService.js";

export function registerMonthlyAnalysisHandlers() {
    // 🔹 වාර්තාවට අවශ්‍ය දත්ත ලබා ගැනීම (Renderer එකේ Table එක පිරවීමට)
    ipcMain.handle('monthly-analysis:get-data', async (event, { year, month }) => {
        try {
            return await MonthlyAnalysisService.getMonthlyProfitData(year, month);
        } catch (error) {
            console.error("Controller Error (Get Data):", error);
            return { success: false, error: error.message };
        }
    });

    // 🔹 PDF වාර්තාව නිපදවා සුරැකීම
    ipcMain.handle('monthly-analysis:generate-pdf', async (event, { year, month }) => {
        try {
            return await MonthlyAnalysisService.generateMonthlyProfitPDF(year, month);
        } catch (error) {
            console.error("Controller Error (PDF):", error);
            return { success: false, error: error.message };
        }
    });
}