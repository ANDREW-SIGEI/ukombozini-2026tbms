const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('='.repeat(80));
console.log('CLOSE STALE SESSIONS SCRIPT');
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

async function closeStaleSessions() {
    try {
        // 1. Identify stale sessions
        console.log('1. IDENTIFYING STALE SESSIONS');
        console.log('-'.repeat(80));

        // Define stale as older than 30 days
        const staleSessions = await getQuery(`
            SELECT id, date, groupId, status
            FROM meeting_sessions
            WHERE status = 'ACTIVE' AND date < date('now', '-30 days')
            ORDER BY date ASC
        `);

        console.log(`Found ${staleSessions.length} stale sessions:`);
        console.log();

        if (staleSessions.length === 0) {
            console.log('No stale sessions found!');
            return;
        }

        console.log('ID'.padEnd(8) + 'Date'.padEnd(15) + 'Group ID'.padEnd(10) + 'Status');
        console.log('-'.repeat(80));
        staleSessions.forEach(s => {
            console.log(
                s.id.toString().padEnd(8) +
                s.date.padEnd(15) +
                s.groupId.toString().padEnd(10) +
                s.status
            );
        });
        console.log();

        // 2. Cleanup plan
        console.log('2. CLEANUP PLAN');
        console.log('-'.repeat(80));
        console.log('This script will:');
        console.log(`  1. Update ${staleSessions.length} sessions to 'CLOSED' status`);
        console.log();

        // Check if --execute flag is present
        if (process.argv.includes('--execute')) {
            console.log('3. EXECUTING CLEANUP...');
            console.log('-'.repeat(80));

            const staleIds = staleSessions.map(s => s.id);
            const updateResult = await runQuery(`
                UPDATE meeting_sessions
                SET status = 'CLOSED'
                WHERE id IN (${staleIds.join(',')})
            `);

            console.log(`✅ Closed ${updateResult.changes} stale sessions`);
            console.log();

            console.log('='.repeat(80));
            console.log('✅ CLEANUP COMPLETE!');
            console.log('='.repeat(80));
        } else {
            console.log('='.repeat(80));
            console.log('DRY RUN COMPLETE - Run with --execute to perform update');
            console.log('='.repeat(80));
        }

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    } finally {
        setTimeout(() => db.close(), 100);
    }
}

closeStaleSessions();
