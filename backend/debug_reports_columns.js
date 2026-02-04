const db = require('./db');
console.log("--- 🕵️ Inspecting Reports Schema ---");

db.all("PRAGMA table_info(daily_cash_reports)", [], (err, rows) => {
    if (err) return console.error(err);
    if (!rows || rows.length === 0) return console.log("Table NOT FOUND or EMPTY");

    rows.forEach(r => console.log(` - ${r.name} (${r.type})`));
});
