const db = require('./db');

const columnsToAdd = [
    "ALTER TABLE members ADD COLUMN welfare_balance REAL DEFAULT 0",
    "ALTER TABLE members ADD COLUMN penalties REAL DEFAULT 0",
    "ALTER TABLE members ADD COLUMN risk_score INTEGER DEFAULT 50",
    "ALTER TABLE members ADD COLUMN education_savings REAL DEFAULT 0",
    "ALTER TABLE members ADD COLUMN agriculture_savings REAL DEFAULT 0"
];

db.serialize(() => {
    columnsToAdd.forEach(sql => {
        db.run(sql, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Skipping: Column already exists for ${sql}`);
                } else {
                    console.error(`Error executing ${sql}:`, err.message);
                }
            } else {
                console.log(`Success: ${sql}`);
            }
        });
    });
});
