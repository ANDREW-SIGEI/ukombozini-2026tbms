const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- LEDGER SUMMATION FOR MEMBER 31 ---');

db.all("SELECT account_name, direction, SUM(amount) as total_amount, COUNT(*) as cnt FROM ledger_entries WHERE account_name LIKE 'MEMBER_31_%' GROUP BY account_name, direction", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Summary:');
    rows.forEach(row => {
        console.log(`${row.account_name} | ${row.direction} | Total: ${row.total_amount} | Count: ${row.cnt}`);
    });
});

db.all("SELECT tx_ref, notes, count(*) as cnt FROM ledger_entries WHERE account_name = 'MEMBER_31_SAVINGS' AND direction = 'DEBIT' GROUP BY tx_ref, notes", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('\nDebit Details (MEMBER_31_SAVINGS):');
    rows.forEach(row => {
        console.log(`Ref: ${row.tx_ref} | Notes: ${row.notes} | Count: ${row.cnt}`);
    });
    db.close();
});
