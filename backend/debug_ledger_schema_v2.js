const db = require('./db');
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='ledger_entries'", (err, row) => {
    if (err) console.error(err);
    else {
        // Log cleanly
        console.log("SCHEMA DEFINITION:");
        console.log(row.sql);
    }
});
