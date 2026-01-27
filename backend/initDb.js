const db = require('./db');
const bcrypt = require('bcryptjs');

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const init = async () => {
    try {
        console.log("Initializing Database...");

        // 1. GROUPS TABLE
        await run(`CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT,
            meetingDay TEXT,
            chairperson TEXT,
            secretary TEXT,
            treasurer TEXT,
            status TEXT DEFAULT 'active' CHECK( status IN ('active', 'suspended', 'inactive') ),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration for existing groups table
        const columnsToAdd = [
            'chairperson', 'secretary', 'treasurer',
            'chairperson_id', 'secretary_id', 'treasurer_id',
            'registrationDate', 'meetingFrequency', 'dividendPolicy',
            'minMonthlySaving', 'loanMultiplier', 'stlInterestRate', 'ltlInterestRate',
            'financial_year'
        ];
        for (const col of columnsToAdd) {
            try { await run(`ALTER TABLE groups ADD COLUMN ${col} TEXT`); } catch (e) { }
        }

        // 2. MEMBERS TABLE
        await run(`CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            group_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active' CHECK( status IN ('active', 'inactive', 'suspended') ),
            registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
            opening_balance_savings REAL DEFAULT 0,
            opening_balance_ltl REAL DEFAULT 0,
            opening_balance_stl REAL DEFAULT 0,
            opening_balance_set_by INTEGER,
            opening_balance_set_at TEXT,
            opening_balance_reason TEXT,
            opening_balance_locked INTEGER DEFAULT 0,
            current_savings REAL DEFAULT 0,
            active_loan_balance REAL DEFAULT 0,
            next_of_kin_name TEXT,
            next_of_kin_phone TEXT,
            next_of_kin_relationship TEXT,
            next_of_kin_member_id INTEGER, -- Linked to existing member
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id),
            FOREIGN KEY (next_of_kin_member_id) REFERENCES members(id)
        )`);

        // 3. LOANS TABLE
        await run(`CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            loan_type TEXT NOT NULL CHECK (loan_type IN ('STL', 'LTL', 'EMERGENCY')),
            principal_amount REAL NOT NULL,
            interest_rate REAL NOT NULL,
            issued_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'written_off')),
            issued_by INTEGER,
            guarantor1_id INTEGER,
            guarantor2_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (group_id) REFERENCES groups(id),
            FOREIGN KEY (guarantor1_id) REFERENCES members(id),
            FOREIGN KEY (guarantor2_id) REFERENCES members(id)
        )`);

        // 4. MEETING SESSIONS
        await run(`CREATE TABLE IF NOT EXISTS meeting_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            groupId INTEGER NOT NULL,
            officerId INTEGER NOT NULL,
            date TEXT NOT NULL,
            startTime TEXT,
            endTime TEXT,
            status TEXT DEFAULT 'draft' CHECK( status IN ('draft', 'ACTIVE', 'PENDING_APPROVAL', 'POSTED', 'REVERSED') ),
            reversalMetadata TEXT,
            totals TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (groupId) REFERENCES groups(id)
        )`);

        // 5. TRANSACTIONS
        await run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sessionId INTEGER,
            memberId INTEGER NOT NULL,
            memberName TEXT,
            attended INTEGER DEFAULT 1,
            savings_amount REAL DEFAULT 0,
            stl_repayment REAL DEFAULT 0,
            ltl_repayment REAL DEFAULT 0,
            loan_interest REAL DEFAULT 0,
            welfare REAL DEFAULT 0,
            fines REAL DEFAULT 0,
            withdrawals REAL DEFAULT 0,
            loans_issued REAL DEFAULT 0,
            transaction_type TEXT,
            description TEXT,
            uploaded INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sessionId) REFERENCES meeting_sessions(id),
            FOREIGN KEY (memberId) REFERENCES members(id)
        )`);

        // 6. DIVIDEND TABLES
        await run(`CREATE TABLE IF NOT EXISTS dividend_runs (
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

        await run(`CREATE TABLE IF NOT EXISTS dividend_allocations (
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

        // 7. ADMIN & AUDIT
        await run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            category TEXT NOT NULL,
            details TEXT,
            officer_id INTEGER,
            officer_name TEXT,
            ip_address TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(`CREATE TABLE IF NOT EXISTS loan_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE,
            interest_rate REAL NOT NULL,
            duration_months INTEGER NOT NULL,
            max_amount REAL,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // 8. LOAN APPLICATIONS
        await run(`CREATE TABLE IF NOT EXISTS loan_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_number TEXT UNIQUE,
            member_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            loan_type TEXT NOT NULL,
            amount_requested REAL NOT NULL,
            duration_months INTEGER NOT NULL,
            purpose TEXT,
            status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ADMIN_REVIEW', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED', 'OFFICER_SUBMITTED', 'DIRECTOR_REVIEW')),
            monthly_installment REAL,
            interest_portion REAL,
            principal_portion REAL,
            shares_contribution REAL,
            officer_id INTEGER,
            guarantor1_id INTEGER,
            guarantor2_id INTEGER,
            comments TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id),
            FOREIGN KEY (group_id) REFERENCES groups(id),
            FOREIGN KEY (guarantor1_id) REFERENCES members(id),
            FOREIGN KEY (guarantor2_id) REFERENCES members(id)
        )`);

        // 9. OFFICERS
        await run(`CREATE TABLE IF NOT EXISTS officers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK( role IN ('Field Officer', 'Director', 'Admin') ),
            phone TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            status TEXT DEFAULT 'active' CHECK( status IN ('active', 'inactive') ),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(`CREATE TABLE IF NOT EXISTS officer_groups (
            officer_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            PRIMARY KEY (officer_id, group_id),
            FOREIGN KEY (officer_id) REFERENCES officers(id) ON DELETE CASCADE,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )`);

        // SEEDING
        const groupCount = await get("SELECT count(*) as count FROM groups");
        if (groupCount.count === 0) {
            console.log("Seeding Groups...");
            await run("INSERT INTO groups (name, location, meetingDay) VALUES (?, ?, ?)", ["Victory Women", "Kibera", "Monday"]);
            await run("INSERT INTO groups (name, location, meetingDay) VALUES (?, ?, ?)", ["Ukombozi A", "Mathare", "Tuesday"]);
            await run("INSERT INTO groups (name, location, meetingDay) VALUES (?, ?, ?)", ["Ukombozi B", "Kawanagware", "Wednesday"]);
        }

        const memberCount = await get("SELECT count(*) as count FROM members");
        if (memberCount.count === 0) {
            console.log("Seeding Members...");
            const now = new Date().toISOString();
            await run("INSERT INTO members (name, phone, group_id, opening_balance_savings, current_savings) VALUES (?, ?, ?, ?, ?)", ["Alice", "0711", 1, 1000, 1000]);
            await run("INSERT INTO members (name, phone, group_id, current_savings) VALUES (?, ?, ?, ?)", ["Bob", "0722", 1, 500]);
        }

        const officerCount = await get("SELECT count(*) as count FROM officers");
        if (officerCount.count === 0) {
            console.log("Seeding Officers...");
            const adminPass = await bcrypt.hash('Teddymark1', 10);
            const directorPass = await bcrypt.hash('Teddymark11$', 10);
            const staffPass = await bcrypt.hash('123456', 10);

            await run("INSERT INTO officers (name, role, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)", ["System Admin", "Admin", "0700", "andrewsigei684@gmail.com", adminPass]);
            await run("INSERT INTO officers (name, role, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)", ["Andrew Sigei", "Director", "0711", "andrewsigei6@gmail.com", directorPass]);
            await run("INSERT INTO officers (name, role, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)", ["Sarah", "Field Officer", "0722", "sarah@tbms.com", staffPass]);

            await run("INSERT INTO officer_groups (officer_id, group_id) VALUES (1, 2), (2, 2)");
        }

        console.log("Database initialized successfully.");
    } catch (err) {
        console.error("Initialization failed:", err);
    } finally {
        // Do not close DB here if we want to continue using it in other scripts, 
        // but for init-db standalone, we exit.
        process.exit();
    }
};

init();
