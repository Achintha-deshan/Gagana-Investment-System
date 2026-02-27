import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';
import { app } from 'electron';
import { createTablesQuery } from './schema.js';

let pool = null;
let isInitialized = false;

/**
 * .env ගොනුව පවතින ස්ථානය නිවැරදිව හඳුනා ගැනීම
 */
function getEnvPath() {
    // App එක pack කර ඇත්නම් resourcesPath ද, සංවර්ධනය කරන්නේ නම් cwd ද භාවිතා කරයි
    return app.isPackaged
        ? path.join(process.resourcesPath, '.env')
        : path.join(process.cwd(), '.env');
}

/**
 * Database එක Initialize කිරීම සහ Connection Pool එක සෑදීම
 */
async function initDB() {
    if (isInitialized) return;

    try {
        // 1. පරිසර විචල්‍යයන් (Environment Variables) Load කිරීම
        const envPath = getEnvPath();
        dotenv.config({ path: envPath });

        console.log("🛠️ Initializing Database Connection Pool...");

        // 2. Pool එක සෑදීම කරන්නේ initDB ඇතුළතදීය
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            multipleStatements: true,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 20000, // 20s (Remote DB නිසා වැඩි වෙලාවක් ලබා දී ඇත)
            enableKeepAlive: true
        });

        // 3. සම්බන්ධතාවය පරීක්ෂා කිරීම
        const conn = await pool.getConnection();
        console.log("🔗 Connected to Remote Database!");

        // 4. Tables සෑදීම
        const queries = createTablesQuery.split(';').filter(q => q.trim() !== "");
        for (let query of queries) {
            if (query.trim()) {
                await conn.query(query);
            }
        }
        console.log("✅ Database Tables Initialized!");

        // 5. Default Admin User පරීක්ෂාව
        const [rows] = await conn.query("SELECT * FROM Users WHERE Username = 'admin'");
        if (rows.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            await conn.query(
                "INSERT INTO Users (UserID, Username, PasswordHash, Role) VALUES (?, ?, ?, ?)", 
                ['U001', 'admin', hashedPassword, 'admin']
            );
            console.log("👤 Default Admin user created (admin / admin123).");
        }

        conn.release();
        isInitialized = true;
        return true;

    } catch (err) {
        console.error("❌ Database Initialization Failed:", err.message);
        // මෙහිදී throw කිරීමෙන් index.js එකේ catch බ්ලොක් එකට දෝෂය යවයි
        throw err; 
    }
}

/**
 * Safe Execution Wrapper
 * Pool එක සාදා නැතිනම් සාදා පසුව query එක run කරයි
 */
export default {
    execute: async (sql, params) => {
        if (!pool) throw new Error("Database pool not initialized.");
        return pool.execute(sql, params);
    },
    query: async (sql, params) => {
        if (!pool) throw new Error("Database pool not initialized.");
        return pool.query(sql, params);
    },
    getConnection: async () => {
        if (!pool) throw new Error("Database pool not initialized.");
        return pool.getConnection();
    },
    initialize: initDB 
};