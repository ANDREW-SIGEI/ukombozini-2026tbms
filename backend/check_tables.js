const db = require('./db');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    rows.forEach(r => console.log(r.name));
    process.exit(0);
});
