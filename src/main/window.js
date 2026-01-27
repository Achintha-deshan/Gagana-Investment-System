import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modules වලදී __dirname සාදාගන්නා ආකාරය
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createMainWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            // Preload path එක නිවැරදිව ලබා දීම
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // DevTools open කිරීම
    win.webContents.openDevTools({ mode: 'detach' });

    // HTML file එක load කිරීම (ඔයාගේ path එකට අනුව)
    win.loadFile(path.join(__dirname, '../renderer/views/index.html'));

    win.maximize();
    return win;
}