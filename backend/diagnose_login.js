const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

const email = 'andrewsigei684@gmail.com';

db.get("SELECT id, name, email, role, status, password_hash FROM officers WHERE email = ?", [email], (err, row) => {
    if (err) {
        console.error("Database Error:", err);
        process.exit(1);
    }
    if (row) {
        console.log("USER_FOUND:", JSON.stringify({
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
            status: row.status,
            hasPasswordHash: !!row.password_hash,
            password_hash: row.password_hash // Taking a peek at the hash format
        }));
    } else {
        console.log("USER_NOT_FOUND");
    }
    db.close();
});
