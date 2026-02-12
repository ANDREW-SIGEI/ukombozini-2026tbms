const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT id, email, name, role, status FROM officers", (err, rows) => {
        if (err) {
            console.error(err.message);
            process.exit(1);
        }
        console.log(JSON.stringify(rows, null, 2));
        db.close();
    });
});
