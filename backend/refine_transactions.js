const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');

const db = new sqlite3.Database(dbPath);

console.log('--- 🚀 REFINING TRANSACTIONS NORMALIZATION ---');

db.serialize(() => {
    // 1. Data Migration: Populate existing records with better heuristics
    db.run(`
        UPDATE transactions 
        SET 
            amount = CASE 
                WHEN savings_amount > 0 THEN savings_amount
                WHEN stl_repayment > 0 THEN stl_repayment
                WHEN ltl_repayment > 0 THEN ltl_repayment
                WHEN loan_interest > 0 THEN loan_interest
                WHEN welfare > 0 THEN welfare
                WHEN fines > 0 THEN fines
                WHEN withdrawals > 0 THEN withdrawals
                WHEN loans_issued > 0 THEN loans_issued
                ELSE 0
            END,
            transaction_type = CASE
                WHEN transaction_type IS NOT NULL THEN transaction_type
                WHEN savings_amount > 0 THEN 'SAVINGS'
                WHEN stl_repayment > 0 THEN 'LOAN_REPAYMENT'
                WHEN ltl_repayment > 0 THEN 'LOAN_REPAYMENT'
                WHEN loan_interest > 0 THEN 'INTEREST_PAYMENT'
                WHEN welfare > 0 THEN 'WELFARE'
                WHEN fines > 0 THEN 'PENALTY'
                WHEN withdrawals > 0 THEN 'WITHDRAWAL'
                WHEN loans_issued > 0 THEN 'LOAN_ISSUANCE'
                ELSE 'UNKNOWN'
            END,
            member_id = COALESCE(member_id, memberId)
    `, (err) => {
        if (err) console.error('❌ Data migration error:', err.message);
        else console.log('✅ Existing data refined.');
    });

    // 2. Set 'type' column to match 'transaction_type' for report compatibility
    // But specifically for REPAYMENT, we can use an alias if needed
    db.run(`
        UPDATE transactions 
        SET type = CASE 
            WHEN transaction_type IN ('LOAN_REPAYMENT', 'INTEREST_PAYMENT', 'PENALTY_PAYMENT') THEN 'REPAYMENT'
            ELSE transaction_type
        END
    `, (err) => {
        if (err) console.error('❌ Type mapping error:', err.message);
        else console.log('✅ Type column mapped for reports.');
    });
});

db.close();
