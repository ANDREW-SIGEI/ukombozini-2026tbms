const db = require('../db');
const crypto = require('crypto');
const MonthlyReportService = require('./MonthlyReportService');
const { logAndSendSMS } = require('../utils/logger');
const { getSeasonalGreeting } = require('../utils/dates');

class CashControlService {
    /**
     * Records a cash flow event into the reconciliation ledger.
     * This is called automatically by other financial modules.
     */
    static async logRecord({ sessionId, source, referenceId, amount, direction, createdBy }) {
        return new Promise((resolve, reject) => {
            const id = require('crypto').randomUUID();
            const sql = `
                INSERT INTO cash_transactions (
                    id, cash_session_id, source, reference_id, direction, amount, created_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            `;
            db.run(sql, [id, sessionId, source, referenceId, direction, amount, createdBy], (err) => {
                if (err) {
                    console.error("Cash Audit Failure:", err);
                    reject(err);
                } else {
                    resolve(id);
                }
            });
        });
    }

    /**
     * Opens a new cash session for a group.
     * Enforces sequential integrity.
     */
    static async openSession(groupId, officerId, date, meetingId = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Check for any currently OPEN session for this group
                const openSession = await this.getInternal(`SELECT id FROM cash_sessions WHERE group_id = ? AND status = 'OPEN'`, [groupId]);
                if (openSession) return reject(new Error("A cash session is already OPEN for this group. Close it first."));

                // 2. Derive Opening Balance from last LOCKED session
                const lastSession = await this.getInternal(
                    `SELECT expected_closing_balance FROM cash_sessions WHERE group_id = ? AND status = 'LOCKED' ORDER BY meeting_date DESC LIMIT 1`,
                    [groupId]
                );
                const openingBalance = lastSession?.expected_closing_balance || 0;

                // 3. Create new session
                const id = require('crypto').randomUUID();
                const sql = `
                    INSERT INTO cash_sessions (id, group_id, meeting_date, opening_balance, reported_by, meeting_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                db.run(sql, [id, groupId, date, openingBalance, officerId, meetingId], (err) => {
                    if (err) reject(err);
                    else resolve({ id, opening_balance: openingBalance });
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Internal helper for DB queries
     */
    static getInternal(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        });
    }

    /**
     * Process Variance Rules and Risk Command Automation
     */
    static async verifyAndLock(sessionId, physicalCount, explanation, officerId) {
        return new Promise(async (resolve, reject) => {
            try {
                const session = await this.getInternal(`
                    SELECT s.*, g.name as group_name 
                    FROM cash_sessions s 
                    JOIN groups g ON s.group_id = g.id 
                    WHERE s.id = ?
                `, [sessionId]);
                if (!session) return reject(new Error("Session not found"));
                if (session.status !== 'OPEN') return reject(new Error("Session is not in OPEN state"));

                // Compute real-time expected balance
                const totals = await this.getInternal(`
                    SELECT 
                        SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END) as total_in,
                        SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END) as total_out
                    FROM cash_transactions 
                    WHERE cash_session_id = ?
                `, [sessionId]);

                const expectedClosing = session.opening_balance + (totals.total_in || 0) - (totals.total_out || 0);
                const variance = physicalCount - expectedClosing;
                let status = 'LOCKED';
                let riskFlag = false;

                // VARIANCE RULES
                if (Math.abs(variance) > 100) {
                    riskFlag = true;
                    // AUTO-FREEZE GROUP (Institutional Guard)
                    await this.runInternal(
                        `UPDATE groups SET status = 'suspended', is_frozen = 1, freeze_reason = 'CASH_VARIANCE_CRITICAL' WHERE id = ?`,
                        [session.group_id]
                    );
                } else if (Math.abs(variance) > 0 && !explanation) {
                    return reject(new Error("Variance exists. Institutional explanation is mandatory."));
                }

                // Generate Audit Hash (Simplified for MVP)
                const auditContent = `${sessionId}|${physicalCount}|${variance}|${officerId}`;
                const auditHash = require('crypto').createHash('sha256').update(auditContent).digest('hex');

                const sql = `
                    UPDATE cash_sessions SET 
                        expected_closing_balance = ?,
                        physical_cash_count = ?, 
                        variance = ?, 
                        variance_explanation = ?,
                        status = 'LOCKED',
                        verified_by = ?,
                        locked_at = CURRENT_TIMESTAMP,
                        audit_hash = ?
                    WHERE id = ?
                `;
                db.run(sql, [expectedClosing, physicalCount, variance, explanation, officerId, auditHash, sessionId], async (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        // 🏛️ TRIGGER MONTHLY ROLLUP
                        try {
                            const [y, m, d] = session.meeting_date.split('-');
                            await MonthlyReportService.recalculate(session.group_id, parseInt(m), parseInt(y));
                        } catch (recalcErr) {
                            console.error("Monthly Rollup Failure:", recalcErr);
                            // We don't want to fail the whole lock if just the rollup fails, but we should log it
                        }

                        // 📲 TRIGGER OFFICIAL SUMMARIES
                        try {
                            const officials = await new Promise((res) => {
                                db.all(`
                                    SELECT m.name, m.phone, m.id
                                    FROM members m
                                    JOIN groups g ON (m.id = g.chairperson_id OR m.id = g.secretary_id OR m.id = g.treasurer_id)
                                    WHERE g.id = ? AND m.phone IS NOT NULL
                                `, [session.group_id], (err, rows) => res(rows || []));
                            });

                            const summaryMsg = `UKOMBOZINI: ${session.group_name} Meeting Closed. In: KES ${totals.total_in || 0} | Out: ${totals.total_out || 0} | Net: ${physicalCount.toLocaleString()}. Var: ${variance}${getSeasonalGreeting()}`;

                            for (const off of officials) {
                                logAndSendSMS(off.id, summaryMsg, 'MEETING_CLOSEOUT', sessionId, 'members');
                            }
                        } catch (smsErr) {
                            console.error("Closeout SMS Failure:", smsErr);
                        }
                        resolve({ success: true, risk_triggered: riskFlag, hash: auditHash });
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    static runInternal(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, (err) => err ? reject(err) : resolve());
        });
    }

    /**
     * Institutional Liquidity Guard: Prevents ghost withdrawals/loans
     * if the physical cash bag doesn't have sufficient funds.
     */
    static async validateLiquidity(groupId, amount) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const session = await this.getInternal(
                `SELECT id, opening_balance FROM cash_sessions WHERE group_id = ? AND status = 'OPEN' AND meeting_date = ?`,
                [groupId, date]
            );

            if (!session) return true; // No session active, fall back to standard guards

            const totals = await this.getInternal(`
                SELECT 
                    SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END) as total_in,
                    SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END) as total_out
                FROM cash_transactions 
                WHERE cash_session_id = ?
            `, [session.id]);

            const currentBalance = session.opening_balance + (totals.total_in || 0) - (totals.total_out || 0);

            if (amount > currentBalance) {
                throw new Error(`LIQUIDITY BREACH: Attempted withdrawal of KES ${amount.toLocaleString()} exceeds current cash-on-hand (KES ${currentBalance.toLocaleString()}).`);
            }
            return true;
        } catch (err) {
            throw err;
        }
    }
}

module.exports = CashControlService;
