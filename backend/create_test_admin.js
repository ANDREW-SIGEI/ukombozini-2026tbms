const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('ukombozini.sqlite');

(async () => {
    try {
        const h = await bcrypt.hash('testadmin', 10);
        db.run("INSERT OR REPLACE INTO officers (name, email, role, password_hash) VALUES ('Test Admin', 'test@admin.com', 'Admin', ?)", [h], function (err) {
            if (err) {
                console.error('❌ Error creating test admin:', err);
            } else {
                console.log('✅ Test Admin Created with email: test@admin.com and password: testadmin');
            }
            db.close();
        });
    } catch (e) {
        console.error('❌ Hashing error:', e);
        db.close();
    }
})();
