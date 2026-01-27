import { ipcMain } from 'electron';
import SMSService from '../services/smsService.js';

export function setupSMSHandlers() {
    
    // ස්වයංක්‍රීයව SMS පරීක්ෂා කර යැවීම
    ipcMain.handle('sms:runAutoCheck', async () => {
        return await SMSService.checkAndSendDailyReminders();
    });

    // මැනුවල් ලෙස SMS එකක් යැවීම
    ipcMain.handle('sms:sendManual', async (event, { recipient, message }) => {
        return await SMSService.sendSMS(recipient, message);
    });

    // අද දින යැවූ SMS වාර්තා (Logs) ලබා ගැනීම - අලුතින් එක් කළ කොටස
    ipcMain.handle('sms:getTodayLogs', async () => {
        try {
            return await SMSService.getTodayLogs();
        } catch (error) {
            console.error("IPC Handle Error (sms:getTodayLogs):", error);
            throw error;
        }
    });
}