const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to existing DB
const dbPath = path.resolve(__dirname, '../ukombozi.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        process.exit(1);
    }
    console.log('Connected to Ukombozi Database.');
});

db.serialize(() => {
    // 1. COMPANY INVESTMENTS (Top-Ups)
    db.run(`CREATE TABLE IF NOT EXISTS company_investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        investment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'ACTIVE', -- ACTIVE, REPAID, WRITTEN_OFF
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES groups(id)
    )`, (err) => {
        if (err) console.error("Error creating company_investments:", err);
        else console.log("Table 'company_investments' ready.");
    });

    // 2. GROUP COMMITMENTS (Security Deposits)
    db.run(`CREATE TABLE IF NOT EXISTS group_commitments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        deposit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'LOCKED', -- LOCKED, APPLIED, FORFEITED
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES groups(id)
    )`, (err) => {
        if (err) console.error("Error creating group_commitments:", err);
        else console.log("Table 'group_commitments' ready.");
    });

    // 3. PRODUCT FINANCING (Assets)
    db.run(`CREATE TABLE IF NOT EXISTS product_financing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        total_value DECIMAL(15, 2) NOT NULL,
        commitment_paid DECIMAL(15, 2) NOT NULL, -- Upfront Deposit
        financed_amount DECIMAL(15, 2) NOT NULL, -- (Total - Commitment)
        monthly_installment DECIMAL(15, 2) NOT NULL,
        start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, DEFUALT
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(member_id) REFERENCES members(id)
    )`, (err) => {
        if (err) console.error("Error creating product_financing:", err);
        else console.log("Table 'product_financing' ready.");
    });
});

db.close(() => {
    console.log('Partnership Schema Initialization Complete.');
});
