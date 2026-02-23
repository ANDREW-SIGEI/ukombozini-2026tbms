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
        db.run("ALTER TABLE groups ADD COLUMN loan_multiplier REAL DEFAULT 3", (err) => {
            if (!err) console.log("Governance: 'loan_multiplier' added to groups");
        });
        db.run("ALTER TABLE groups ADD COLUMN dividend_policy REAL DEFAULT 0.75", (err) => {
            if (!err) console.log("Governance: 'dividend_policy' added to groups");
        });
        db.run("ALTER TABLE groups ADD COLUMN default_savings REAL DEFAULT 500", (err) => {
            if (!err) console.log("Governance: 'default_savings' added to groups");
        });
        db.run("ALTER TABLE groups ADD COLUMN default_welfare REAL DEFAULT 100", (err) => {
            if (!err) console.log("Governance: 'default_welfare' added to groups");
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

        // 5.5 TOPUP REQUESTS (Admin Gatekeeper)
        db.run(`CREATE TABLE IF NOT EXISTS topup_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            commitment_amount REAL NOT NULL,
            topup_amount REAL NOT NULL,
            status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
            requested_by INTEGER NOT NULL,
            approved_by INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            approved_at DATETIME,
            FOREIGN KEY(group_id) REFERENCES groups(id),
            FOREIGN KEY(requested_by) REFERENCES officers(id),
            FOREIGN KEY(approved_by) REFERENCES officers(id)
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
        db.run("ALTER TABLE daily_cash_reports ADD COLUMN draft_data TEXT", (err) => {
            if (!err) console.log("Persistence: 'draft_data' added to daily_cash_reports");
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
        db.run("ALTER TABLE meeting_sessions ADD COLUMN ukombozini_repayment REAL DEFAULT 0", (err) => {
            if (!err) console.log("Finance: 'ukombozini_repayment' added to meeting_sessions");
        });
        db.run("ALTER TABLE meeting_sessions ADD COLUMN totals TEXT", (err) => {
            if (!err) console.log("Persistence: 'totals' added to meeting_sessions");
        });

        // 8. Risk Intelligence Tables
        db.run(`CREATE TABLE IF NOT EXISTS risk_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT CHECK(scope IN ('GROUP', 'MEMBER', 'OFFICER')),
            target_id INTEGER NOT NULL,
            score REAL DEFAULT 0,
            metrics_snapshot TEXT,
            calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS risk_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT CHECK(scope IN ('GROUP', 'MEMBER', 'OFFICER')),
            target_id INTEGER NOT NULL,
            alert_type TEXT,
            severity TEXT,
            message TEXT,
            is_resolved INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 9. Attendance Tracking
        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            status TEXT CHECK(status IN ('PRESENT', 'ABSENT', 'LATE')) DEFAULT 'PRESENT',
            recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES meeting_sessions(id),
            FOREIGN KEY(member_id) REFERENCES members(id),
            UNIQUE(session_id, member_id)
        )`);

        // 7. Defaults
        db.run("INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)", ["SYSTEM_LOCKDOWN", "false", "Emergency Global Freeze"]);
        db.run("INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)", ["ALLOW_OVERDRAFTS", "false", "Allow negative operational balances"]);
    });
};

/**
 * 📊 Database Views
 * High-fidelity aggregations for reporting and auditing.
 */
const initViews = (db) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`DROP VIEW IF EXISTS member_ledger_view`, (err) => {
                if (err) return reject(err);

                db.run(`
                    CREATE VIEW member_ledger_view AS
                    -- Standard Savings Deposits
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Savings Deposit' as type,
                        0 as debit,
                        t.savings_amount as credit,
                        COALESCE(t.description, 'Monthly Meeting Savings') as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.savings_amount > 0 AND t.transaction_type NOT IN ('ProjectSaving', 'education', 'agriculture')

                    UNION ALL

                    -- Education Project Savings
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Project (Education)' as type,
                        0 as debit,
                        t.savings_amount as credit,
                        t.description as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.transaction_type IN ('ProjectSaving', 'education') AND t.description LIKE '%Education%'

                    UNION ALL

                    -- Agriculture Project Savings
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Project (Agriculture)' as type,
                        0 as debit,
                        t.savings_amount as credit,
                        t.description as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.transaction_type IN ('ProjectSaving', 'agriculture') OR (t.transaction_type = 'ProjectSaving' AND t.description LIKE '%Agriculture%')

                    UNION ALL

                    -- Loan Repayment: Principal
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Loan Pay (Principal)' as type,
                        0 as debit,
                        (t.stl_repayment + t.ltl_repayment) as credit,
                        'Principal Serving for Loan' as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE (t.stl_repayment + t.ltl_repayment) > 0

                    UNION ALL

                    -- Loan Repayment: Interest
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Loan Pay (Interest)' as type,
                        0 as debit,
                        t.loan_interest as credit,
                        'Interest Serving' as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.loan_interest > 0

                    UNION ALL

                    -- Fine/Penalty Payment (Credit towards debt)
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Fine Payment' as type,
                        0 as debit,
                        t.fines as credit,
                        'Penalty Clearance' as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.fines > 0 AND t.transaction_type = 'LoanRepayment'

                    UNION ALL

                    -- Fine/Penalty Charge (Debit - increase debt)
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Fine Charged' as type,
                        t.fines as debit,
                        0 as credit,
                        COALESCE(t.description, 'Late Fee/Violation') as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.fines > 0 AND t.transaction_type IN ('Fine', 'penalty')

                    UNION ALL

                    -- Withdrawals
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Withdrawal' as type,
                        t.withdrawals as debit,
                        0 as credit,
                        COALESCE(t.description, 'Savings Withdrawal') as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.withdrawals > 0 AND t.transaction_type NOT IN ('AssetFinancing', 'productfinancing')

                    UNION ALL
                    
                    -- Asset Financing (Product)
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Asset Purchased' as type,
                        t.withdrawals as debit,
                        0 as credit,
                        COALESCE(t.description, 'Project Asset Financing') as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.transaction_type IN ('AssetFinancing', 'productfinancing')

                    UNION ALL

                    -- Loan Disbursements
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Loan Issued' as type,
                        t.loans_issued as debit,
                        0 as credit,
                        COALESCE(t.description, 'New Loan Disbursement') as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.loans_issued > 0

                    UNION ALL

                    -- Welfare Contributions
                    SELECT 
                        t.id, 
                        t.memberId, 
                        COALESCE(s.date, date(t.created_at)) as trans_date,
                        'Welfare Fund' as type,
                        0 as debit,
                        t.welfare as credit,
                        'Member Welfare Support' as description,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    WHERE t.welfare > 0
                `, (err) => {
                    if (err) return reject(err);
                    console.log("[SCHEMA] member_ledger_view Initialized.");
                    resolve();
                });
            });
        });
    });
};

module.exports = { initSchema, initViews };

