const path = require('path');

let db;

if (process.env.DATABASE_URL) {
    // 🐳 Professional PG Stack (Docker)
    console.log('--- 🐳 UKOMBOZI DOCKER STACK DETECTED ---');
    db = require('./db_postgres');
} else {
    // 📁 Local Development (SQLite)
    console.log('--- 📁 LOCAL SQLITE STACK DETECTED ---');
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');

    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            db.run('PRAGMA foreign_keys = ON'); // Enable foreign key constraints
        }
    });

    // 🚀 MTE v2 Bridge for SQLite
    // Matches the PostgreSQL client interface used in MTEEngine.js

    db.queryStandalone = function (sql, params = []) {
        // 🔄 Convert PostgreSQL-style $1, $2 to SQLite ? placeholders
        const sqliteSql = sql.replace(/\$\d+/g, '?');

        return new Promise((resolve, reject) => {
            const isSelect = sqliteSql.trim().toUpperCase().startsWith('SELECT') ||
                sqliteSql.trim().toUpperCase().startsWith('PRAGMA') ||
                sqliteSql.trim().toUpperCase().startsWith('EXPLAIN');
            if (isSelect) {
                db.all(sqliteSql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                db.run(sqliteSql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ rows: [], lastID: this.lastID, changes: this.changes });
                });
            }
        });
    };

    db.beginTransaction = async function () {
        return new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) return reject(err);
                // Return a client-like object
                resolve({
                    query: (sql, params = []) => db.queryStandalone(sql, params)
                });
            });
        });
    };

    db.commit = async function (client) {
        return new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => err ? reject(err) : resolve());
        });
    };

    db.rollback = async function (client) {
        return new Promise((resolve, reject) => {
            db.run('ROLLBACK', (err) => err ? reject(err) : resolve());
        });
    };
}

module.exports = db;
