const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ==========================================
// GROUPS API
// ==========================================

// Get all groups
app.get('/api/groups', (req, res) => {
    db.all("SELECT * FROM groups ORDER BY name", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new group
app.post('/api/groups', (req, res) => {
    const { name, location, meetingDay, officerId } = req.body;
    const stmt = db.prepare("INSERT INTO groups (name, location, meetingDay) VALUES (?, ?, ?)");
    stmt.run(name, location, meetingDay, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, location, meetingDay, status: 'active' });
    });
    stmt.finalize();
});

// ==========================================
// MEMBERS API (WITH OPENING BALANCE RULES)
// ==========================================

// Get members (optionally filter by groupId)
app.get('/api/members', (req, res) => {
    const { groupId } = req.query;
    let query = "SELECT * FROM members";
    let params = [];

    if (groupId) {
        query += " WHERE group_id = ?";
        params.push(groupId);
    }

    query += " ORDER BY name";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new member (WITH OPENING BALANCE RULES)
app.post('/api/members', (req, res) => {
    const {
        name, phone, groupId,
        opening_balance_savings = 0,
        opening_balance_ltl = 0,
        opening_balance_stl = 0,
        opening_balance_reason,
        userId // Who is creating this member (for audit)
    } = req.body;

    // Validation: Opening balance reason required if any opening balance > 0
    const hasOpeningBalance = opening_balance_savings > 0 || opening_balance_ltl > 0 || opening_balance_stl > 0;
    if (hasOpeningBalance && !opening_balance_reason) {
        return res.status(400).json({ error: 'Opening balance reason is required when setting opening balances' });
    }

    const stmt = db.prepare(`INSERT INTO members (
        name, phone, group_id,
        opening_balance_savings, opening_balance_ltl, opening_balance_stl,
        opening_balance_set_by, opening_balance_set_at, opening_balance_reason, opening_balance_locked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const now = new Date().toISOString();
    const locked = hasOpeningBalance ? 1 : 0; // Lock if opening balance is set

    stmt.run(
        name, phone, groupId,
        opening_balance_savings, opening_balance_ltl, opening_balance_stl,
        userId || 1, now, opening_balance_reason || 'New member', locked,
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                id: this.lastID,
                name, phone,
                group_id: groupId,
                status: 'active',
                opening_balance_savings,
                opening_balance_ltl,
                opening_balance_stl,
                opening_balance_locked: locked,
                registration_date: now
            });
        }
    );
    stmt.finalize();
});

// ==========================================
// SESSIONS API (MEETING MANAGEMENT)
// ==========================================

// Get all sessions
app.get('/api/sessions', (req, res) => {
    db.all("SELECT * FROM meeting_sessions ORDER BY date DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Parse JSON fields
        const sessions = rows.map(row => ({
            ...row,
            totals: row.totals ? JSON.parse(row.totals) : null,
            reversalMetadata: row.reversalMetadata ? JSON.parse(row.reversalMetadata) : null
        }));
        res.json(sessions);
    });
});

// Start Session (Create)
app.post('/api/sessions', (req, res) => {
    const { groupId, officerId, date, startTime, endTime } = req.body;
    const stmt = db.prepare(`
        INSERT INTO meeting_sessions (groupId, officerId, date, startTime, endTime, status) 
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
    `);

    stmt.run(groupId, officerId, date, startTime, endTime, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            id: this.lastID,
            groupId,
            officerId,
            date,
            startTime,
            endTime,
            status: 'ACTIVE'
        });
    });
    stmt.finalize();
});

// Close Session (Update to PENDING_APPROVAL)
app.patch('/api/sessions/:id/close', (req, res) => {
    const { id } = req.params;
    const { totals } = req.body; // Expect JSON object

    const stmt = db.prepare(`
        UPDATE meeting_sessions 
        SET status = 'PENDING_APPROVAL', totals = ? 
        WHERE id = ?
    `);

    stmt.run(JSON.stringify(totals), id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id, status: 'PENDING_APPROVAL' });
    });
    stmt.finalize();
});

// Post/Approve Session (Update to POSTED + Save Transactions)
// This is a TRANSACTIONAL operation (Session Status + Bulk Insert Transactions)
app.post('/api/sessions/:id/post', (req, res) => {
    const sessionId = req.params.id;
    const { transactions } = req.body; // Array of member transactions

    // 1. Update Session Status
    db.run("UPDATE meeting_sessions SET status = 'POSTED' WHERE id = ?", [sessionId], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // 2. Insert Transactions
        if (transactions && transactions.length > 0) {
            const placeholders = transactions.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
            const values = [];
            transactions.forEach(t => {
                values.push(
                    sessionId,
                    t.memberId,
                    t.memberName,
                    t.savings_amount || 0,
                    t.stl_repayment || 0,
                    t.ltl_repayment || 0,
                    t.loan_interest || 0,
                    t.welfare || 0,
                    t.fines || 0,
                    t.total_paid || 0,
                    1 // attended default
                );
            });

            const query = `INSERT INTO transactions (
                sessionId, memberId, memberName, 
                savings_amount, stl_repayment, ltl_repayment, loan_interest, welfare, fines, total_paid, attended
            ) VALUES ${placeholders}`;

            db.run(query, values, (err) => {
                if (err) {
                    console.error("Tx Insert Error", err);
                    // Ideally rollback session status here, but for now just error
                    return res.status(500).json({ error: "Failed to save transactions" });
                }
                res.json({ success: true, status: 'POSTED', transactionCount: transactions.length });
            });
        } else {
            res.json({ success: true, status: 'POSTED', transactionCount: 0 });
        }
    });
});

// Get Transactions (for Reports)
app.get('/api/transactions', (req, res) => {
    const { sessionId, groupId, month, year } = req.query;

    let query = `
        SELECT t.*, s.date as sessionDate 
        FROM transactions t
        JOIN meeting_sessions s ON t.sessionId = s.id
        WHERE 1=1
    `;
    let params = [];

    if (sessionId) {
        query += " AND t.sessionId = ?";
        params.push(sessionId);
    }

    if (groupId) {
        query += " AND s.groupId = ?";
        params.push(groupId);
    }

    // Date filtering would be string manipulation in SQLite
    if (month && year) {
        const monthStr = String(parseInt(month) + 1).padStart(2, '0');
        const prefix = `${year}-${monthStr}`;
        query += " AND s.date LIKE ?";
        params.push(`${prefix}%`);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
