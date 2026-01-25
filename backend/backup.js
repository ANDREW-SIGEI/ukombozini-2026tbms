const fs = require('fs');
const path = require('path');

const DB_FILE = 'ukombozi.sqlite';
const BACKUP_DIR = 'backups';

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sqlite`);

fs.copyFile(DB_FILE, backupFile, (err) => {
    if (err) {
        console.error('Backup failed:', err);
    } else {
        console.log(`Backup successful: ${backupFile}`);
    }
});
