const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(80));
console.log('FIX SCRIPT: MERRY BETT NEGATIVE BALANCE');
console.log('Option 1: Delete All Erroneous Withdrawals');
console.log('='.repeat(80));
console.log();

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function fixBalance() {
    try {
        // 1. Get current state
        console.log('1. CURRENT STATE (Before Fix)');
        console.log('-'.repeat(80));
        const beforeMember = await getQuery(`
            SELECT id, name, current_savings, active_loan_balance
            FROM members WHERE id = 31
        `);

        if (beforeMember.length === 0) {
            console.log('ERROR: MERRY BETT not found!');
            process.exit(1);
        }

        console.log(`Member: ${beforeMember[0].name}`);
        console.log(`Current Savings: ${beforeMember[0].current_savings?.toLocaleString() || 0} KES`);
        console.log(`Active Loans: ${beforeMember[0].active_loan_balance?.toLocaleString() || 0} KES`);
        console.log();

        // 2. Count withdrawals to be deleted
        const withdrawalCount = await getQuery(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM transactions
            WHERE member_id = 31 AND transaction_type = 'WITHDRAWAL'
        `);

        console.log('2. TRANSACTIONS TO BE DELETED');
        console.log('-'.repeat(80));
        console.log(`Total Withdrawals: ${withdrawalCount[0].count}`);
        console.log(`Total Amount: ${withdrawalCount[0].total?.toLocaleString() || 0} KES`);
        console.log();

        // 3. Delete withdrawals
        console.log('3. DELETING ERRONEOUS WITHDRAWALS...');
        console.log('-'.repeat(80));
        const deleteResult = await runQuery(`
            DELETE FROM transactions 
            WHERE member_id = 31 AND transaction_type = 'WITHDRAWAL'
        `);

        console.log(`✅ Deleted ${deleteResult.changes} withdrawal transactions`);
        console.log();

        // 4. Recalculate balance
        console.log('4. RECALCULATING BALANCE...');
        console.log('-'.repeat(80));

        const newBalance = await getQuery(`
            SELECT COALESCE(SUM(
                CASE 
                    WHEN transaction_type IN ('savings', 'opening_balance_savings') THEN amount
                    WHEN transaction_type IN ('withdrawal', 'savings_withdrawal') THEN -amount
                    ELSE 0
                END
            ), 0) as calculated_balance
            FROM transactions
            WHERE member_id = 31
        `);

        console.log(`Calculated Balance: ${newBalance[0].calculated_balance.toLocaleString()} KES`);

        const updateResult = await runQuery(`
            UPDATE members 
            SET current_savings = ?
            WHERE id = 31
        `, [newBalance[0].calculated_balance]);

        console.log(`✅ Updated member balance (${updateResult.changes} row affected)`);
        console.log();

        // 5. Verify fix
        console.log('5. FINAL STATE (After Fix)');
        console.log('-'.repeat(80));
        const afterMember = await getQuery(`
            SELECT id, name, current_savings, active_loan_balance
            FROM members WHERE id = 31
        `);

        console.log(`Member: ${afterMember[0].name}`);
        console.log(`New Savings Balance: ${afterMember[0].current_savings?.toLocaleString() || 0} KES`);
        console.log(`Active Loans: ${afterMember[0].active_loan_balance?.toLocaleString() || 0} KES`);
        console.log(`Net Position: ${((afterMember[0].current_savings || 0) - (afterMember[0].active_loan_balance || 0)).toLocaleString()} KES`);
        console.log();

        // 6. Remaining transactions
        const remainingTx = await getQuery(`
            SELECT transaction_type, COUNT(*) as count, SUM(amount) as total
            FROM transactions
            WHERE member_id = 31
            GROUP BY transaction_type
        `);

        console.log('6. REMAINING TRANSACTIONS');
        console.log('-'.repeat(80));
        if (remainingTx.length === 0) {
            console.log('No transactions remaining');
        } else {
            console.log('Type'.padEnd(20) + 'Count'.padEnd(10) + 'Total (KES)');
            console.log('-'.repeat(50));
            remainingTx.forEach(tx => {
                console.log(
                    tx.transaction_type.padEnd(20) +
                    tx.count.toString().padEnd(10) +
                    (tx.total?.toLocaleString() || '0')
                );
            });
        }
        console.log();

        console.log('='.repeat(80));
        console.log('✅ FIX COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(80));
        console.log();
        console.log('Summary:');
        console.log(`  - Deleted: ${deleteResult.changes} withdrawal transactions`);
        console.log(`  - Old Balance: ${beforeMember[0].current_savings?.toLocaleString()} KES`);
        console.log(`  - New Balance: ${afterMember[0].current_savings?.toLocaleString()} KES`);
        console.log(`  - Change: +${(afterMember[0].current_savings - beforeMember[0].current_savings).toLocaleString()} KES`);
        console.log();

    } catch (error) {
        console.error('❌ Fix failed:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

fixBalance();
