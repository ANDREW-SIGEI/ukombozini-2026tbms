const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('ukombozini.sqlite');

const email = 'andrewsigei684@gmail.com';
const newPassword = 'password123'; // Temporary password for verification

async function resetPassword() {
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run("UPDATE officers SET password_hash = ? WHERE email = ?", [hashedPassword, email], function (err) {
            if (err) {
                console.error("Update Error:", err);
                process.exit(1);
            }
            if (this.changes > 0) {
                console.log(`SUCCESS: Password for ${email} reset to '${newPassword}'`);
            } else {
                console.log("USER_NOT_FOUND");
            }
            db.close();
        });
    } catch (e) {
        console.error("Hash Error:", e);
        process.exit(1);
    }
}

resetPassword();
