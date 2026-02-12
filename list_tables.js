const db = require('./backend/db');
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(rows.map(r => r.name));
    process.exit();
});
