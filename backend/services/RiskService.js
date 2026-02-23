const db = require('../db');

/**
 * RiskService calculates health and fraud risk scores for groups and officers.
 * 0-40: High Risk (Red)
 * 41-70: Medium Risk (Orange)
 * 71-100: Healthy (Green)
 */
class RiskService {
    /**
     * 🛡️ Batch Compliance Status: Get monthly contribution status for all members in a group.
     */
    static async getGroupComplianceStatus(groupId) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    m.id, 
                    COALESCE((
                        SELECT SUM(savings_amount) 
                        FROM transactions 
                        WHERE memberId = m.id 
                        AND strftime('%Y-%m', created_at) = ?
                    ), 0) as monthContribution
                FROM members m
                WHERE m.group_id = ?
            `;

            db.all(query, [currentMonth, groupId], (err, rows) => {
                if (err) return reject(err);

                const stats = {};
                rows.forEach(r => {
                    stats[r.id] = {
                        compliant: r.monthContribution > 0,
                        contribution: r.monthContribution
                    };
                });
                resolve(stats);
            });
        });
    }

    /**
     * 🧠 Calculate dynamic risk score and trigger automated enforcement.
     * Scores: 0-40 (High/Red), 41-70 (Medium/Orange), 71-100 (Healthy/Green)
     */
    static async evaluateGroupRisk(groupId) {
        return new Promise((resolve, reject) => {
            const queries = {
                groupData: "SELECT * FROM groups WHERE id = ?",
                memberMetrics: "SELECT SUM(current_savings) as total_savings, SUM(active_loan_balance) as total_debt FROM members WHERE group_id = ?",
                lateLoans: "SELECT COUNT(*) as count, SUM(principal_amount) as amount FROM loans WHERE group_id = ? AND status = 'active' AND date('now') > date(due_date)",
                totalLoans: "SELECT COUNT(*) as count FROM loans WHERE group_id = ? AND status = 'active'"
            };

            db.get(queries.groupData, [groupId], async (err, group) => {
                if (err || !group) return reject(err || new Error("Group not found"));

                try {
                    const stats = await this.getGroupStats(groupId, queries);
                    let score = 0; // 0 = Safe, 100 = High Risk
                    const alerts = [];
                    const enforcement = { freeze: false, reason: "" };

                    // 1. Negative Balance Check
                    const groupLiquidity = stats.total_savings - stats.total_debt;
                    if (groupLiquidity < 0) {
                        score += 40;
                        alerts.push({ type: 'NEGATIVE_BALANCE', severity: 'HIGH', msg: `Negative group liquidity: KES ${groupLiquidity.toLocaleString()}` });
                        enforcement.freeze = true;
                        enforcement.reason = "CRITICAL: Negative group liquidity detected.";
                    }

                    // 2. Overdue Loans Check
                    if (stats.lateLoansCount > 0) {
                        const lateRate = (stats.lateLoansCount / (stats.totalLoansCount || 1)) * 100;
                        score += Math.min(40, lateRate * 2);
                        alerts.push({ type: 'OVERDUE_LOAN', severity: 'MEDIUM', msg: `${stats.lateLoansCount} overdue loans found.` });

                        if (lateRate > 20) {
                            enforcement.freeze = true;
                            enforcement.reason = "HIGH RISK: Overdue loan rate exceeds 20%.";
                        }
                    }

                    // 3. Liquidity Exposure (Loan > 50% of capital)
                    const exposure = (stats.total_debt / (stats.total_savings || 1)) * 100;
                    if (exposure > 50) {
                        score += 20;
                        alerts.push({ type: 'LIQUIDITY_EXPOSURE', severity: 'MEDIUM', msg: `High liquidity exposure: ${exposure.toFixed(1)}% of capital loaned out.` });
                    }

                    score = Math.max(0, Math.min(100, score));

                    // Persistence & Enforcement
                    await this.persistRiskIdentity('GROUP', groupId, score, { stats, alerts });

                    if (enforcement.freeze && group.is_frozen === 0) {
                        await this.autoFreezeGroup(groupId, enforcement.reason);
                    }

                    for (const alert of alerts) {
                        await this.logAlert('GROUP', groupId, alert.type, alert.severity, alert.msg);
                    }

                    resolve({ score, alerts, enforcement });
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    static getGroupStats(groupId, queries) {
        return new Promise((resolve, reject) => {
            db.get(queries.memberMetrics, [groupId], (err, mm) => {
                db.get(queries.lateLoans, [groupId], (err, ll) => {
                    db.get(queries.totalLoans, [groupId], (err, tl) => {
                        resolve({
                            total_savings: mm?.total_savings || 0,
                            total_debt: mm?.total_debt || 0,
                            lateLoansCount: ll?.count || 0,
                            totalLoansCount: tl?.count || 0
                        });
                    });
                });
            });
        });
    }

    static async persistRiskIdentity(scope, targetId, score, details) {
        db.run(`INSERT INTO risk_scores (scope, target_id, score, metrics_snapshot) VALUES (?, ?, ?, ?)`,
            [scope, targetId, score, JSON.stringify(details)]);

        // Mirror to primary tables for UI consistency
        if (scope === 'MEMBER') {
            db.run(`UPDATE members SET risk_score = ? WHERE id = ?`, [score, targetId]);
        } else if (scope === 'GROUP') {
            db.run(`UPDATE groups SET risk_score = ? WHERE id = ?`, [score, targetId]);
        }
    }

    static async logAlert(scope, targetId, type, severity, message) {
        db.run(`INSERT INTO risk_alerts (scope, target_id, alert_type, severity, message) VALUES (?, ?, ?, ?, ?)`,
            [scope, targetId, type, severity, message]);
    }

    static async autoFreezeGroup(groupId, reason) {
        db.run("UPDATE groups SET is_frozen = 1 WHERE id = ?", [groupId], (err) => {
            if (!err) {
                db.run("INSERT INTO audit_logs (action, category, details, target_id) VALUES (?, ?, ?, ?)",
                    ['AUTO_FREEZE', 'RISK', reason, groupId]);
            }
        });
    }

    /**
     * 🧠 Calculate individual member risk score based on longitudinal history.
     * Scores: 0-100 (0 = Lowest Risk, 100 = Highest Risk)
     */
    static async evaluateMemberRisk(memberId) {
        return new Promise((resolve, reject) => {
            const queries = {
                memberData: "SELECT * FROM members WHERE id = ?",
                loanHistory: "SELECT id, status, due_date, principal_amount FROM loans WHERE member_id = ?",
                penaltyCount: "SELECT COUNT(*) as count FROM transactions WHERE memberId = ? AND transaction_type = 'FINE' AND created_at > date('now', '-6 months')"
            };

            db.get(queries.memberData, [memberId], async (err, member) => {
                if (err || !member) return reject(err || new Error("Member not found"));

                try {
                    let score = 0;
                    const alerts = [];

                    // 1. Debt-to-Savings Analysis (Leverage Risk)
                    const savings = (member.current_savings || 0);
                    const debt = (member.active_loan_balance || 0);
                    const ratio = debt / (savings || 1);

                    if (savings < 0) {
                        score += 50;
                        alerts.push({ type: 'NEGATIVE_BALANCE', severity: 'HIGH', msg: `Critical: Member has a negative savings balance: KES ${savings.toLocaleString()}` });
                    } else if (ratio > 5) {
                        score += 35;
                        alerts.push({ type: 'CREDIT_PREDICTOR', severity: 'HIGH', msg: `Critical leverage: Debt is ${ratio.toFixed(1)}x savings.` });
                    } else if (ratio > 3) {
                        score += 20;
                        alerts.push({ type: 'CREDIT_PREDICTOR', severity: 'MEDIUM', msg: `High leverage: Debt is ${ratio.toFixed(1)}x savings.` });
                    } else if (ratio > 1.5) {
                        score += 10;
                    }

                    // 2. Penalty Frequency (Behavioral Risk)
                    const penalties = await new Promise(res => db.get(queries.penaltyCount, [memberId], (e, r) => res(r?.count || 0)));
                    if (penalties >= 5) {
                        score += 30;
                        alerts.push({ type: 'BEHAVIORAL_RISK', severity: 'HIGH', msg: `Predictive default: ${penalties} penalties observed.` });
                    } else if (penalties >= 3) {
                        score += 15;
                        alerts.push({ type: 'BEHAVIORAL_RISK', severity: 'MEDIUM', msg: `Frequent penalties: ${penalties} recorded.` });
                    } else if (penalties > 0) {
                        score += 5;
                    }

                    // 3. Repayment Consistency (On-Time Rate)
                    const lateLoans = await new Promise(res => db.all(queries.loanHistory, [memberId], (e, rows) => {
                        const late = rows?.filter(r => r.status === 'active' && new Date() > new Date(r.due_date));
                        res(late || []);
                    }));

                    if (lateLoans.length > 1) {
                        score += 35;
                        alerts.push({ type: 'DELINQUENCY', severity: 'HIGH', msg: `Critical delinquency: ${lateLoans.length} loans past due.` });
                    } else if (lateLoans.length === 1) {
                        score += 15;
                        alerts.push({ type: 'DELINQUENCY', severity: 'MEDIUM', msg: `Active delinquency: 1 loan past due.` });
                    }

                    score = Math.max(0, Math.min(100, score));

                    // Persistence
                    await this.persistRiskIdentity('MEMBER', memberId, score, { ratio, penalties, lateCount: lateLoans.length, alerts });

                    for (const alert of alerts) {
                        await this.logAlert('MEMBER', memberId, alert.type, alert.severity, alert.msg);
                    }

                    resolve({ score, alerts });
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * 🛡️ Anti-Fraud: Detect duplicate transactions in the same session.
     */
    static checkDuplicateTransaction(sessionId, memberId, amount, type) {
        return new Promise((resolve) => {
            const query = `
                SELECT id FROM transactions 
                WHERE sessionId = ? AND memberId = ? AND transaction_type = ? 
                AND (savings_amount = ? OR loans_issued = ?)
            `;
            const val = amount;
            db.get(query, [sessionId, memberId, type, val, val], (err, row) => {
                if (err) console.error("RiskService Duplicate Check Error:", err);
                resolve(!!row);
            });
        });
    }

    /**
     * 🌍 System-wide liquidity and loan exposure aggregation.
     * Used as a real-time fallback when risk_scores table is empty.
     */
    static async getGlobalRiskStats() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COALESCE(SUM(current_savings), 0) as total_savings,
                    COALESCE(SUM(active_loan_balance), 0) as total_loans
                FROM members
            `;
            db.get(query, [], (err, row) => {
                if (err) return reject(err);

                // Also get the number of groups at risk (score >= 70)
                db.get(`
                    SELECT COUNT(*) as atRiskCount 
                    FROM groups 
                    WHERE risk_score >= 70
                `, (err, riskRow) => {
                    if (err) return reject(err);

                    resolve({
                        total_savings: row.total_savings,
                        total_loans: row.total_loans,
                        total_liquidity: row.total_savings - row.total_loans,
                        system_at_risk: riskRow?.atRiskCount || 0
                    });
                });
            });
        });
    }

    /**
     * 🛡️ Guarantor Lockdown: Prevent loans if any party has skipped contributions this month.
     * @param {number} memberId - The applicant's ID.
     * @param {number[]} guarantorIds - Array of linked guarantor IDs.
     */
    static async validateComplianceLockdown(memberId, guarantorIds = []) {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const allParties = [memberId, ...guarantorIds.filter(id => id && id !== 0)];
        const ids = allParties.join(',');

        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    m.id, m.name, 
                    COALESCE((
                        SELECT SUM(savings_amount) 
                        FROM transactions 
                        WHERE memberId = m.id 
                        AND strftime('%Y-%m', created_at) = ?
                    ), 0) as monthContribution
                FROM members m
                WHERE m.id IN (${ids})
            `;

            db.all(query, [currentMonth], (err, rows) => {
                if (err) return reject(err);

                const nonCompliant = rows.filter(r => r.monthContribution <= 0);

                if (nonCompliant.length > 0) {
                    const names = nonCompliant.map(r => r.name).join(', ');
                    const role = nonCompliant.some(r => r.id === memberId) ? 'Applicant/Guarantor' : 'Guarantor';
                    resolve({
                        locked: true,
                        reason: `Compliance Lockdown: ${role} arrears detected for ${names} in ${currentMonth}. Contributions must be finalized before loan issuance.`,
                        offenders: nonCompliant
                    });
                } else {
                    resolve({ locked: false });
                }
            });
        });
    }
}

module.exports = RiskService;
