import { app, BrowserWindow } from 'electron';
import 'dotenv/config';
import { createMainWindow } from './window.js';
import db from './config/db.js'; // 🔹 Database එක import කරගන්න

// Controllers
import { registerUserHandlers } from './controllers/UserController.js';
import { registerCustomerHandlers } from './controllers/CustomerController.js';
import { registerEmployeeHandlers } from './controllers/EmployeeController.js';
import { registerVehicleLoanHandlers } from './controllers/VehicleLoarnController.js';
import {registerPaymentHandlers} from './controllers/PaymentController.js';
import { registerLandLoanHandlers } from './controllers/LandLoarnControler.js';
import { registerPromissoryLoanHandlers} from './controllers/PromissoryLoanController.js';
import { registerCheckLoanHandlers } from './controllers/CheckLoanController.js';
import { registerReportHandlers } from './controllers/ReportController.js';
import { registerLoanLookupHandlers } from './controllers/LoanLookupController.js';
import { setupSMSHandlers } from './controllers/smsController.js';
import { registerDashbordHandlers } from './controllers/DashbordController.js'; //
import { registerStatusHandlers } from './controllers/SystemStatusController.js';

// SMS Handlers register කිරීම


async function startApp() {
    try {
        // 1. මුලින්ම Database එක සහ Tables ටික හදන්න (Wait කරන්න)
        console.log("Initializing Database...");
        await db.initialize(); 

        // 2. ඊට පස්සේ විතරක් Handlers (IPC) Register කරන්න
        console.log("Registering Handlers..."); 
         
        registerUserHandlers();
        registerCustomerHandlers();
        registerEmployeeHandlers();
        registerVehicleLoanHandlers();
        registerPaymentHandlers();
        registerLandLoanHandlers();
        registerPromissoryLoanHandlers();
        registerCheckLoanHandlers();
        registerReportHandlers();
        registerLoanLookupHandlers();
        setupSMSHandlers();
        registerDashbordHandlers();
        registerStatusHandlers();

        // 3. අවසානයට Window එක create කරන්න
        createMainWindow();

    } catch (error) {
        console.error("❌ App Startup Error:", error);
    }
}

// --- Single Instance Lock (App එක දෙපාරක් විවෘත වීම වැළැක්වීම) ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // දැනටමත් App එක විවෘත වී ඇත්නම් අලුත් එක වසා දමන්න
    app.quit();
} else {
    // වෙනත් පාරක් විවෘත කිරීමට උත්සාහ කළහොත් දැනට ඇති වින්ඩෝව පෙන්වන්න
    app.on('second-instance', () => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Electron සූදානම් වූ පසු පද්ධතිය ආරම්භ කරන්න
    app.whenReady().then(() => {
        startApp();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});