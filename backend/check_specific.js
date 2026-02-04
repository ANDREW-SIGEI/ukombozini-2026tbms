const db = require('./db');
const tables = ['cash_sessions', 'cash_transactions'];

tables.forEach(table => {
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
        if (row) console.log(`${table} EXISTS`);
        else console.log(`${table} MISSING`);
    });
});
setTimeout(() => process.exit(0), 1000);
