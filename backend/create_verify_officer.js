const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('ukombozini.sqlite');

async function createOfficer() {
    const password = 'Verify123!';
    const hash = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO officers (name, role, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)",
        ["Verify Admin", "Admin", "0000", "verify@admin.com", hash],
        function (err) {
            if (err) {
                console.error(err.message);
            } else {
                console.log(`Verification officer created with ID: ${this.lastID}`);
            }
            db.close();
        }
    );
}

createOfficer();
