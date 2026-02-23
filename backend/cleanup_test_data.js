const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(80));
console.log('TEST DATA CLEANUP SCRIPT');
console.log('='.repeat(80));
console.log();

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

async function cleanup() {
    try {
        // 1. Identify test members
        console.log('1. IDENTIFYING TEST MEMBERS');
        console.log('-'.repeat(80));

        const testMembers = await getQuery(`
            SELECT id, name, phone, current_savings, active_loan_balance
            FROM members
            WHERE 
                name LIKE '%Test%' OR
                name LIKE '%test%' OR
                name LIKE '%Borrower%' OR
                name LIKE '%Guarantor%' OR
                name LIKE '%Div Test%' OR
                name LIKE '%Verif%' OR
                name LIKE '%1769%' OR
                name = 'Bob' OR
                name = 'Alice' OR
                name LIKE 'Member A%' OR
                name LIKE 'Member B%'
            ORDER BY name
        `);

        console.log(`Found ${testMembers.length} potential test members:`);
        console.log();

        if (testMembers.length === 0) {
            console.log('No test members found!');
            return;
        }

        console.log('ID'.padEnd(8) + 'Name'.padEnd(35) + 'Savings'.padEnd(15) + 'Loans');
        console.log('-'.repeat(80));
        testMembers.forEach(m => {
            console.log(
                m.id.toString().padEnd(8) +
                (m.name || '').padEnd(35) +
                ((m.current_savings || 0).toLocaleString() + ' KES').padEnd(15) +
                ((m.active_loan_balance || 0).toLocaleString() + ' KES')
            );
        });
        console.log();

        // 2. Calculate totals
        const totalSavings = testMembers.reduce((sum, m) => sum + (m.current_savings || 0), 0);
        const totalLoans = testMembers.reduce((sum, m) => sum + (m.active_loan_balance || 0), 0);

        console.log('2. IMPACT ANALYSIS');
        console.log('-'.repeat(80));
        console.log(`Total Test Members: ${testMembers.length}`);
        console.log(`Total Savings: ${totalSavings.toLocaleString()} KES`);
        console.log(`Total Loans: ${totalLoans.toLocaleString()} KES`);
        console.log();

        // 3. Check for transactions
        const testMemberIds = testMembers.map(m => m.id);
        const transactionCounts = await getQuery(`
            SELECT member_id, COUNT(*) as tx_count
            FROM transactions
            WHERE member_id IN (${testMemberIds.join(',')})
            GROUP BY member_id
        `);

        const totalTransactions = transactionCounts.reduce((sum, t) => sum + t.tx_count, 0);

        console.log('3. TRANSACTION ANALYSIS');
        console.log('-'.repeat(80));
        console.log(`Members with transactions: ${transactionCounts.length}`);
        console.log(`Total transactions: ${totalTransactions}`);
        console.log();

        // 4. Cleanup plan
        console.log('4. CLEANUP PLAN');
        console.log('-'.repeat(80));
        console.log('This script will:');
        console.log(`  1. Delete ${totalTransactions} transactions for test members`);
        console.log(`  2. Delete ${testMembers.length} test member records`);
        console.log();

        // Check if --execute flag is present
        if (process.argv.includes('--execute')) {
            console.log('5. EXECUTING CLEANUP...');
            console.log('-'.repeat(80));

            // Delete transactions first (foreign key constraint)
            if (totalTransactions > 0) {
                const txDeleteResult = await runQuery(`
                    DELETE FROM transactions
                    WHERE member_id IN (${testMemberIds.join(',')})
                `);
                console.log(`✅ Deleted ${txDeleteResult.changes} transactions`);
            }

            // Delete members
            const memberDeleteResult = await runQuery(`
                DELETE FROM members
                WHERE id IN (${testMemberIds.join(',')})
            `);
            console.log(`✅ Deleted ${memberDeleteResult.changes} member records`);
            console.log();

            console.log('='.repeat(80));
            console.log('✅ CLEANUP COMPLETE!');
            console.log('='.repeat(80));
        } else {
            console.log('='.repeat(80));
            console.log('DRY RUN COMPLETE - Run with --execute to perform deletion');
            console.log('='.repeat(80));
        }

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    } finally {
        // Wait a bit before closing to ensure buffers flush
        setTimeout(() => db.close(), 100);
    }
}

cleanup();
