const db = require('./backend/db');

console.log('=== Checking Database Schema ===\n');

// Check if users table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, rows) => {
    if (err) {
        console.error('Error checking users table:', err);
    } else {
        console.log('Users table exists:', rows.length > 0);
        if (rows.length === 0) {
            console.log('❌ users table is MISSING');
        }
    }

    // Check members table for risk_score column
    db.all("PRAGMA table_info(members)", [], (err, cols) => {
        if (err) {
            console.error('Error checking members table:', err);
        } else {
            const hasRiskScore = cols.some(col => col.name === 'risk_score');
            console.log('\nMembers table columns:', cols.map(c => c.name).join(', '));
            console.log('\nrisk_score column exists:', hasRiskScore);
            if (!hasRiskScore) {
                console.log('❌ risk_score column is MISSING in members table');
            }
        }

        // Check all tables
        db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
            if (err) {
                console.error('Error listing tables:', err);
            } else {
                console.log('\n=== All Tables ===');
                tables.forEach(t => console.log('  -', t.name));
            }
            db.close();
        });
    });
});
