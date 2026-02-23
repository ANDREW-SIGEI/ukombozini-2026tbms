/**
 * UKOMBOZINI Institutional - MatrixService
 * Logic for calculating and enforcing partnership tiers.
 */

const db = require('../db');

class MatrixService {
    /**
     * Get the active tier for a group based on its score.
     */
    static async getGroupTier(groupId) {
        return new Promise((resolve, reject) => {
            // 1. Get Group Risk Score (0 = Perfect, 100 = Maximum Risk)
            db.get("SELECT risk_score, name FROM groups WHERE id = ?", [groupId], (err, group) => {
                if (err) return reject(err);
                if (!group) return reject(new Error("Group not found"));

                // Invert: 0 risk becomes 100 score, 100 risk becomes 0 score
                const rawRisk = group.risk_score || 0;
                const score = Math.max(0, 100 - rawRisk);

                // 2. Find matching tier
                db.all("SELECT * FROM partnership_tiers ORDER BY min_score DESC", [], (err, tiers) => {
                    if (err) return reject(err);
                    if (!tiers || tiers.length === 0) return reject(new Error("No partnership tiers defined"));

                    const currentTier = tiers.find(t => score >= t.min_score) || tiers[tiers.length - 1];
                    const nextTier = tiers[tiers.indexOf(currentTier) - 1] || null;

                    resolve({
                        groupId,
                        groupName: group.name,
                        score,
                        currentTier,
                        nextTier,
                        isMaxTier: !nextTier,
                        pointsToNext: nextTier ? (nextTier.min_score - score) : 0
                    });
                });
            });
        });
    }

    /**
     * Calculate the maximum allowed Company Top-Up for a group.
     */
    static async getFundingLimit(groupId) {
        const status = await this.getGroupTier(groupId);

        return new Promise((resolve, reject) => {
            // Get total commitment for the group from group_commitments
            // This is the source of truth for institutional security deposits
            db.get(`
                SELECT SUM(amount) as total_commitment 
                FROM group_commitments 
                WHERE group_id = ? AND status IN ('LOCKED', 'ACTIVE')
            `, [groupId], (err, row) => {
                if (err) return reject(err);

                const commitment = row.total_commitment || 0;
                const limit = commitment * status.currentTier.multiplier;

                resolve({
                    limit,
                    multiplier: status.currentTier.multiplier,
                    currentCommitment: commitment,
                    tierName: status.currentTier.tier_name
                });
            });
        });
    }

    /**
     * Update institutional health based on contribution compliance.
     * Triggered automatically when performance is audited.
     */
    static async syncCompliancePenalty(groupId, month) {
        if (!groupId || groupId === 'all') return;

        return new Promise((resolve, reject) => {
            let [year, monthNum] = month.split('-');
            const mStr = monthNum.padStart(2, '0');

            // 1. Calculate current compliance rate for the group
            const complianceQuery = `
                SELECT 
                    COUNT(*) as totalMembers,
                    SUM(CASE WHEN contributionStatus = 'Paid' THEN 1 ELSE 0 END) as paidMembers
                FROM (
                    SELECT 
                        m.id,
                        CASE 
                            WHEN COALESCE(SUM(t.savings_amount), 0) >= g.minMonthlySaving THEN 'Paid'
                            ELSE 'Skipped'
                        END as contributionStatus
                    FROM members m
                    JOIN groups g ON m.group_id = g.id
                    LEFT JOIN transactions t ON m.id = t.memberId 
                        AND strftime('%m', t.created_at) = ? 
                        AND strftime('%Y', t.created_at) = ?
                    WHERE g.id = ?
                    GROUP BY m.id
                )
            `;

            db.get(complianceQuery, [mStr, year, groupId], (err, stats) => {
                if (err) return reject(err);
                if (!stats || stats.totalMembers === 0) return resolve();

                const rate = (stats.paidMembers / stats.totalMembers) * 100;
                const threshold = 85;
                let penalty = 0;

                // 2. Calculate Penalty: 1.5 risk points for every 1% below threshold
                if (rate < threshold) {
                    penalty = (threshold - rate) * 1.5;
                }

                // 3. Update Group Risk Score (Apply Penalty)
                // We add the penalty to the existing risk_score (capped at 100)
                db.run(`
                    UPDATE groups 
                    SET risk_score = MIN(100, COALESCE(risk_score, 0) + ?) 
                    WHERE id = ?
                `, [penalty, groupId], function (err) {
                    if (err) return reject(err);

                    // 4. Log the Risk Event for Audit
                    if (penalty > 0) {
                        const snapshot = JSON.stringify({
                            month,
                            complianceRate: rate.toFixed(1),
                            paid: stats.paidMembers,
                            total: stats.totalMembers,
                            penaltyApplied: penalty.toFixed(1)
                        });
                        db.run(`
                            INSERT INTO risk_scores (scope, target_id, score, metrics_snapshot)
                            VALUES ('GROUP_COMPLIANCE_PENALTY', ?, ?, ?)
                        `, [groupId, penalty, snapshot]);
                    }

                    resolve({ rate, penalty });
                });
            });
        });
    }
}

module.exports = MatrixService;
