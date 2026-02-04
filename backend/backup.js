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

        // 🔄 ROTATION: Keep only last 7 backups
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup-') && f.endsWith('.sqlite'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (files.length > 7) {
            const toDelete = files.slice(7);
            toDelete.forEach(f => {
                fs.unlinkSync(path.join(BACKUP_DIR, f.name));
                console.log(`Rotated (deleted) old backup: ${f.name}`);
            });
        }
    }
});
