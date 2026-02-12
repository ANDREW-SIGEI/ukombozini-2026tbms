const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("Promoting 'System Admin' (ID 1) to 'Admin' role...");
db.run("UPDATE officers SET role = 'Admin' WHERE id = 1", [], (err) => {
    if (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
    console.log('Role updated successfully.');
    db.close();
});
