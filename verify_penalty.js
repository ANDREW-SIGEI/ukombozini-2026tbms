const db = require('./backend/db');
const MatrixService = require('./backend/services/MatrixService');

async function test() {
    try {
        console.log('--- Institutional Matrix Penalty Verification ---');

        // 1. Get a random group
        const group = await new Promise((resolve, reject) => {
            db.get("SELECT id, name, risk_score FROM groups LIMIT 1", (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!group) {
            console.log('No groups found for testing.');
            return;
        }

        console.log(`Testing Group: ${group.name} (ID: ${group.id})`);
        console.log(`Current Risk Score: ${group.risk_score}`);

        // 2. Trigger a mock compliance sync for '2026-02'
        // We use a date that likely has some data or defaults to penalty
        const result = await MatrixService.syncCompliancePenalty(group.id, '2026-02');
        console.log('Sync Result:', result);

        // 3. Verify Updated Risk Score
        const updatedGroup = await new Promise((resolve, reject) => {
            db.get("SELECT risk_score FROM groups WHERE id = ?", [group.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        console.log(`Updated Risk Score: ${updatedGroup.risk_score}`);
        console.log('Penalty Delta:', updatedGroup.risk_score - (group.risk_score || 0));

        // 4. Check Audit Logs
        const audits = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM risk_scores WHERE target_id = ? ORDER BY calculated_at DESC LIMIT 1", [group.id], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
        console.log('Latest Audit Log:', audits[0] ? JSON.parse(audits[0].metrics_snapshot) : 'None');

    } catch (error) {
        console.error('Verification Failed:', error);
    } finally {
        db.close();
    }
}

test();
