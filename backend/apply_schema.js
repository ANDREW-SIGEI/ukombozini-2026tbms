const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozini.sqlite');

const columns = [
    { name: 'loan_principal', type: 'REAL DEFAULT 0' },
    { name: 'project', type: 'REAL DEFAULT 0' },
    { name: 'reference', type: 'TEXT' },
    { name: 'group_id', type: 'INTEGER' },
    { name: 'status', type: "TEXT DEFAULT 'COMPLETED'" },
    { name: 'amount', type: 'REAL DEFAULT 0' },
    { name: 'type', type: 'TEXT' },
    { name: 'loan_id', type: 'INTEGER' }
];

db.serialize(() => {
    columns.forEach(col => {
        db.run(`ALTER TABLE transactions ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Column ${col.name} already exists.`);
                } else {
                    console.error(`Error adding column ${col.name}:`, err.message);
                }
            } else {
                console.log(`Successfully added column ${col.name}.`);
            }
        });
    });
});

db.close();
