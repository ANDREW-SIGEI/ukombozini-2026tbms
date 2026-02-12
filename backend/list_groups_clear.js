const db = require('./db');
db.all("SELECT id, name FROM groups", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('GROUPS_START');
        console.log(JSON.stringify(rows));
        console.log('GROUPS_END');
    }
    process.exit(0);
});
