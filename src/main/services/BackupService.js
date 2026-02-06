import path from 'path';
import fs from 'fs';
import { app, BrowserWindow } from 'electron';
import db from '../config/db.js';

class BackupService {
    async runMonthlyBackup(year, month) {
        try {
            // 1. සේව් වන ස්ථානය (Documents/Gagana_Backups/Monthly_Full_Reports)
            const docsPath = app.getPath('documents');
            const backupDir = path.join(docsPath, 'Gagana_Backups', 'Full_Reports');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

            const fileName = `Gagana_Full_Backup_${year}_${month}.pdf`;
            const finalPath = path.join(backupDir, fileName);

            // 2. දත්ත සමුදායේ ඇති සියලුම Tables ලැයිස්තුව ලබා ගැනීම
            const [tables] = await db.query("SHOW TABLES");
            const dbName = process.env.DB_NAME || 'gagana_db';
            const tableKey = `Tables_in_${dbName}`;

            // 3. HTML වාර්තාවේ ආරම්භය
            let htmlContent = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; background-color: #fff; }
                        .main-title { color: #1a2a6c; text-align: center; font-size: 28px; text-transform: uppercase; border-bottom: 3px solid #1a2a6c; padding-bottom: 10px; }
                        .meta-info { margin-bottom: 40px; text-align: right; color: #555; }
                        
                        .table-section { margin-bottom: 50px; page-break-inside: auto; }
                        .table-name { background: #1a2a6c; color: white; padding: 10px; font-size: 18px; margin-bottom: 10px; border-radius: 5px 5px 0 0; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: auto; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; word-wrap: break-word; }
                        th { background-color: #f2f2f2; color: #333; font-weight: bold; }
                        tr:nth-child(even) { background-color: #fafafa; }
                        
                        .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 5px; }
                    </style>
                </head>
                <body>
                    <div class="main-title">Gagana Investment - Full System Backup Report</div>
                    <div class="meta-info">
                        <p><strong>මාසික බැකප් වාර්තාව:</strong> ${year} - ${month}</p>
                        <p><strong>සකස් කළ දිනය:</strong> ${new Date().toLocaleString()}</p>
                    </div>
            `;

            // 4. සෑම Table එකකම දත්ත කියවා HTML එකට එක් කිරීම
            for (let tableObj of tables) {
                const tableName = tableObj[tableKey];
                const [rows] = await db.query(`SELECT * FROM ${tableName}`);

                if (rows.length > 0) {
                    const columns = Object.keys(rows[0]);

                    htmlContent += `
                        <div class="table-section">
                            <div class="table-name">Table: ${tableName.toUpperCase()} (${rows.length} Records)</div>
                            <table>
                                <thead>
                                    <tr>
                                        ${columns.map(col => `<th>${col}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows.map(row => `
                                        <tr>
                                            ${columns.map(col => `<td>${row[col] !== null ? row[col] : '-'}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            }

            htmlContent += `
                    <div class="footer">Gagana Investment Management System - Confidential Report</div>
                </body>
                </html>
            `;

            // 5. PDF එක ජනනය කිරීම (Hidden Window එකක් හරහා)
            const workerWindow = new BrowserWindow({ show: false });
            
            // විශාල HTML එකක් Load කරන නිසා loadURL වෙනුවට loadData භාවිතා කළ හැක
            await workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
            
            const pdfBuffer = await workerWindow.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                marginsType: 1, // Minimum margins
                landscape: true // දත්ත වැඩි නිසා Landscape එක වඩාත් හොඳින් පෙනේ
            });

            fs.writeFileSync(finalPath, pdfBuffer);
            workerWindow.close();

            console.log("✅ Full PDF Backup Generated at: " + finalPath);
            return { success: true, path: finalPath };

        } catch (err) {
            console.error("Full PDF Backup Error:", err);
            return { success: false, error: err.message };
        }
    }
}

export default new BackupService();