const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('--- 🚀 STARTING FINAL SCHEMA FIXES ---');

    // 1. Members Table - risk_score
    db.run("ALTER TABLE members ADD COLUMN risk_score INTEGER DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ members.risk_score already exists.');
            } else {
                console.error('❌ Error adding risk_score to members:', err.message);
            }
        } else {
            console.log('✅ Added risk_score to members.');
        }
    });

    // 2. Groups Table - risk_score
    db.run("ALTER TABLE groups ADD COLUMN risk_score INTEGER DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('✅ groups.risk_score already exists.');
            } else {
                console.error('❌ Error adding risk_score to groups:', err.message);
            }
        } else {
            console.log('✅ Added risk_score to groups.');
        }
    });

    // 3. Create Users Table (Mirroring officers structure)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'officer',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('❌ Error creating users table:', err.message);
        else console.log('✅ users table ready.');
    });

    // 4. Create risk_scores Table
    db.run(`CREATE TABLE IF NOT EXISTS risk_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL, -- MEMBER or GROUP
        target_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        metrics_snapshot TEXT,
        calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('❌ Error creating risk_scores table:', err.message);
        else console.log('✅ risk_scores table ready.');
    });

    // 5. Create risk_alerts Table
    db.run(`CREATE TABLE IF NOT EXISTS risk_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT,
        is_resolved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('❌ Error creating risk_alerts table:', err.message);
        else console.log('✅ risk_alerts table ready.');
    });

    // Seed a default admin user if users table is empty
    db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO users (name, email, role, status) VALUES (?, ?, ?, ?)",
                ['System Admin', 'admin@ukombozi.com', 'admin', 'active'],
                (err) => {
                    if (err) console.error('❌ Error seeding admin user:', err.message);
                    else console.log('✅ Seeded default admin user.');
                }
            );
        }
    });

    console.log('--- 🏁 SCHEMA FIXES COMPLETED ---');
});

db.close();
