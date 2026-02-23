const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

db.all('SELECT email, role FROM officers', [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Officers in DB:');
        console.log(rows);
    }
    db.close();
});
