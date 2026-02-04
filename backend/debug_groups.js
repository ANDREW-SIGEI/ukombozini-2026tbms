const db = require('./db');
db.all('SELECT id, name FROM groups', (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    rows.forEach(row => {
        console.log(`ID: ${row.id}, Name: "${row.name}"`);
    });
    process.exit(0);
});
