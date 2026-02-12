const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("Running Migration: Governance Layer (Phase 2) - SYNC MODE");

db.serialize(() => {
    // 1. Groups: Add is_frozen
    db.run("ALTER TABLE groups ADD COLUMN is_frozen INTEGER DEFAULT 0", (err) => {
        if (!err) console.log("Success: Added 'is_frozen' to groups");
        else if (err.message.includes("duplicate column")) console.log("Skipped: 'is_frozen' already exists in groups");
        else console.error("Error: groups add column failed", err.message);
    });

    // 2. Officers: Add status
    db.run("ALTER TABLE officers ADD COLUMN status TEXT DEFAULT 'active'", (err) => {
        if (!err) console.log("Success: Added 'status' to officers");
        else if (err.message.includes("duplicate column")) console.log("Skipped: 'status' already exists in officers");
        else console.error("Error: officers add column failed", err.message);
    });

    // 3. Create Audit Logs Table
    const auditLogsSql = `
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            performed_by INTEGER,
            target_type TEXT,
            target_id INTEGER,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.run(auditLogsSql, (err) => {
        if (!err) console.log("Success: Verified audit_logs table");
        else console.error("Error: audit_logs creation failed", err.message);
    });

    // 4. Create System Settings Table
    const systemSettingsSql = `
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT
        )
    `;
    db.run(systemSettingsSql, (err) => {
        if (!err) {
            console.log("Success: Verified system_settings table");
            // Initialize Defaults
            const stmt = db.prepare("INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)");
            stmt.run("SYSTEM_LOCKDOWN", "false", "Emergency Global Freeze");
            stmt.run("ALLOW_OVERDRAFTS", "false", "Allow negative operational balances");
            stmt.finalize(() => {
                console.log("Success: System settings defaults initialized");
                db.close();
            });
        } else {
            console.error("Error: system_settings creation failed", err.message);
            db.close();
        }
    });

});
