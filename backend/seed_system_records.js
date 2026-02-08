const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- 🚀 SEEDING SYSTEM RECORDS (ID 0) ---');

db.serialize(() => {
    // Disable FK temporarily to allow inserting ID 0 if AUTOINCREMENT starts at 1
    db.run('PRAGMA foreign_keys = OFF');

    // 1. Ensure SYSTEM Group exists with ID 0
    db.run(`
        INSERT OR IGNORE INTO groups (id, name, status) 
        VALUES (0, 'SYSTEM_INTERNAL', 'active')
    `, (err) => {
        if (err) console.error('❌ Error seeding SYSTEM Group:', err.message);
        else console.log('✅ SYSTEM Group (ID 0) checked/seeded.');
    });

    // 2. Ensure SYSTEM Member exists with ID 0
    db.run(`
        INSERT OR IGNORE INTO members (id, name, group_id, status) 
        VALUES (0, 'SYSTEM_RESERVE', 0, 'active')
    `, (err) => {
        if (err) console.error('❌ Error seeding SYSTEM Member:', err.message);
        else console.log('✅ SYSTEM Member (ID 0) checked/seeded.');
    });

    db.run('PRAGMA foreign_keys = ON');
});

setTimeout(() => {
    db.close();
    console.log('--- Done ---');
}, 1000);
