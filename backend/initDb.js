const db = require('./db');

const serialize = () => {
    db.serialize(() => {
        // 1. GROUPS TABLE
        db.run(`CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT,
            meetingDay TEXT,
            status TEXT DEFAULT 'active' CHECK( status IN ('active', 'suspended', 'inactive') ),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. MEMBERS TABLE (STRICT OPENING BALANCE RULES)
        db.run(`CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            group_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active' CHECK( status IN ('active', 'inactive', 'suspended') ),
            
            -- Registration Date (CRITICAL for BF logic)
            registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
            
            -- Opening Balances (Set ONCE at registration)
            opening_balance_savings REAL DEFAULT 0,
            opening_balance_ltl REAL DEFAULT 0,
            opening_balance_stl REAL DEFAULT 0,
            
            -- Audit Trail for Opening Balances
            opening_balance_set_by INTEGER,
            opening_balance_set_at TEXT,
            opening_balance_reason TEXT,
            opening_balance_locked INTEGER DEFAULT 0,
            
            -- Current Balances (Updated by Transactions)
            current_savings REAL DEFAULT 0,
            active_loan_balance REAL DEFAULT 0,

            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id)
        )`);

        // 2.5 LOANS TABLE (Added for Loan Management)
        db.run(`CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            loan_type TEXT NOT NULL CHECK (loan_type IN ('STL', 'LTL')),
            principal_amount REAL NOT NULL,
            interest_rate REAL NOT NULL,
            issued_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'written_off')),
            issued_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (group_id) REFERENCES groups(id)
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS meeting_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            groupId INTEGER NOT NULL,
            officerId INTEGER NOT NULL,
            date TEXT NOT NULL,
            startTime TEXT,
            endTime TEXT,
            status TEXT DEFAULT 'draft' CHECK( status IN ('draft', 'ACTIVE', 'PENDING_APPROVAL', 'POSTED', 'REVERSED') ),
            reversalMetadata TEXT, -- JSON string
            totals TEXT, -- JSON string for simplified caching
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (groupId) REFERENCES groups(id)
        )`);

        // 4. TRANSACTIONS
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessionId INTEGER, -- Nullable for ad-hoc transactions
            memberId INTEGER NOT NULL,
            memberName TEXT,
            
            -- Transaction Fields
            attended INTEGER DEFAULT 1,
            savings_amount REAL DEFAULT 0,
            stl_repayment REAL DEFAULT 0,
            ltl_repayment REAL DEFAULT 0,
            loan_interest REAL DEFAULT 0,
            welfare REAL DEFAULT 0,
            fines REAL DEFAULT 0,
            withdrawals REAL DEFAULT 0,
            loans_issued REAL DEFAULT 0,
            
            -- Generic Fields
            transaction_type TEXT,
            description TEXT,
            uploaded INTEGER DEFAULT 0,
            
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sessionId) REFERENCES meeting_sessions(id),
            FOREIGN KEY (memberId) REFERENCES members(id)
        )`);

        // 5. DIVIDEND ENGINE TABLES
        db.run(`CREATE TABLE IF NOT EXISTS dividend_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            financial_year INTEGER,
            group_id INTEGER,
            run_number TEXT,
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
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS dividend_allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dividend_run_id INTEGER,
            member_id INTEGER,
            average_shares REAL,
            gross_dividend REAL,
            arrears_offset REAL,
            net_dividend REAL,
            posted_to_savings INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dividend_run_id) REFERENCES dividend_runs(id),
            FOREIGN KEY (member_id) REFERENCES members(id)
        )`);

        // 6. ADMIN & AUDIT TABLES
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            category TEXT NOT NULL, -- 'auth', 'transaction', 'admin', 'system'
            details TEXT,
            officer_id INTEGER,
            officer_name TEXT,
            ip_address TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS loan_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE, -- e.g., 'STL', 'LTL', 'EMG'
            interest_rate REAL NOT NULL,
            duration_months INTEGER NOT NULL,
            max_amount REAL,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // INITIAL SETTINGS SEED
        db.get("SELECT count(*) as count FROM settings", (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare("INSERT INTO settings (key, value, description) VALUES (?, ?, ?)");
                stmt.run("system_name", "Ukombozi TBMS", "Application name");
                stmt.run("currency", "KES", "System currency code");
                stmt.run("min_savings_for_loan", "3", "Multiplier of savings for max loan");
                stmt.finalize();
            }
        });

        // INITIAL LOAN PRODUCTS SEED
        db.get("SELECT count(*) as count FROM loan_products", (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare("INSERT INTO loan_products (name, code, interest_rate, duration_months, description) VALUES (?, ?, ?, ?, ?)");
                stmt.run("Short Term Loan", "STL", 10.0, 1, "1-month reducing balance loan");
                stmt.run("Long Term Loan", "LTL", 12.0, 12, "12-month development loan");
                stmt.run("Emergency Loan", "EMG", 5.0, 1, "Quick 1-month emergency relief");
                stmt.finalize();
            }
        });

        console.log("Tables created successfully.");

        // SEED DATA
        db.get("SELECT count(*) as count FROM groups", (err, row) => {
            if (row.count === 0) {
                console.log("Seeding Groups...");
                const stmt = db.prepare("INSERT INTO groups (name, location, meetingDay) VALUES (?, ?, ?)");
                stmt.run("Victory Women Group", "Kibera Zone A", "Monday");
                stmt.run("Ukombozi Group A", "Mathare North", "Tuesday");
                stmt.run("Ukombozi Group B", "Kawanagware", "Wednesday");
                stmt.finalize();
            }
        });

        db.get("SELECT count(*) as count FROM members", (err, row) => {
            if (row.count === 0) {
                console.log("Seeding Members with Opening Balances...");
                // Seed members for Group 1 (with opening balances for testing)
                const stmt = db.prepare(`INSERT INTO members (
                    name, phone, group_id, 
                    opening_balance_savings, opening_balance_ltl, opening_balance_stl,
                    opening_balance_set_by, opening_balance_set_at, opening_balance_reason, opening_balance_locked,
                    current_savings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                const now = new Date().toISOString();
                stmt.run("Alice Wanjiku", "0712345678", 1, 15000, 10000, 2000, 1, now, "Initial registration", 1, 15000);
                stmt.run("Beatrice Atieno", "0723456789", 1, 25000, 5000, 0, 1, now, "Initial registration", 1, 25000);
                stmt.run("Catherine Njemeri", "0734567890", 1, 8000, 20000, 5000, 1, now, "Initial registration", 1, 8000);
                // Seed members for Group 2 (new member with zero opening balance)
                stmt.run("David Kamau", "0745678901", 2, 0, 0, 0, 1, now, "New member - zero opening balance", 1, 0);
                stmt.finalize();
            }
        });

    });
};

serialize();
