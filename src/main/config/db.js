import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';
import { app } from 'electron';
import { createTablesQuery } from './schema.js';

/**
 * .env file එක සොයාගැනීම (Security + Build Success)
 * Develop කරන විට: Project root එකේ ඇති .env කියවයි.
 * Build කළ පසු: Resources folder එකට copy වූ .env කියවයි.
 */
const isDev = !app.isPackaged;
const envPath = isDev 
    ? path.join(process.cwd(), '.env') 
    : path.join(process.resourcesPath, '.env');

dotenv.config({ path: envPath });

// Database Connection Pool එක සෑදීම
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 15000, // Remote DB නිසා කාලය ටිකක් වැඩි කළා
    enableKeepAlive: true
});

let isInitialized = false;

async function initDB() {
    if (isInitialized) return;
    isInitialized = true;
    
    let conn;
    try {
        console.log("Connecting to Remote Database...");
        conn = await pool.getConnection();

        // 1. Tables සෑදීම
        const queries = createTablesQuery.split(';').filter(q => q.trim() !== "");
        for (let query of queries) {
            await conn.query(query);
        }
        console.log("✅ Remote MySQL Database & Tables Initialized!");

        // 2. Default Admin User පරීක්ෂාව
        const [rows] = await conn.query("SELECT * FROM Users WHERE Username = 'admin'");
        if (rows.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            await conn.query(
                "INSERT INTO Users (UserID, Username, PasswordHash, Role) VALUES (?, ?, ?, ?)", 
                ['U001', 'admin', hashedPassword, 'admin']
            );
            console.log("👤 Default Admin user created.");
        }

    } catch (err) {
        console.error("❌ Remote DB Setup Error: ", err.message);
        // මෙතනදී Error එකක් ආවොත් main window එකට දැනුම් දීමට අවශ්‍ය ලොජික් එක මෙතැනට දැමිය හැක
        throw err; 
    } finally {
        if (conn) conn.release();
    }
}

export default {
    execute: (sql, params) => pool.execute(sql, params),
    query: (sql, params) => pool.query(sql, params),
    getConnection: () => pool.getConnection(),
    initialize: initDB 
};