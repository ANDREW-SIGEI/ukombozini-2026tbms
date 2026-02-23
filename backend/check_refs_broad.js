const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

const refs = ['TXN-1770959740984970220', 'TXN-1770984970302'];

console.log('Checking for other accounts affected by the same Tx Refs...');

db.all("SELECT account_name, direction, count(*) as cnt FROM ledger_entries WHERE tx_ref IN (?, ?) GROUP BY account_name, direction", refs, (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    rows.forEach((row) => {
        console.log(`${row.account_name} | ${row.direction} | Count: ${row.cnt}`);
    });
    db.close();
});
