const db = require('../db'); // Assuming basic sqlite wrapper or direct access
// Since we are inside 'services', we might need to require sqlite3 if db wrapper isn't robust
// conforming to existing pattern: using a db instance passed in or requiring the single instance.
// Checking server.js pattern, usually db is passed or global.
// Usage: const dividendRules = require('./services/dividendRules');
// dividendRules.calculateRun(db, year, groupId)

const dividendRules = {

    /**
     * 1. Calculate Average Shares
     * Formula: (Jan + Mar + May + Jul + Sep + Nov) / 6
     * We need to get the "running balance" of shares at the END of each of these months.
     */
    async calculateAverageShares(db, memberId, year) {
        const months = [0, 2, 4, 6, 8, 10]; // 0-indexed: Jan, Mar, May, Jul, Sep, Nov
        let totalShares = 0;

        for (const month of months) {
            // Get last day of that month
            const nextMonth = new Date(year, month + 1, 1);
            const endDate = nextMonth.toISOString().split('T')[0];

            // Query: Sum of contributions - withdrawals up to this date
            // Note: This assumes transaction history is complete. 
            // If historical data is missing, this might return 0.
            const query = `
                SELECT 
                    SUM(savings_amount) - SUM(withdrawals) as balance
                FROM transactions 
                WHERE memberId = ? 
                AND date(created_at) < ?
            `;

            const result = await new Promise((resolve, reject) => {
                db.get(query, [memberId, endDate], (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.balance || 0 : 0);
                });
            });

            totalShares += result;
        }

        return totalShares / 6;
    },

    /**
     * 2. Calculate Total Revenue (TRF)
     * Formula: Banking Interest + STL Interest + LTL Interest + Fines
     */
    async calculateTRF(db, year, groupId) {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;

        const query = `
            SELECT 
                SUM(loan_interest) as total_interest,
                SUM(fines)        as total_fines
            FROM transactions t
            JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE s.groupId = ?
            AND date(t.created_at) BETWEEN ? AND ?
        `;

        const result = await new Promise((resolve, reject) => {
            db.get(query, [groupId, start, end], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const interest = result ? (result.total_interest || 0) : 0;
        const fines = result ? (result.total_fines || 0) : 0;

        // Return breakdown so postDividends can populate the correct DB columns
        return { total: interest + fines, interest, fines };
    },

    /**
     * 3. Calculate Average Profit
     * OPTIMIZED SYSTEM FORMULA: TRF - Expenses
     */
    async calculateProfit(trf, expenses) {
        return Math.max(0, trf - expenses);
    },

    /**
     * 4. Payout Ratio
     * Rule: >= 1 year -> 75%, < 1 year -> 50%
     */
    async determinePayoutRatio(db, groupId) {
        const query = `SELECT created_at FROM groups WHERE id = ?`;
        const row = await new Promise((resolve, reject) => {
            db.get(query, [groupId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!row) return 0.50; // Default safety

        const created = new Date(row.created_at);
        const now = new Date();
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays >= 365 ? 0.75 : 0.50;
    },

    /**
     * MAIN ENGINE: Run Calculation
     */
    async generatePreview(db, year, groupId, expenses = 0) {
        // 1. Get TRF (returns { total, interest, fines })
        const trfBreakdown = await this.calculateTRF(db, year, groupId);
        const trf = trfBreakdown.total;

        // 2. Allocable Profit
        const ap = await this.calculateProfit(trf, expenses);

        // 3. Payout ratio (75% if group >= 1 year old, 50% otherwise)
        const ratio = await this.determinePayoutRatio(db, groupId);

        // 4. Profit to share with members
        const profitToShare = ap * ratio;

        // 5. Get members and calculate average shares
        const membersQuery = `SELECT id, name FROM members WHERE group_id = ?`;
        const members = await new Promise((resolve, reject) => {
            db.all(membersQuery, [groupId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        let totalAvgShares = 0;
        const allocations = [];

        for (const m of members) {
            const avgShares = await this.calculateAverageShares(db, m.id, year);
            if (avgShares > 0) {
                totalAvgShares += avgShares;
                allocations.push({ memberId: m.id, name: m.name, averageShares: avgShares });
            }
        }

        // 6. Dividend rate per share
        const dividendRate = totalAvgShares > 0 ? (profitToShare / totalAvgShares) : 0;

        // 7. Withholding Tax (5% — standard Kenya rate for resident shareholders)
        const WHT_RATE = 0.05;

        // 8. Finalize allocations: grossDividend = pre-tax, netDividend = after 5% WHT
        const finalAllocations = allocations.map(a => {
            const gross = a.averageShares * dividendRate;
            return {
                ...a,
                grossDividend: gross,
                whtAmount: gross * WHT_RATE,
                netDividend: gross * (1 - WHT_RATE)
            };
        }).sort((a, b) => b.grossDividend - a.grossDividend);

        return {
            year,
            groupId,
            trf,
            // Breakdown for accurate DB storage
            interestBreakdown: {
                loanInterest: trfBreakdown.interest,
                finesAndPenalties: trfBreakdown.fines
            },
            expenses,
            ap,
            ratio,
            profitToShare,
            totalAvgShares,
            dividendRate,
            whtRate: WHT_RATE,
            allocations: finalAllocations
        };
    }
};

module.exports = dividendRules;
