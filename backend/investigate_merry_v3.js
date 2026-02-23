const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- MERRY BETT WITHDRAWAL AUDIT ---');

db.all("SELECT * FROM transactions WHERE member_id = 31 AND transaction_type = 'WITHDRAWAL' ORDER BY created_at ASC", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }

    if (rows.length === 0) {
        console.log('No withdrawals found.');
        db.close();
        return;
    }

    console.log(`Withdrawals count: ${rows.length}`);
    console.log(`First Withdrawal: ${rows[0].created_at} (ID: ${rows[0].id})`);
    console.log(`Last Withdrawal: ${rows[rows.length - 1].created_at} (ID: ${rows[rows.length - 1].id})`);

    const amounts = rows.map(r => r.amount);
    const uniqueAmounts = [...new Set(amounts)];
    console.log(`Unique amounts: ${uniqueAmounts.join(', ')}`);

    db.close();
});
