import { app, BrowserWindow } from 'electron';
import 'dotenv/config';
import { createMainWindow } from './window.js';
import db from './config/db.js'; 

// Controllers
import { registerUserHandlers } from './controllers/UserController.js';
import { registerCustomerHandlers } from './controllers/CustomerController.js';
import { registerVehicleLoanHandlers } from './controllers/VehicleLoarnController.js';
import {registerPaymentHandlers} from './controllers/PaymentController.js';
import { registerLandLoanHandlers } from './controllers/LandLoarnControler.js';
import { registerPromissoryLoanHandlers} from './controllers/PromissoryLoanController.js';
import { registerCheckLoanHandlers } from './controllers/CheckLoanController.js';
import { registerLoanLookupHandlers } from './controllers/LoanLookupController.js';
import { setupSMSHandlers } from './controllers/smsController.js';
import { registerDashbordHandlers } from './controllers/DashbordController.js'; //
import { registerStatusHandlers } from './controllers/SystemStatusController.js';
import { registerBackupHandlers } from './controllers/BackupController.js';
import { registerMigrationHandlers } from './controllers/MigrationController.js'; 




async function startApp() {
    try {
        console.log("Initializing Database...");
        await db.initialize(); 

        console.log("Registering Handlers..."); 
         
        registerUserHandlers();
        registerCustomerHandlers();
        registerVehicleLoanHandlers();
        registerPaymentHandlers();
        registerLandLoanHandlers();
        registerPromissoryLoanHandlers();
        registerCheckLoanHandlers();
        registerLoanLookupHandlers();
        setupSMSHandlers();
        registerDashbordHandlers();
        registerStatusHandlers();
        registerBackupHandlers();
        registerMigrationHandlers();

        createMainWindow();

    } catch (error) {
        console.error("❌ App Startup Error:", error);
    }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

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