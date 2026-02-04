const db = require('../db');

const log = (msg) => console.log(JSON.stringify(msg));

db.serialize(() => {
    // 1. Check columns
    db.all("PRAGMA table_info(members)", (err, columns) => {
        if (err) return log({ error: err.message });

        const hasNationalId = columns.some(c => c.name === 'national_id');
        log({ hasNationalId });

        // 2. Create Unique Index on Phone
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone ON members(phone)", (err) => {
            if (err) log({ error: "Failed to create phone index", details: err.message });
            else log({ success: "Unique Index on PHONE created/verified" });
        });

        // 3. Create Unique Index on National ID (if exists)
        if (hasNationalId) {
            db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_members_national_id ON members(national_id)", (err) => {
                if (err) log({ error: "Failed to create national_id index", details: err.message });
                else log({ success: "Unique Index on NATIONAL_ID created/verified" });
            });
        }
    });
});
