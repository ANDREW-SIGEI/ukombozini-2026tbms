const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

const newPassword = 'admin123';
const targetEmail = 'andrewsigei684@gmail.com'; // correcting the email just in case

bcrypt.hash(newPassword, 10, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }

    // Update user with ID 1 (System Admin)
    db.run(
        `UPDATE officers SET password_hash = ?, email = ? WHERE id = 1`,
        [hash, targetEmail],
        function (err) {
            if (err) {
                console.error('Error updating password:', err);
            } else {
                console.log(`Password reset for user ID 1. Email: ${targetEmail}, Password: ${newPassword}`);
            }
            db.close();
        }
    );
});
