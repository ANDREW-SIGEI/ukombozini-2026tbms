const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

db.all("SELECT id, name, current_savings, active_loan_balance FROM members WHERE id = 31 OR name LIKE '%MERRY BETT%';", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log("Member Data:");
    console.table(rows);
    db.close();
});
