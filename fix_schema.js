const db = require('./backend/db');

console.log('=== Fixing Database Schema ===\n');

db.serialize(() => {
    // Add risk_score column to members table
    db.run(`ALTER TABLE members ADD COLUMN risk_score INTEGER DEFAULT 0`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log('✅ risk_score column already exists');
            } else {
                console.error('❌ Error adding risk_score column:', err.message);
            }
        } else {
            console.log('✅ Added risk_score column to members table');
        }

        // Verify the fix
        db.all("PRAGMA table_info(members)", [], (err, cols) => {
            if (err) {
                console.error('Error verifying members table:', err);
            } else {
                const hasRiskScore = cols.some(col => col.name === 'risk_score');
                console.log('\n=== Verification ===');
                console.log('risk_score column exists:', hasRiskScore ? '✅ YES' : '❌ NO');
            }

            db.close(() => {
                console.log('\n✅ Schema fix complete!');
            });
        });
    });
});
