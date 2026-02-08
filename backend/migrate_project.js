const db = require('./db');

const isPostgres = !!process.env.DATABASE_URL;
const DECIMAL = isPostgres ? "DECIMAL(20,2)" : "REAL";

console.log(`Running Migration: Add project_balance to members (${isPostgres ? 'Postgres' : 'SQLite'})...`);

const migrate = () => {
    // 1. Add project_balance column
    db.run(`ALTER TABLE members ADD COLUMN project_balance ${DECIMAL} DEFAULT 0`, (err) => {
        if (err) {
            if (err.message.includes("duplicate") || err.message.includes("already exists")) {
                console.log("Column 'project_balance' already exists.");
            } else {
                console.error("Error adding column 'project_balance':", err.message);
            }
        } else {
            console.log("Success: Added 'project_balance' column.");
        }
    });

    // 2. Add education and agriculture columns for the matrix if they don't exist
    db.run(`ALTER TABLE members ADD COLUMN edu_saved ${DECIMAL} DEFAULT 0`, (err) => {
        if (!err) console.log("Success: Added 'edu_saved' column.");
    });

    db.run(`ALTER TABLE members ADD COLUMN agri_saved ${DECIMAL} DEFAULT 0`, (err) => {
        if (!err) console.log("Success: Added 'agri_saved' column.");
    });

    // 3. Verify
    if (isPostgres) {
        db.all("SELECT column_name FROM information_schema.columns WHERE table_name = 'members'", (err, rows) => {
            if (err) console.error(err);
            else console.log("Current Member Columns (PG):", rows.map(r => r.column_name));
        });
    } else {
        db.all("PRAGMA table_info(members)", (err, rows) => {
            if (err) console.error(err);
            else console.log("Current Member Columns (SQLite):", rows.map(r => r.name));
        });
    }
};

if (typeof db.serialize === 'function') {
    db.serialize(migrate);
} else {
    migrate();
}
