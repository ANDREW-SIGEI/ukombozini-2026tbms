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
}

module.exports = MatrixService;
