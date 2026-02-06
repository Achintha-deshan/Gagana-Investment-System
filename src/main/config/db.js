import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { createTablesQuery } from './schema.js';

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, 
    enableKeepAlive: true
});

let isInitialized = false;
async function initDB() {
    if (isInitialized) return;
    isInitialized = true;
    
    let conn;
    try {
        // පියවර 1 සහ 2 වෙනුවට කෙලින්ම Pool එකෙන් Connection එකක් ගන්න
        conn = await pool.getConnection();

        // පියවර 3: ටේබල් සෑදීම
        const queries = createTablesQuery.split(';').filter(q => q.trim() !== "");
        for (let query of queries) {
            await conn.query(query);
        }
        console.log("✅ Remote MySQL Database & Tables Initialized!");

        // පියවර 4: Admin User පරීක්ෂාව
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