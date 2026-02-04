const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("Getting CREATE statement for cash_sessions...");

db.get("SELECT sql FROM sqlite_master WHERE name='cash_sessions'", (err, row) => {
    if (err) console.error(err);
    else console.log(row.sql);
    db.close();
});
