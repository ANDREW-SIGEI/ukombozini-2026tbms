const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');

const db = new sqlite3.Database(dbPath);

console.log('--- 🚀 STARTING TRANSACTIONS SCHEMA NORMALIZATION ---');

db.serialize(() => {
    // 1. Add 'amount' column
    db.run("ALTER TABLE transactions ADD COLUMN amount REAL DEFAULT 0", (err) => {
        if (err) console.log('⚠️ amount column might already exist or error:', err.message);
        else console.log('✅ Added amount to transactions.');
    });

    // 2. Add 'type' column (alias for transaction_type)
    db.run("ALTER TABLE transactions ADD COLUMN type TEXT", (err) => {
        if (err) console.log('⚠️ type column might already exist or error:', err.message);
        else console.log('✅ Added type to transactions.');
    });

    // 3. Add 'loan_id' column
    db.run("ALTER TABLE transactions ADD COLUMN loan_id INTEGER", (err) => {
        if (err) console.log('⚠️ loan_id column might already exist or error:', err.message);
        else console.log('✅ Added loan_id to transactions.');
    });

    // 4. Add 'member_id' column (underscored for compatibility)
    db.run("ALTER TABLE transactions ADD COLUMN member_id INTEGER", (err) => {
        if (err) console.log('⚠️ member_id column might already exist or error:', err.message);
        else console.log('✅ Added member_id to transactions.');
    });

    // 5. Data Migration: Populate existing records
    console.log('--- ⏳ Migrating existing data... ---');
    db.run(`
        UPDATE transactions 
        SET 
            amount = COALESCE(savings_amount, stl_repayment, ltl_repayment, loan_interest, welfare, fines, withdrawals, loans_issued, 0),
            type = transaction_type,
            member_id = memberId
    `, (err) => {
        if (err) console.error('❌ Data migration error:', err.message);
        else console.log('✅ Existing data migrated.');
    });
});

db.close((err) => {
    if (err) console.error(err.message);
    else console.log('✅ Database connection closed.');
});
