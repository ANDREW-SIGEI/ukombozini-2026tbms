const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'ukombozi.sqlite');

const db = new sqlite3.Database(dbPath);

console.log('--- 🚀 STARTING GROUP_ID NORMALIZATION ---');

db.serialize(() => {
    // 1. Add 'group_id' to transactions
    db.run("ALTER TABLE transactions ADD COLUMN group_id INTEGER", (err) => {
        if (err) console.log('⚠️ transactions.group_id might already exist:', err.message);
        else console.log('✅ Added group_id to transactions.');
    });

    // 2. Add 'group_id' to meeting_sessions (as alias for groupId)
    db.run("ALTER TABLE meeting_sessions ADD COLUMN group_id INTEGER", (err) => {
        if (err) console.log('⚠️ meeting_sessions.group_id might already exist:', err.message);
        else console.log('✅ Added group_id to meeting_sessions.');
    });

    // 3. Data Migration: Populate group_id in transactions from members
    console.log('--- ⏳ Migrating transactions.group_id... ---');
    db.run(`
        UPDATE transactions 
        SET group_id = (SELECT group_id FROM members WHERE members.id = transactions.memberId OR members.id = transactions.member_id)
        WHERE group_id IS NULL
    `, (err) => {
        if (err) console.error('❌ transactions migration error:', err.message);
        else console.log('✅ transactions.group_id migrated.');
    });

    // 4. Data Migration: Sync group_id with groupId in meeting_sessions
    console.log('--- ⏳ Syncing meeting_sessions.group_id... ---');
    db.run(`
        UPDATE meeting_sessions 
        SET group_id = groupId
        WHERE group_id IS NULL
    `, (err) => {
        if (err) console.error('❌ meeting_sessions sync error:', err.message);
        else console.log('✅ meeting_sessions.group_id synced.');
    });
});

db.close();
