const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("Inspecting 'loan_products' in:", dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(loan_products)", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Schema:", rows);
        }
    });
});

db.close();
