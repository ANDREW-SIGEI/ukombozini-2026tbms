const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

const txRef = 'TXN-1770984970302';

console.log(`--- AUDITING TX_REF: ${txRef} ---`);

db.all("SELECT * FROM transactions WHERE tx_ref = ?", [txRef], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(`Transactions found with this ref: ${rows.length}`);
    rows.forEach(row => {
        console.log(`TX ID: ${row.id} | Member: ${row.member_id} | Type: ${row.transaction_type} | Amount: ${row.amount}`);
    });
});

db.all("SELECT * FROM ledger_entries WHERE tx_ref = ?", [txRef], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(`\nLedger entries found with this ref: ${rows.length}`);
    const summary = {};
    rows.forEach(row => {
        const key = `${row.account_name} | ${row.direction}`;
        summary[key] = (summary[key] || 0) + 1;
    });
    console.log('Ledger Summary:');
    console.log(JSON.stringify(summary, null, 2));
    db.close();
});
