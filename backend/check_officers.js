const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("Checking for Field Officers in:", dbPath);

db.serialize(() => {
    db.all("SELECT id, name, email, role, status FROM officers WHERE role = 'FIELD_OFFICER'", (err, rows) => {
        if (err) {
            console.error("Error querying officers:", err);
        } else {
            if (rows.length > 0) {
                console.log("Found Field Officers:", rows);
            } else {
                console.log("No Field Officers found.");
            }
        }
    });
});

db.close();
