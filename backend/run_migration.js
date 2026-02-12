const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const migrationPath = path.join(__dirname, 'migrations', 'contribution_schema.sql');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    console.log('Database connected');

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and run each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));

    db.serialize(() => {
        statements.forEach((stmt, index) => {
            const cleanStmt = stmt.trim();
            if (cleanStmt.length > 0 && !cleanStmt.startsWith('--')) {
                db.run(cleanStmt, (err) => {
                    if (err) {
                        // Ignore "already exists" errors
                        if (!err.message.includes('already exists')) {
                            console.error(`Error in statement ${index + 1}:`, err.message);
                        }
                    } else {
                        console.log(`✓ Statement ${index + 1} executed successfully`);
                    }
                });
            }
        });
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('\n✅ Migration completed successfully');
        }
    });
});
