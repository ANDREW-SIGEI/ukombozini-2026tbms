const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('=== COMPREHENSIVE DATABASE CHECK ===\n');

// 1. Check all tables
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
    if (err) {
        console.error('Error listing tables:', err);
        return;
    }

    console.log('📋 Available Tables:');
    const tableNames = tables.map(t => t.name);
    tableNames.forEach(name => console.log(`   - ${name}`));

    const hasUsers = tableNames.includes('users');
    const hasOfficers = tableNames.includes('officers');

    console.log(`\n🔍 Table Check:`);
    console.log(`   users table exists: ${hasUsers ? '✅' : '❌'}`);
    console.log(`   officers table exists: ${hasOfficers ? '✅' : '❌'}`);

    // 2. Check members table structure
    db.all("PRAGMA table_info(members)", [], (err, cols) => {
        if (err) {
            console.error('Error checking members structure:', err);
            return;
        }

        console.log(`\n📊 Members Table Columns:`);
        cols.forEach(col => {
            console.log(`   - ${col.name} (${col.type})${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
        });

        const hasRiskScore = cols.some(c => c.name === 'risk_score');
        console.log(`\n🔍 Column Check:`);
        console.log(`   risk_score exists: ${hasRiskScore ? '✅' : '❌'}`);

        // 3. Check if officers table has what we need
        if (hasOfficers) {
            db.all("PRAGMA table_info(officers)", [], (err, officerCols) => {
                if (err) {
                    console.error('Error checking officers structure:', err);
                } else {
                    console.log(`\n📊 Officers Table Columns:`);
                    officerCols.forEach(col => {
                        console.log(`   - ${col.name} (${col.type})`);
                    });
                }
                db.close();
            });
        } else {
            db.close();
        }
    });
});
