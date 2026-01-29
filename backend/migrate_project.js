const db = require('./db');

console.log("Running Migration: Add project_balance to members...");

db.serialize(() => {
    // 1. Add project_balance column
    db.run("ALTER TABLE members ADD COLUMN project_balance REAL DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column 'project_balance' already exists.");
            } else {
                console.error("Error adding column:", err.message);
            }
        } else {
            console.log("Success: Added 'project_balance' column.");
        }
    });

    // 2. Add education and agriculture columns for the matrix if they don't exist
    // The requirement mentioned "Education/Agriculture".
    db.run("ALTER TABLE members ADD COLUMN edu_saved REAL DEFAULT 0", (err) => {
        if (!err) console.log("Success: Added 'edu_saved' column.");
    });

    db.run("ALTER TABLE members ADD COLUMN agri_saved REAL DEFAULT 0", (err) => {
        if (!err) console.log("Success: Added 'agri_saved' column.");
    });

    // 3. Verify
    db.all("PRAGMA table_info(members)", (err, rows) => {
        if (err) console.error(err);
        else {
            const columns = rows.map(r => r.name);
            console.log("Current Member Columns:", columns);
        }
    });
});
