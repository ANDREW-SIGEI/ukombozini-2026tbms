const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(80));
console.log('INVESTIGATION REPORT: MERRY BETT NEGATIVE BALANCE ANOMALY');
console.log('='.repeat(80));
console.log();

// Helper function to run queries
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function investigate() {
    try {
        // 1. Get member details
        console.log('1. MEMBER PROFILE');
        console.log('-'.repeat(80));
        const member = await runQuery(`
            SELECT m.*, g.name as group_name
            FROM members m
            LEFT JOIN groups g ON m.group_id = g.id
            WHERE m.name = 'MERRY BETT'
        `);

        if (member.length === 0) {
            console.log('ERROR: MERRY BETT not found in database!');
            process.exit(1);
        }

        const merryBett = member[0];
        console.log(`Name: ${merryBett.name}`);
        console.log(`ID: ${merryBett.id}`);
        console.log(`Group: ${merryBett.group_name || 'No Group'}`);
        console.log(`Phone: ${merryBett.phone || 'N/A'}`);
        console.log(`Current Savings: ${merryBett.current_savings?.toLocaleString() || 0} KES`);
        console.log(`Active Loans: ${merryBett.active_loan_balance?.toLocaleString() || 0} KES`);
        console.log(`Net Position: ${((merryBett.current_savings || 0) - (merryBett.active_loan_balance || 0)).toLocaleString()} KES`);
        console.log();

        // 2. Count all transactions
        console.log('2. TRANSACTION SUMMARY');
        console.log('-'.repeat(80));
        const txCount = await runQuery(`
            SELECT 
                transaction_type,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM transactions
            WHERE member_id = ?
            GROUP BY transaction_type
            ORDER BY total_amount DESC
        `, [merryBett.id]);

        if (txCount.length === 0) {
            console.log('No transactions found for MERRY BETT');
        } else {
            console.log('Transaction Type'.padEnd(25) + 'Count'.padEnd(10) + 'Total Amount (KES)');
            console.log('-'.repeat(60));
            txCount.forEach(tx => {
                console.log(
                    tx.transaction_type.padEnd(25) +
                    tx.count.toString().padEnd(10) +
                    (tx.total_amount?.toLocaleString() || '0')
                );
            });
        }
        console.log();

        // 3. Get all transactions chronologically
        console.log('3. TRANSACTION HISTORY (Chronological)');
        console.log('-'.repeat(80));
        const transactions = await runQuery(`
            SELECT 
                id,
                transaction_type,
                amount,
                created_at,
                notes
            FROM transactions
            WHERE member_id = ?
            ORDER BY created_at ASC
        `, [merryBett.id]);

        if (transactions.length === 0) {
            console.log('No transactions found');
        } else {
            console.log(`Total Transactions: ${transactions.length}`);
            console.log();

            let runningBalance = 0;
            transactions.forEach((tx, index) => {
                // Calculate running balance (simplified)
                if (['savings', 'welfare', 'education_project', 'agriculture_project'].includes(tx.transaction_type)) {
                    runningBalance += tx.amount;
                } else if (['withdrawal', 'savings_withdrawal'].includes(tx.transaction_type)) {
                    runningBalance -= tx.amount;
                }

                console.log(`#${index + 1} | ${new Date(tx.created_at).toISOString().split('T')[0]} | ${tx.transaction_type.padEnd(20)} | ${tx.amount.toLocaleString().padStart(12)} KES | Balance: ${runningBalance.toLocaleString()}`);
                if (tx.notes) console.log(`    Notes: ${tx.notes}`);
            });
        }
        console.log();

        // 4. Check for suspicious large transactions
        console.log('4. SUSPICIOUS LARGE TRANSACTIONS (> 100,000 KES)');
        console.log('-'.repeat(80));
        const largeTx = await runQuery(`
            SELECT 
                id,
                transaction_type,
                amount,
                created_at,
                session_id,
                notes
            FROM transactions
            WHERE member_id = ? AND ABS(amount) > 100000
            ORDER BY ABS(amount) DESC
        `, [merryBett.id]);

        if (largeTx.length === 0) {
            console.log('No large transactions found');
        } else {
            largeTx.forEach(tx => {
                console.log(`ID: ${tx.id}`);
                console.log(`Type: ${tx.transaction_type}`);
                console.log(`Amount: ${tx.amount.toLocaleString()} KES`);
                console.log(`Date: ${tx.created_at}`);
                console.log(`Session: ${tx.session_id || 'N/A'}`);
                console.log(`Notes: ${tx.notes || 'N/A'}`);
                console.log('-'.repeat(60));
            });
        }
        console.log();

        // 5. Manual calculation of savings balance
        console.log('5. MANUAL BALANCE CALCULATION');
        console.log('-'.repeat(80));
        const deposits = await runQuery(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE member_id = ? 
            AND transaction_type IN ('savings', 'opening_balance_savings')
        `, [merryBett.id]);

        const withdrawals = await runQuery(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE member_id = ? 
            AND transaction_type IN ('withdrawal', 'savings_withdrawal')
        `, [merryBett.id]);

        const calculatedBalance = deposits[0].total - withdrawals[0].total;

        console.log(`Total Deposits: ${deposits[0].total.toLocaleString()} KES`);
        console.log(`Total Withdrawals: ${withdrawals[0].total.toLocaleString()} KES`);
        console.log(`Calculated Balance: ${calculatedBalance.toLocaleString()} KES`);
        console.log(`Database Balance: ${(merryBett.current_savings || 0).toLocaleString()} KES`);
        console.log(`Discrepancy: ${((merryBett.current_savings || 0) - calculatedBalance).toLocaleString()} KES`);
        console.log();

        // 6. Check ledger entries
        console.log('6. TRIPLE-ENTRY LEDGER VERIFICATION');
        console.log('-'.repeat(80));
        const ledgerEntries = await runQuery(`
            SELECT 
                account_type,
                credit_debit,
                SUM(amount) as total
            FROM ledger_entries
            WHERE member_id = ?
            GROUP BY account_type, credit_debit
            ORDER BY account_type, credit_debit
        `, [merryBett.id]);

        if (ledgerEntries.length === 0) {
            console.log('No ledger entries found (possible issue!)');
        } else {
            console.log('Account Type'.padEnd(25) + 'Credit/Debit'.padEnd(15) + 'Total (KES)');
            console.log('-'.repeat(60));
            ledgerEntries.forEach(entry => {
                console.log(
                    entry.account_type.padEnd(25) +
                    entry.credit_debit.padEnd(15) +
                    (entry.total?.toLocaleString() || '0')
                );
            });
        }
        console.log();

        // 7. Recommendations
        console.log('7. RECOMMENDATIONS');
        console.log('-'.repeat(80));

        if (merryBett.current_savings < -1000000) {
            console.log('🚨 CRITICAL: Balance is severely negative (< -1M KES)');
            console.log('Possible causes:');
            console.log('  1. Erroneous bulk withdrawal transaction');
            console.log('  2. Database corruption or migration error');
            console.log('  3. Duplicate transaction processing');
            console.log('  4. Manual database manipulation');
            console.log();
            console.log('Suggested actions:');
            console.log('  1. Review all transactions > 100K KES above');
            console.log('  2. Delete erroneous transactions if found');
            console.log('  3. Run balance recalculation script');
            console.log('  4. Create compensating transaction if needed');
        } else {
            console.log('Balance is within acceptable range');
        }

        console.log();
        console.log('='.repeat(80));
        console.log('END OF INVESTIGATION REPORT');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Investigation failed:', error);
    } finally {
        db.close();
    }
}

investigate();
