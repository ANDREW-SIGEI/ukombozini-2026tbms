const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/ukombozi.sqlite');

db.serialize(() => {
    db.all("PRAGMA table_info(loans)", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Loans Table Schema:", rows);
    });

    db.all("SELECT * FROM loans LIMIT 1", (err, rows) => {
        console.log("Sample Loan Data:", rows);
    });
});
