const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

async function createFieldOfficer() {
    const password = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const officer = {
        name: 'Test Field Officer',
        email: 'field@ukombozi.com',
        role: 'Field Officer',
        status: 'active',
        password_hash: hash
    };

    db.run(`
        INSERT INTO officers (name, email, role, status, password_hash)
        VALUES (?, ?, ?, ?, ?)
    `, [officer.name, officer.email, officer.role, officer.status, officer.password_hash], function (err) {
        if (err) {
            console.error("Error creating officer:", err.message);
        } else {
            console.log(`Created Field Officer used ID: ${this.lastID}`);
            console.log(`Email: ${officer.email}`);
            console.log(`Password: ${password}`);
        }
        db.close();
    });
}

createFieldOfficer();
