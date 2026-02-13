const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("Adding missing columns to loans table...");

db.serialize(() => {
    db.run("ALTER TABLE loans ADD COLUMN outstanding_interest REAL DEFAULT 0", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log("outstanding_interest already exists.");
        } else if (err) {
            console.error("Error adding outstanding_interest:", err);
        } else {
            console.log("Added outstanding_interest.");
        }
    });

    db.run("ALTER TABLE loans ADD COLUMN outstanding_penalty REAL DEFAULT 0", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log("outstanding_penalty already exists.");
        } else if (err) {
            console.error("Error adding outstanding_penalty:", err);
        } else {
            console.log("Added outstanding_penalty.");
        }
    });

    db.run("ALTER TABLE loans ADD COLUMN closed_at TEXT", (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log("closed_at already exists.");
        } else if (err) {
            console.error("Error adding closed_at:", err);
        } else {
            console.log("Added closed_at.");
        }
    });

    // Close DB after operations to ensure flushed
    db.close((err) => {
        if (err) console.error(err.message);
        else console.log('Database connection closed.');
    });
});
