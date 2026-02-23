const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('backend/ukombozini.sqlite');

db.all("PRAGMA table_info(groups)", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Columns in groups table:');
        rows.forEach(row => console.log(` - ${row.name}`));
    }
    db.close();
});
