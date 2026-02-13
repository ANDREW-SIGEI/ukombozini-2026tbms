const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const DB_PATH = path.resolve(__dirname, '../ukombozini.sqlite');

console.log('🧹 UKOMBOZINI Database Optimizer');
console.log('================================');
console.log(`Target: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Failed to connect:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database.');
});

const optimize = () => {
    const start = Date.now();

    db.serialize(() => {
        // 1. VACUUM: Rebuilds the database file, repacking it into a minimal amount of disk space.
        console.log('🔄 Running VACUUM...');
        db.run("VACUUM;", (err) => {
            if (err) console.error('   ❌ VACUUM failed:', err.message);
            else console.log('   ✅ VACUUM complete.');
        });

        // 2. ANALYZE: Gathers statistics about tables and indices and stores them in sqlite_stat1.
        console.log('📊 Running ANALYZE...');
        db.run("ANALYZE;", (err) => {
            if (err) console.error('   ❌ ANALYZE failed:', err.message);
            else console.log('   ✅ ANALYZE complete.');
        });

        // 3. WAL Checkpoint: Force write-ahead log to be fully checkpointed.
        console.log('💾 Checkpointing WAL...');
        db.run("PRAGMA wal_checkpoint(TRUNCATE);", (err) => {
            if (err) console.error('   ❌ Checkpoint failed:', err.message);
            else console.log('   ✅ WAL Checkpoint complete.');
        });
    });

    db.close((err) => {
        if (err) console.error('❌ Error closing DB:', err.message);
        else {
            const duration = (Date.now() - start) / 1000;
            console.log(`\n✨ Optimization finished in ${duration.toFixed(2)}s`);
        }
    });
};

optimize();
