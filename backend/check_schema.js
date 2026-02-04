const db = require('./db');
const tables = ['dividend_runs', 'dividend_allocations'];

async function check() {
    for (const table of tables) {
        console.log(`--- Schema for ${table} ---`);
        await new Promise((resolve) => {
            db.all(`PRAGMA table_info(${table})`, (err, rows) => {
                if (err) console.error(err);
                else console.log(JSON.stringify(rows, null, 2));
                resolve();
            });
        });
    }
    process.exit(0);
}

check();
