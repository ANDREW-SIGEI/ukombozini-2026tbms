const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

const oldEmail = 'andrewsigei6@gmail.com';
const newEmail = 'andrewsigei684@gmail.com';
const newPassword = 'Teddymark1';

async function fixUserAndResetPassword() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        // First check if oldEmail exists
        db.get("SELECT * FROM officers WHERE email = ?", [oldEmail], (err, row) => {
            if (err) {
                console.error(err.message);
                process.exit(1);
            }
            if (!row) {
                console.log(`User ${oldEmail} not found. Checking if ${newEmail} already exists...`);
                db.get("SELECT * FROM officers WHERE email = ?", [newEmail], (err, row) => {
                    if (row) {
                        console.log(`User ${newEmail} exists. Updating password only...`);
                        updatePassword(newEmail, hash);
                    } else {
                        console.log(`Neither ${oldEmail} nor ${newEmail} found. Cannot proceed.`);
                        db.close();
                    }
                });
            } else {
                console.log(`Found user ${oldEmail}. Updating email to ${newEmail} and resetting password...`);
                db.run("UPDATE officers SET email = ?, password_hash = ? WHERE email = ?", [newEmail, hash, oldEmail], function (err) {
                    if (err) {
                        console.error('Error updating user:', err.message);
                    } else {
                        console.log(`Successfully updated user to ${newEmail} and reset password.`);
                    }
                    db.close();
                });
            }
        });
    } catch (error) {
        console.error('Error:', error);
        db.close();
    }
}

function updatePassword(email, hash) {
    db.run("UPDATE officers SET password_hash = ? WHERE email = ?", [hash, email], function (err) {
        if (err) {
            console.error('Error updating password:', err.message);
        } else {
            console.log(`Successfully reset password for ${email}.`);
        }
        db.close();
    });
}

fixUserAndResetPassword();
