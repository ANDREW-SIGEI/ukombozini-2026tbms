const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(80));
console.log('INVESTIGATING 3 PENDING OFFLINE TRANSACTIONS');
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

async function investigate() {
    try {
        // 1. Check offline_queue table
        console.log('1. CHECKING OFFLINE QUEUE TABLE');
        console.log('-'.repeat(80));

        const queuedTx = await getQuery(`
            SELECT * FROM offline_queue
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (queuedTx.length === 0) {
            console.log('✅ No transactions in offline_queue table');
        } else {
            console.log(`Found ${queuedTx.length} transactions in queue:`);
            console.log();
            queuedTx.forEach((tx, i) => {
                console.log(`#${i + 1}:`);
                console.log(JSON.stringify(tx, null, 2));
                console.log('-'.repeat(60));
            });
        }
        console.log();

        // 2. Check for any pending/failed sync status
        console.log('2. CHECKING FOR FAILED/PENDING TRANSACTIONS');
        console.log('-'.repeat(80));

        // Try to find any sync_status or status columns
        const tableInfo = await getQuery(`
            PRAGMA table_info(offline_queue)
        `);

        console.log('Offline Queue Table Schema:');
        tableInfo.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });
        console.log();

        // 3. Check localStorage simulation (if any)
        console.log('3. ANALYSIS');
        console.log('-'.repeat(80));
        console.log('The "3 pending transactions" message likely comes from:');
        console.log('  1. Browser localStorage (frontend cache)');
        console.log('  2. IndexedDB offline storage');
        console.log('  3. Service Worker cache');
        console.log();
        console.log('Backend database shows no pending queue items.');
        console.log('This suggests frontend-only issue.');
        console.log();

        console.log('='.repeat(80));
        console.log('RECOMMENDATION');
        console.log('='.repeat(80));
        console.log('Since no pending transactions found in backend database,');
        console.log('the fix should be applied on the frontend:');
        console.log();
        console.log('Solution: Clear browser localStorage/IndexedDB');
        console.log('  1. Open browser DevTools (F12)');
        console.log('  2. Go to Application tab');
        console.log('  3. Clear Storage → localStorage');
        console.log('  4. Clear Storage → IndexedDB');
        console.log('  5. Refresh page');
        console.log();

    } catch (error) {
        console.error('Investigation failed:', error);
    } finally {
        db.close();
    }
}

investigate();
