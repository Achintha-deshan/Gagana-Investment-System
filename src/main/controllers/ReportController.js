import { ipcMain } from "electron";
import ReportService from "../services/ReportService.js";

export function registerReportHandlers() {
    // සාරාංශ දත්ත ලබා ගැනීම
    ipcMain.handle('reports:get-summary', () => ReportService.getDashboardSummary());

    // හිඟ වාරික වාර්තාව
    ipcMain.handle('reports:get-arrears', () => ReportService.getArrearsReport());

    // ගෙවීම් වාර්තාව
    ipcMain.handle('reports:get-collection', (event, { start, end }) => 
        ReportService.getCollectionReport(start, end)
    );

    // පියවා අවසන් කළ ණය වාර්තාව
    ipcMain.handle('reports:get-settled', (event, { start, end }) => 
        ReportService.getSettledLoansReport(start, end)
    );

    // ReportController.js තුළ
    ipcMain.handle('reports:get-aging', async (event, testDate) => {
        return await ReportService.getLoanAgingData(testDate);
    });
}