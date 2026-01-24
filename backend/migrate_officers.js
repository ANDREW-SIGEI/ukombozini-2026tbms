const db = require('./db');

console.log("Starting migration: Add password_hash to officers table...");

db.run("ALTER TABLE officers ADD COLUMN password_hash TEXT;", (err) => {
    if (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("Column 'password_hash' already exists. Skipping.");
            process.exit(0);
        } else {
            console.error("Migration Failed:", err);
            process.exit(1);
        }
    } else {
        console.log("Migration Successful: Added 'password_hash' column.");
        process.exit(0);
    }
});
