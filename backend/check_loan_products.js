const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='loan_products'", (err, rows) => {
        if (err) {
            console.error("Error checking table:", err);
            return;
        }
        if (rows.length > 0) {
            console.log("Table 'loan_products' EXISTS.");
            // Check if it has data
            db.all("SELECT count(*) as count FROM loan_products", (err, result) => {
                if (err) console.error(err);
                else console.log(`Row count: ${result[0].count}`);
            });
        } else {
            console.log("Table 'loan_products' DOES NOT EXIST.");
        }
    });
});

db.close();
