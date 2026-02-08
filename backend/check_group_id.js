const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbPath = path.resolve(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

const tablesToCheck = ['members', 'transactions', 'groups', 'meeting_sessions', 'loans'];
let results = '--- 🔍 CHECKING FOR group_id COLUMN ---\n';

db.serialize(() => {
    tablesToCheck.forEach(tableName => {
        db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
            if (err) {
                results += `ERROR_${tableName}: ${err.message}\n`;
            } else {
                const hasGroupId = rows.some(r => r.name === 'group_id');
                const hasMemberId = rows.some(r => r.name === 'member_id');
                const hasMemberIdCamel = rows.some(r => r.name === 'memberId');
                results += `[${tableName.toUpperCase()}] group_id: ${hasGroupId ? 'YES' : 'NO'}, member_id: ${hasMemberId ? 'YES' : 'NO'}, memberId: ${hasMemberIdCamel ? 'YES' : 'NO'}\n`;
            }

            if (tableName === tablesToCheck[tablesToCheck.length - 1]) {
                setTimeout(() => {
                    fs.writeFileSync('schema_results.txt', results);
                    console.log('Results written to schema_results.txt');
                    db.close();
                }, 500);
            }
        });
    });
});
