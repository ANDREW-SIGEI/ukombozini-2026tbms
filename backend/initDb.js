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
            
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id)
        )`);

        // 3. MEETING SESSIONS
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
            sessionId INTEGER NOT NULL,
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
            
            -- Calculated
            total_paid REAL DEFAULT 0,
            
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sessionId) REFERENCES meeting_sessions(id),
            FOREIGN KEY (memberId) REFERENCES members(id)
        )`);

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
                    opening_balance_set_by, opening_balance_set_at, opening_balance_reason, opening_balance_locked
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                const now = new Date().toISOString();
                stmt.run("Alice Wanjiku", "0712345678", 1, 15000, 10000, 2000, 1, now, "Initial registration", 1);
                stmt.run("Beatrice Atieno", "0723456789", 1, 25000, 5000, 0, 1, now, "Initial registration", 1);
                stmt.run("Catherine Njemeri", "0734567890", 1, 8000, 20000, 5000, 1, now, "Initial registration", 1);
                // Seed members for Group 2 (new member with zero opening balance)
                stmt.run("David Kamau", "0745678901", 2, 0, 0, 0, 1, now, "New member - zero opening balance", 1);
                stmt.finalize();
            }
        });

    });
};

serialize();
