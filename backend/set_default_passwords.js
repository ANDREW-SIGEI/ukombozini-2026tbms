const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

// Set default password for all users
const defaultPassword = 'ukombozi123';

console.log('Setting default password for all users...');

bcrypt.hash(defaultPassword, 10, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }

    // Update all officers with the default password
    db.run(
        `UPDATE officers SET password_hash = ? WHERE password_hash IS NULL OR password_hash = ''`,
        [hash],
        function (err) {
            if (err) {
                console.error('Error updating passwords:', err);
            } else {
                console.log(`✅ Updated ${this.changes} user(s) with default password: ${defaultPassword}`);
                console.log('\nYou can now log in with any email and password: ukombozi123');
            }
            db.close();
        }
    );
});
