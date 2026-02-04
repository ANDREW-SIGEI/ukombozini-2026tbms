const db = require('./db');
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_cash_reports'", (err, row) => {
    if (err) console.error(err);
    else {
        console.log("SCHEMA DEFINITION:");
        console.log(row.sql);
    }
});
