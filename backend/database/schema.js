const db = require('../db');

/**
 * 🗄️ Database Schema & Migrations
 * Runs on server startup to ensure all governance and partnership tables exist.
 */
const initSchema = () => {
    db.serialize(() => {
        // 1. Core Governance Extensions
        db.run("ALTER TABLE groups ADD COLUMN is_frozen INTEGER DEFAULT 0", (err) => {
            if (!err) console.log("Governance: 'is_frozen' added to groups");
        });
        db.run("ALTER TABLE officers ADD COLUMN status TEXT DEFAULT 'active'", (err) => {
            if (!err) console.log("Governance: 'status' added to officers");
        });

        // Add Unique Constraint to Group Names
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_name ON groups(name COLLATE NOCASE)", (err) => {
            if (!err) console.log("Governance: UNIQUE index added to groups(name)");
        });

        // 2. Audit Logs
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            performed_by INTEGER,
            target_type TEXT,
            target_id INTEGER,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 3. Reversal Requests (Dual Control Hub)
        db.run(`CREATE TABLE IF NOT EXISTS reversal_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id TEXT NOT NULL, -- UUID or ID
            requester_id INTEGER NOT NULL,
            approver_id INTEGER,
            reason TEXT NOT NULL,
            status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP,
            FOREIGN KEY(requester_id) REFERENCES officers(id),
            FOREIGN KEY(approver_id) REFERENCES officers(id)
        )`);

        // 4. System Settings
        // Note: DROP TABLE is kept here as per original server.js logic to ensure schema updates for description
        db.run("DROP TABLE IF EXISTS system_settings");
        db.run(`CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT
        )`);

        // 4. SMS Logs
        db.run(`CREATE TABLE IF NOT EXISTS sms_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            phone TEXT,
            message TEXT,
            type TEXT,
            status TEXT DEFAULT 'SENT',
            transaction_id INTEGER,
            cost REAL DEFAULT 0,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 5. Partnership Tables
        db.run(`CREATE TABLE IF NOT EXISTS company_investments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER,
            amount REAL NOT NULL,
            notes TEXT,
            status TEXT DEFAULT 'ACTIVE',
            type TEXT DEFAULT 'TOPUP',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS group_commitments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER,
            amount REAL NOT NULL,
            notes TEXT,
            status TEXT DEFAULT 'LOCKED',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS financed_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            product_name TEXT NOT NULL,
            total_value REAL NOT NULL,
            commitment_paid REAL NOT NULL,
            monthly_installment REAL NOT NULL,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(member_id) REFERENCES members(id)
        )`);

        // 6. Project Intelligence Tables
        db.run(`CREATE TABLE IF NOT EXISTS project_registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            group_id INTEGER,
            project_type TEXT CHECK(project_type IN ('EDUCATION', 'AGRICULTURE')),
            total_saved REAL DEFAULT 0,
            projected_payout REAL GENERATED ALWAYS AS (total_saved * 1.5) VIRTUAL,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(member_id) REFERENCES members(id),
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS project_savings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_id INTEGER,
            amount REAL NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(registration_id) REFERENCES project_registrations(id)
        )`);

        // 5. Partnership Tables
        // ... (existing partnership tables)

        // 7. Dividend Engine Standard Tables
        db.run(`CREATE TABLE IF NOT EXISTS dividend_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            financial_year INTEGER NOT NULL,
            snapshot_month TEXT NOT NULL,
            snapshot_date TEXT NOT NULL,
            member_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            savings_balance REAL NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(member_id) REFERENCES members(id),
            FOREIGN KEY(group_id) REFERENCES groups(id),
            UNIQUE(financial_year, snapshot_month, member_id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS dividend_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_number TEXT UNIQUE NOT NULL,
            financial_year INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            banking_interest REAL DEFAULT 0,
            stl_interest REAL DEFAULT 0,
            ltl_interest REAL DEFAULT 0,
            penalties REAL DEFAULT 0,
            other_income REAL DEFAULT 0,
            operating_expenses REAL DEFAULT 0,
            mandatory_reserves REAL DEFAULT 0,
            risk_buffer REAL DEFAULT 0,
            reinvested_capital REAL DEFAULT 0,
            profit_share_percentage REAL DEFAULT 75,
            dividend_rate REAL DEFAULT 0,
            allocable_profit REAL DEFAULT 0,
            total_payout REAL DEFAULT 0,
            status TEXT DEFAULT 'DRAFT',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS dividend_allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dividend_run_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            average_shares REAL DEFAULT 0,
            gross_dividend REAL DEFAULT 0,
            arrears_offset REAL DEFAULT 0,
            net_dividend REAL DEFAULT 0,
            posted_to_savings INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(dividend_run_id) REFERENCES dividend_runs(id) ON DELETE CASCADE,
            FOREIGN KEY(member_id) REFERENCES members(id),
            UNIQUE(dividend_run_id, member_id)
        )`);

        // 6. Daily Cash Report Audit Extensions
        db.run("ALTER TABLE daily_cash_reports ADD COLUMN officer_declaration INTEGER DEFAULT 0", (err) => {
            if (!err) console.log("Governance: 'officer_declaration' added to reports");
        });
        db.run("ALTER TABLE daily_cash_reports ADD COLUMN ip_address TEXT", (err) => {
            if (!err) console.log("Governance: 'ip_address' added to reports");
        });
        db.run("ALTER TABLE daily_cash_reports ADD COLUMN submission_timestamp TEXT", (err) => {
            if (!err) console.log("Governance: 'submission_timestamp' added to reports");
        });

        // 7. Meeting Planning Extensions
        db.run("ALTER TABLE meeting_sessions ADD COLUMN venue TEXT", (err) => {
            if (!err) console.log("Planning: 'venue' added to meeting_sessions");
        });
        db.run("ALTER TABLE meeting_sessions ADD COLUMN agenda TEXT", (err) => {
            if (!err) console.log("Planning: 'agenda' added to meeting_sessions");
        });
        db.run("ALTER TABLE meeting_sessions ADD COLUMN meeting_type TEXT DEFAULT 'Routine'", (err) => {
            if (!err) console.log("Planning: 'meeting_type' added to meeting_sessions");
        });
        db.run("ALTER TABLE meeting_sessions ADD COLUMN expected_attendance INTEGER", (err) => {
            if (!err) console.log("Planning: 'expected_attendance' added to meeting_sessions");
        });

        // 7. Defaults
        db.run("INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)", ["SYSTEM_LOCKDOWN", "false", "Emergency Global Freeze"]);
        db.run("INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)", ["ALLOW_OVERDRAFTS", "false", "Allow negative operational balances"]);
    });
};

module.exports = { initSchema };
