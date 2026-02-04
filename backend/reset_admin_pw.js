const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('ukombozi.sqlite');

const email = 'andrewsigei684@gmail.com';
const newPassword = 'Teddymark1';

async function resetPassword() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        db.run("UPDATE officers SET password_hash = ? WHERE email = ?", [hash, email], function (err) {
            if (err) {
                console.error('Error updating password:', err.message);
            } else if (this.changes === 0) {
                console.log('No user found with that email.');
            } else {
                console.log(`Password reset successfully for ${email}`);
                console.log(`New password: ${newPassword}`);
                console.log(`New Hash: ${hash}`);
            }
            db.close();
        });
    } catch (error) {
        console.error('Error:', error);
        db.close();
    }
}

resetPassword();
