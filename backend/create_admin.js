const db = require('./db');
require('dotenv').config();

const email = process.env.ADMIN_EMAIL || 'andrewsigei684@gmail.com';
const name = process.env.ADMIN_NAME || 'System Admin';

console.log(`Creating Admin User: ${email}...`);

db.serialize(() => {
    // Check if user exists
    db.get("SELECT id FROM officers WHERE email = ?", [email], (err, row) => {
        if (err) {
            console.error("Error checking user:", err);
            return;
        }

        if (row) {
            console.log(`User ${email} already exists (ID: ${row.id}). Updating role to Admin...`);
            db.run("UPDATE officers SET role = 'Admin', name = ? WHERE email = ?", [name, email], (err) => {
                if (err) console.error(err);
                else console.log("User updated successfully.");
            });
        } else {
            console.log("User does not exist. Creating...");
            const stmt = db.prepare("INSERT INTO officers (name, role, phone, email) VALUES (?, ?, ?, ?)");
            stmt.run(name, "Admin", "0700000000", email, (err) => {
                if (err) console.error("Insert Error:", err);
                else console.log("User created successfully.");
            });
            stmt.finalize();
        }
    });
});
