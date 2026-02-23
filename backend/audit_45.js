const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Auditing ALL 45 entries for MEMBER_31_SAVINGS (DEBIT)...');

db.all("SELECT id, created_at, tx_ref, amount FROM ledger_entries WHERE account_name = 'MEMBER_31_SAVINGS' AND direction = 'DEBIT' ORDER BY id ASC", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(`Found ${rows.length} entries.`);
    if (rows.length > 0) {
        console.log(`Time Range: ${rows[0].created_at} to ${rows[rows.length - 1].created_at}`);
        const refs = [...new Set(rows.map(r => r.tx_ref))];
        console.log(`Unique Tx Refs: ${refs.join(', ')}`);
    }
    db.close();
});
