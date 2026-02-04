const db = require('../db');

// Enable JSON mode for console logging
const log = (msg) => console.log(JSON.stringify(msg));

db.serialize(() => {
    // 1. Get Schema
    db.all("PRAGMA table_info(members)", (err, columns) => {
        if (err) {
            log({ error: "Failed to get schema", details: err.message });
            return;
        }
        log({ type: "schema", columns });

        // 2. Find Duplicates by Phone
        db.all(`
            SELECT phone, COUNT(*) as count 
            FROM members 
            WHERE phone IS NOT NULL AND phone != '' 
            GROUP BY phone 
            HAVING count > 1
        `, (err, duplicatePhones) => {
            if (err) {
                log({ error: "Failed to find phone duplicates", details: err.message });
                return;
            }
            log({ type: "duplicate_phones", count: duplicatePhones.length, details: duplicatePhones });

            // 3. Find Duplicates by Name (fuzzy check)
            db.all(`
                SELECT name, COUNT(*) as count 
                FROM members 
                GROUP BY name 
                HAVING count > 1
            `, (err, duplicateNames) => {
                if (err) {
                    log({ error: "Failed to find name duplicates", details: err.message });
                    return;
                }
                log({ type: "duplicate_names", count: duplicateNames.length, details: duplicateNames });
            });
        });
    });
});
