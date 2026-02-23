const db = require('./db');
const MatrixService = require('./services/MatrixService');

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
        console.log(`Initial Risk Score: ${group.risk_score || 0}`);

        // 2. Trigger a mock compliance sync for '2026-02'
        const result = await MatrixService.syncCompliancePenalty(group.id, '2026-02');
        console.log('Sync Logic Result:', result);

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
            db.all("SELECT * FROM risk_scores WHERE scope = 'GROUP_COMPLIANCE_PENALTY' AND target_id = ? ORDER BY calculated_at DESC LIMIT 1", [group.id], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        if (audits.length > 0) {
            console.log('SUCCESS: Audit Log Identified');
            console.log('Metrics Snapshot:', audits[0].metrics_snapshot);
        } else {
            console.log('No penalty applied (Rate likely > 85%)');
        }

    } catch (error) {
        console.error('Verification Failed:', error);
    } finally {
        db.close();
    }
}

test();
