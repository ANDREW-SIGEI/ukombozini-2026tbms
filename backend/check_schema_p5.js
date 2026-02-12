const db = require('./db');

db.all("PRAGMA table_info(members)", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("--- MEMBERS TABLE COLUMNS ---");
        rows.forEach(row => console.log(row.name));
    }
    db.all("PRAGMA table_info(groups)", [], (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("\n--- GROUPS TABLE COLUMNS ---");
            rows.forEach(row => console.log(row.name));
        }
        process.exit(0);
    });
});
