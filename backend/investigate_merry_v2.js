const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- 🔎 MERRY BETT TRANSACTION AUDIT ---');

db.all('SELECT * FROM transactions WHERE member_id = 31 ORDER BY created_at ASC', [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }

    console.log(`Total Transactions found: ${rows.length}`);

    const summary = {};
    rows.forEach(row => {
        summary[row.transaction_type] = (summary[row.transaction_type] || 0) + 1;
        summary[row.transaction_type + '_amount'] = (summary[row.transaction_type + '_amount'] || 0) + row.amount;
    });

    console.log('Summary by Type:');
    console.log(JSON.stringify(summary, null, 2));

    console.log('\nFirst 5 transactions:');
    rows.slice(0, 5).forEach(row => {
        console.log(`[${row.id}] ${row.created_at} | ${row.transaction_type} | KES ${row.amount}`);
    });

    if (rows.length > 10) {
        console.log('\nLast 5 transactions:');
        rows.slice(-5).forEach(row => {
            console.log(`[${row.id}] ${row.created_at} | ${row.transaction_type} | KES ${row.amount}`);
        });
    }

    db.close();
});
