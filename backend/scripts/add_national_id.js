const db = require('../db');

const log = (msg) => console.log(JSON.stringify(msg));

db.serialize(() => {
    // 1. Add Column
    db.run("ALTER TABLE members ADD COLUMN national_id TEXT", (err) => {
        if (err && !err.message.includes("duplicate column")) {
            log({ error: "Failed to add column", details: err.message });
        } else {
            log({ success: "Column 'national_id' added (or already exists)" });
        }

        // 2. Index It
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_members_national_id ON members(national_id)", (err) => {
            if (err) log({ error: "Failed to create index", details: err.message });
            else log({ success: "Unique Index on NATIONAL_ID created" });
        });
    });
});
