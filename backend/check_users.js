const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        db.all("SELECT id, name, email, role FROM officers", [], (err, rows) => {
            if (err) {
                console.error('Error querying officers:', err);
            } else {
                console.log(JSON.stringify(rows, null, 2));
            }
        });
    }
});
