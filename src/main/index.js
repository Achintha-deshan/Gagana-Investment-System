import { app, BrowserWindow } from 'electron';
import 'dotenv/config';
import { createMainWindow } from './window.js';
import db from './config/db.js';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

// Controllers
import { registerUserHandlers } from './controllers/UserController.js';
import { registerCustomerHandlers } from './controllers/CustomerController.js';
import { registerVehicleLoanHandlers } from './controllers/VehicleLoarnController.js';
import { registerPaymentHandlers } from './controllers/PaymentController.js';
import { registerLandLoanHandlers } from './controllers/LandLoarnControler.js';
import { registerPromissoryLoanHandlers } from './controllers/PromissoryLoanController.js';
import { registerCheckLoanHandlers } from './controllers/CheckLoanController.js';
import { registerLoanLookupHandlers } from './controllers/LoanLookupController.js';
import { setupSMSHandlers } from './controllers/smsController.js';
import { registerDashbordHandlers } from './controllers/DashbordController.js';
import { registerStatusHandlers } from './controllers/SystemStatusController.js';
import { registerBackupHandlers } from './controllers/BackupController.js';
import { registerMigrationHandlers } from './controllers/MigrationController.js';
import { registerMonthlyAnalysisHandlers } from './controllers/MonthlyAnalysisController.js';
import { registerSettlementHandlers } from './controllers/SettlmentserviceController.js';

console.log("main process starting....");

process.on('uncaughtException', (error) => {
    console.error('CRITICAL ERROR:', error);
});

let isDbConnected = false;
let mainWindow;

function registerAllHandlers() {
    console.log("📡 Registering all IPC handlers...");
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
    registerMonthlyAnalysisHandlers();
    registerSettlementHandlers();
    console.log("✅ All IPC handlers registered!");
}

async function startApp() {
    try {
        // ✅ Handlers FIRST
        registerAllHandlers();

        // ✅ STEP 2: DB connect (background - window load වීමට block නොකරයි)
        console.log("🔌 Connecting to database...");
        db.initialize()
            .then(() => {
                isDbConnected = true;
                console.log("✅ Database Connected!");
            })
            .catch((dbError) => {
                isDbConnected = false;
                console.error("❌ DB Connection Failed:", dbError.message);

                // Background reconnector
                const reconnectInterval = setInterval(async () => {
                    console.log("🔄 Retrying DB connection...");
                    try {
                        await db.initialize();
                        isDbConnected = true;
                        console.log("✨ DB Reconnected! Reloading app...");
                        if (mainWindow) mainWindow.webContents.reload();
                        clearInterval(reconnectInterval);
                    } catch (_) {
                        // නැවත try කරයි
                    }
                }, 5000);
            });

        // ✅ STEP 3: Window create (handlers ready නිසා IPC calls handle වෙනවා)
        console.log("🪟 Creating main window...");
        mainWindow = createMainWindow();

        console.log("🚀 Application ready!");
     // 1. Checking for updates
autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update-message', 'Checking for updates...');
});

// 2. New update found
autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-message', `New version ${info.version} found. Downloading...`);
});

// 3. Update downloaded and ready to install
autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-message', 'Download complete. Restarting app to update...');
    setTimeout(() => {
        autoUpdater.quitAndInstall();
    }, 3000); 
});

// 4. No updates found
autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-message', 'App is up to date.');
});

// Start checking
autoUpdater.checkForUpdatesAndNotify();

    } catch (error) {
        console.error("❌ App Startup Error:", error);
    }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        startApp();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                mainWindow = createMainWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});