const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- 🚀 EXECUTING MERRY BETT (MEMBER 31) BALANCE FIX ---');

db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1. Delete 45 erroneous ledger entries
    db.run(
        "DELETE FROM ledger_entries WHERE account_name = 'MEMBER_31_SAVINGS' AND direction = 'DEBIT' AND amount = 40000",
        function (err) {
            if (err) {
                console.error('Error deleting ledger entries:', err.message);
                db.run("ROLLBACK");
                return;
            }
            console.log(`✅ Deleted ${this.changes} erroneous ledger entries.`);
        }
    );

    // 2. Update members table current_savings
    // Total deposits confirmed as 3960
    db.run(
        "UPDATE members SET current_savings = 3960.00 WHERE id = 31",
        function (err) {
            if (err) {
                console.error('Error updating members table:', err.message);
                db.run("ROLLBACK");
                return;
            }
            console.log('✅ Updated members table current_savings to 3,960.00.');
        }
    );

    // 3. Update account_balances table
    db.run(
        "INSERT INTO account_balances (account_name, account_category, balance) VALUES ('MEMBER_31_SAVINGS', 'MEMBER', 3960.00) ON CONFLICT(account_name) DO UPDATE SET balance = 3960.00, last_updated = CURRENT_TIMESTAMP",
        function (err) {
            if (err) {
                console.error('Error updating account_balances:', err.message);
                db.run("ROLLBACK");
                return;
            }
            console.log('✅ Synchronized account_balances for MEMBER_31_SAVINGS.');
        }
    );

    db.run("COMMIT", (err) => {
        if (err) {
            console.error('Error committing transaction:', err.message);
        } else {
            console.log('🎉 Fix applied successfully!');
        }
        db.close();
    });
});
