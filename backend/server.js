const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ==========================================
// AUDIT LOG HELPER
// ==========================================
/**
 * Helper to log administrative and critical actions
 */
const logAudit = (action, category, details, officerId = 1, officerName = 'Admin', ip = '127.0.0.1') => {
    const stmt = db.prepare(`
        INSERT INTO audit_logs (action, category, details, officer_id, officer_name, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(action, category, typeof details === 'object' ? JSON.stringify(details) : details, officerId, officerName, ip, (err) => {
        if (err) console.error("Audit Log Error:", err);
    });
    stmt.finalize();
};

// ==========================================
// ADMIN API
// ==========================================

// Get Audit Logs (Paginated)
app.get('/api/admin/audit-logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    db.all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?", [limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get All Settings
app.get('/api/admin/settings', (req, res) => {
    db.all("SELECT * FROM settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Save Setting
app.post('/api/admin/settings', (req, res) => {
    const { key, value, description } = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)");
    stmt.run(key, value, description, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(`Update Setting: ${key}`, 'admin', { value, description });
        res.json({ success: true, key, value });
    });
    stmt.finalize();
});

// Loan Product Management
// Get Loan Products
app.get('/api/admin/loan-products', (req, res) => {
    db.all("SELECT * FROM loan_products ORDER BY code", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create/Update Loan Product
app.post('/api/admin/loan-products', (req, res) => {
    const { id, name, code, interest_rate, duration_months, max_amount, description, is_active } = req.body;
    if (id) {
        // Update
        const stmt = db.prepare(`
            UPDATE loan_products 
            SET name=?, code=?, interest_rate=?, duration_months=?, max_amount=?, description=?, is_active=?
            WHERE id=?
        `);
        stmt.run(name, code, interest_rate, duration_months, max_amount, description, is_active, id, function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Update Loan Product: ${code}`, 'admin', { id, name });
            res.json({ success: true, id });
        });
        stmt.finalize();
    } else {
        // Create
        const stmt = db.prepare(`
            INSERT INTO loan_products (name, code, interest_rate, duration_months, max_amount, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(name, code, interest_rate, duration_months, max_amount, description, function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Create Loan Product: ${code}`, 'admin', { name });
            res.json({ success: true, id: this.lastID });
        });
        stmt.finalize();
    }
});

// Delete Loan Product
app.delete('/api/admin/loan-products/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM loan_products WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(`Delete Loan Product: ${id}`, 'admin', { id });
        res.json({ success: true, message: "Product deleted" });
    });
});

// Backup Database
app.get('/api/admin/backup', (req, res) => {
    const dbFile = path.join(__dirname, 'ukombozi.sqlite');
    console.log('Backup request received. Checking file:', dbFile);
    if (fs.existsSync(dbFile)) {
        res.download(dbFile, `ukombozi_backup_${new Date().toISOString().split('T')[0]}.sqlite`);
    } else {
        console.error('Backup failed: File not found at', dbFile);
        res.status(404).json({ error: "Database file not found", path: dbFile });
    }
});

// CSV Export Utility
app.get('/api/admin/export/:table', (req, res) => {
    const { table } = req.params;
    const allowedTables = ['members', 'groups', 'transactions', 'loans', 'audit_logs', 'loan_products', 'meeting_sessions'];

    if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: "Invalid table name" });
    }

    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rows || rows.length === 0) return res.status(404).json({ error: "No data found in table" });

        // Simple CSV generation
        const headers = Object.keys(rows[0]);
        const csvContent = [
            headers.join(','),
            ...rows.map(row =>
                headers.map(header => {
                    let val = row[header];
                    if (val === null || val === undefined) return '';
                    val = String(val).replace(/"/g, '""'); // Escape quotes
                    return `"${val}"`;
                }).join(',')
            )
        ].join('\r\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=ukombozi_${table}_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);
    });
});
app.get('/api/groups', (req, res) => {
    db.all("SELECT * FROM groups ORDER BY name", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new group
app.post('/api/groups', (req, res) => {
    const { name, location, meetingDay, chairperson, secretary, treasurer } = req.body;

    // Check for duplicate name
    db.get("SELECT id FROM groups WHERE name COLLATE NOCASE = ?", [name], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            return res.status(400).json({ error: `Group '${name}' already exists.` });
        }

        const stmt = db.prepare("INSERT INTO groups (name, location, meetingDay, chairperson, secretary, treasurer) VALUES (?, ?, ?, ?, ?, ?)");
        stmt.run(name, location, meetingDay, chairperson, secretary, treasurer, function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, location, meetingDay, status: 'active' });
        });
        stmt.finalize();
    });
});

// Get active session for a group
app.get('/api/groups/:id/active-session', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM meeting_sessions WHERE groupId = ? AND status = 'ACTIVE' LIMIT 1", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || null);
    });
});

// Delete Group (Safe Deletion)
app.delete('/api/groups/:id', (req, res) => {
    const { id } = req.params;

    // Check for members first
    db.get("SELECT count(*) as count FROM members WHERE group_id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count > 0) {
            return res.status(400).json({ error: `Cannot delete group: It still has ${row.count} registered members.` });
        }

        // Check for sessions
        db.get("SELECT count(*) as count FROM meeting_sessions WHERE groupId = ?", [id], (err, sRow) => {
            if (err) return res.status(500).json({ error: err.message });
            if (sRow.count > 0) {
                return res.status(400).json({ error: `Cannot delete group: It has ${sRow.count} meeting sessions in history.` });
            }

            // Safe to delete
            db.run("DELETE FROM groups WHERE id = ?", [id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                logAudit(`Delete Group: ${id}`, 'admin', { groupId: id });
                res.json({ success: true, message: "Group deleted successfully" });
            });
        });
    });
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

    // Validation: Check for duplicate Name OR Phone
    db.get("SELECT id, name, phone, group_id FROM members WHERE name COLLATE NOCASE = ? OR phone = ?", [name, phone], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        if (existing) {
            let msg = `Member '${existing.name}' already registered`;
            if (existing.group_id) {
                // If we could fetch group name easily we would, but simply saying they are in a group is enough
                msg += ` (already in a group).`;
            }
            return res.status(400).json({ error: msg });
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
});

// Update Member Profile
app.put('/api/members/:id', (req, res) => {
    const { id } = req.params;
    const { name, phone, groupId, status } = req.body;

    const stmt = db.prepare(`
        UPDATE members 
        SET name = COALESCE(?, name), 
            phone = COALESCE(?, phone), 
            group_id = COALESCE(?, group_id), 
            status = COALESCE(?, status)
        WHERE id = ?
    `);

    stmt.run(name, phone, groupId, status, id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Member not found' });

        res.json({ id, name, phone, groupId, status, message: 'Member updated successfully' });
    });
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
app.post('/api/sessions/:id/post', (req, res) => {
    const sessionId = req.params.id;
    const { transactions } = req.body; // Array of member transactions

    // 1. Update Session Status
    db.run("UPDATE meeting_sessions SET status = 'POSTED' WHERE id = ?", [sessionId], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // 2. Insert Transactions
        if (transactions && transactions.length > 0) {
            const placeholders = transactions.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
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
                    t.withdrawals || 0,
                    t.loans_issued || 0,
                    t.transaction_type || 'Meeting',
                    1 // attended default
                );
            });

            const query = `INSERT INTO transactions (
                sessionId, memberId, memberName, 
                savings_amount, stl_repayment, ltl_repayment, loan_interest, welfare, fines, withdrawals, loans_issued, transaction_type, attended
            ) VALUES ${placeholders}`;

            db.run(query, values, (err) => {
                if (err) {
                    console.error("Tx Insert Error", err);
                    return res.status(500).json({ error: "Failed to save transactions" });
                }
                res.json({ success: true, status: 'POSTED', transactionCount: transactions.length });
            });
        } else {
            res.json({ success: true, status: 'POSTED', transactionCount: 0 });
        }
    });
});

// Get Session Summary (Balanced Report)
app.get('/api/sessions/:id/summary', (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT 
            SUM(savings_amount) as total_savings,
            SUM(stl_repayment) as total_stl_repayment,
            SUM(ltl_repayment) as total_ltl_repayment,
            SUM(loan_interest) as total_interest,
            SUM(welfare) as total_welfare,
            SUM(fines) as total_fines,
            SUM(withdrawals) as total_withdrawals,
            SUM(loans_issued) as total_loans_issued
        FROM transactions 
        WHERE sessionId = ?
    `;

    db.get(query, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const inflows = (row.total_savings || 0) + (row.total_stl_repayment || 0) +
            (row.total_ltl_repayment || 0) + (row.total_interest || 0) +
            (row.total_welfare || 0) + (row.total_fines || 0);

        const outflows = (row.total_withdrawals || 0) + (row.total_loans_issued || 0);

        res.json({
            session_id: id,
            breakdown: row,
            total_inflow: inflows,
            total_outflow: outflows,
            net_cash: inflows - outflows
        });
    });
});

// Calculate STL Interest (Reducing Balance)
app.get('/api/loans/:id/next-payment', (req, res) => {
    const { id } = req.params;

    db.get("SELECT * FROM loans WHERE id = ?", [id], (err, loan) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!loan) return res.status(404).json({ error: "Loan not found" });

        // Logic for reducing balance
        // We need the total principal already paid to calculate interest on balance
        db.get("SELECT SUM(stl_repayment) as paid_principal FROM transactions WHERE description LIKE ?", [`%Loan ID: ${id}%`], (err, result) => {
            const paid = result?.paid_principal || 0;
            const balance = loan.principal_amount - paid;
            const interest = (balance * (loan.interest_rate / 100));

            res.json({
                loan_id: id,
                current_balance: balance,
                interest_due: interest,
                total_due: interest + (loan.principal_amount / 3) // Assuming 3 month amortization for demo
            });
        });
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


// ==========================================
// LOANS API
// ==========================================

// Get all loans
app.get('/api/loans', (req, res) => {
    const { memberId } = req.query;
    let query = `
        SELECT l.*, m.name as member_name, m.phone as member_phone 
        FROM loans l
        JOIN members m ON l.member_id = m.id
    `;
    let params = [];

    if (memberId) {
        query += " WHERE l.member_id = ?";
        params.push(memberId);
    }

    query += " ORDER BY l.created_at DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Transform to resemble Supabase response structure where members is nested
        const loans = rows.map(r => ({
            ...r,
            members: { full_name: r.member_name, phone: r.member_phone }
        }));
        res.json(loans);
    });
});

// Post Loan Repayment (during session)
app.post('/api/sessions/repayment', (req, res) => {
    const { memberId, sessionId, loanId, amount, breakdown, paymentMethod, loanType } = req.body;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const description = `Loan Repayment - ${loanType} | Loan ID: ${loanId}`;
        const stmt = db.prepare(`
            INSERT INTO transactions (
                sessionId, memberId, stl_repayment, ltl_repayment, loan_interest, penalty, description, transaction_type, uploaded, attended
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'LoanRepayment', 1, 1)
        `);

        const stl_amt = loanType === 'STL' ? (breakdown?.principal || amount) : 0;
        const ltl_amt = loanType === 'LTL' ? (breakdown?.principal || amount) : 0;
        const interest = breakdown?.interest || 0;
        const penalty = breakdown?.penalty || 0;

        stmt.run(sessionId, memberId, stl_amt, ltl_amt, interest, penalty, description, function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            // Update member balance
            db.run("UPDATE members SET active_loan_balance = active_loan_balance - ? WHERE id = ?", [stl_amt + ltl_amt, memberId], (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                db.run("COMMIT");
                res.json({ success: true, message: "Repayment recorded" });
            });
        });
        stmt.finalize();
    });
});

// Member Withdrawal
app.post('/api/withdrawals', (req, res) => {
    const { memberId, sessionId, amount, description } = req.body;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const stmt = db.prepare(`
            INSERT INTO transactions (
                sessionId, memberId, withdrawals, description, transaction_type, uploaded, attended
            ) VALUES (?, ?, ?, ?, 'Withdrawal', 1, 1)
        `);

        stmt.run(sessionId, memberId, amount, description || 'Savings Withdrawal', function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            // Update member savings
            db.run("UPDATE members SET current_savings = current_savings - ? WHERE id = ?", [amount, memberId], (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                db.run("COMMIT");
                res.json({ success: true, message: "Withdrawal recorded" });
            });
        });
        stmt.finalize();
    });
});

// Issue Loan
app.post('/api/loans', (req, res) => {
    const { memberId, groupId, sessionId, loanType, amount, interestRate, duration, officerId } = req.body;

    const issuedDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + (duration || 1));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const stmt = db.prepare(`INSERT INTO loans (
            member_id, group_id, loan_type, principal_amount, interest_rate, 
            issued_date, due_date, status, issued_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`);

        stmt.run(memberId, groupId || 1, loanType, amount, interestRate, issuedDate, dueDateStr, officerId || 1, function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            const loanId = this.lastID;

            // 1. Update member active loan balance
            db.run("UPDATE members SET active_loan_balance = IFNULL(active_loan_balance, 0) + ? WHERE id = ?", [amount, memberId], (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                // 2. If session is active, record it in transactions for the ledger
                if (sessionId) {
                    const txStmt = db.prepare(`
                        INSERT INTO transactions (
                            sessionId, memberId, loans_issued, transaction_type, description, attended
                        ) VALUES (?, ?, ?, 'LoanIssued', ?, 1)
                    `);
                    txStmt.run(sessionId, memberId, amount, `${loanType} Loan Issued | Loan ID: ${loanId}`);
                    txStmt.finalize();
                }

                db.run("COMMIT");
                res.json({ id: loanId, status: 'active', message: 'Loan issued successfully' });
            });
        });
        stmt.finalize();
    });
});


// ==========================================
// DIVIDEND API (LOCAL ENGINE)
// ==========================================

// Generate Report (Simulated Calculation)
app.get('/api/dividends/report', (req, res) => {
    const { groupId, year } = req.query;

    if (!groupId) return res.status(400).json({ error: "Group ID required" });

    // 1. Get Group Info (for Age)
    db.get("SELECT * FROM groups WHERE id = ?", [groupId], (err, group) => {
        if (err) return res.status(500).json({ error: err.message });

        const createdDate = group ? new Date(group.created_at || '2024-01-01') : new Date('2024-01-01');
        const now = new Date();
        const ageYears = (now - createdDate) / (1000 * 60 * 60 * 24 * 365.25);

        // 2. Get Members
        db.all("SELECT id, name, current_savings FROM members WHERE group_id = ?", [groupId], (err, members) => {
            if (err) return res.status(500).json({ error: err.message });

            // 3. Simulate/Calculate Monthly Balances based on Current Savings
            // In a real system, we'd query historical transaction sums. 
            // Here we assume gradual growth to reach current savings.
            const reportMembers = members.map(m => {
                const current = m.current_savings || 0;
                // Simulate slightly lower balances in past months to show growth
                return {
                    id: m.id,
                    name: m.name,
                    balances: {
                        jan: Math.floor(current * 0.85),
                        mar: Math.floor(current * 0.88),
                        may: Math.floor(current * 0.91),
                        jul: Math.floor(current * 0.94),
                        sep: Math.floor(current * 0.97),
                        nov: current // Current balance
                    }
                };
            });

            // 4. Calculate Financials (Mock Institutional Data for Demo)
            // In production, aggregate from 'transactions' table where type='Interest'
            const financials = {
                bankInterest: 15000,
                stlInterest: 45000,
                ltlInterest: 120000,
                penalties: 5500,
                otherIncome: 1200,
                expenses: 8500,
                reinvestedLoans: 50000,
                groupAgeYears: ageYears
            };

            res.json({
                financials,
                members: reportMembers
            });
        });
    });
});

// Post Dividend Run
/* app.post('/api/dividends/post', (req, res) => {
    const { groupId, year, financials, payouts } = req.body;

    // Transaction to ensure atomicity
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Create Dividend Run Record (If table exists, otherwise skip or create)
        // For simplicity in this local version, we'll just log transactions directly.

        // 2. Process Payouts
        const stmt = db.prepare(`
            INSERT INTO transactions (
                memberId, 
                savings_amount, 
                transaction_type, 
                description, 
                created_at,
                uploaded
            ) VALUES (?, ?, 'Dividend', ?, ?, 1)
        `);

        payouts.forEach(p => {
            stmt.run(
                p.member_id,
                p.amount,
                `Dividend Payout ${year} - ${(financials.rate * 100).toFixed(2)}%`,
                new Date().toISOString()
            );

            // Update Member Savings
            db.run("UPDATE members SET current_savings = current_savings + ? WHERE id = ?", [p.amount, p.member_id]);
        });

        stmt.finalize((err) => {
            if (err) {
                console.error("Dividend Post Error:", err);
                db.run("ROLLBACK");
                return res.status(500).json({ error: "Failed to post dividends" });
            }

            db.run("COMMIT");
            res.json({ success: true, message: "Dividends posted successfully", count: payouts.length });
        });
    });
}); */


// ==========================================
// DIVIDEND ENGINE (FULL LOCAL IMPLEMENTATION)
// ==========================================

// Get All Runs
app.get('/api/dividends/runs', (req, res) => {
    // Ensure table exists (quick check)
    db.run(`CREATE TABLE IF NOT EXISTS dividend_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        financial_year INTEGER,
        group_id INTEGER,
        run_number TEXT,
        banking_interest REAL DEFAULT 0,
        stl_interest REAL DEFAULT 0,
        ltl_interest REAL DEFAULT 0,
        penalties REAL DEFAULT 0,
        other_income REAL DEFAULT 0,
        operating_expenses REAL DEFAULT 0,
        mandatory_reserves REAL DEFAULT 0,
        risk_buffer REAL DEFAULT 0,
        reinvested_capital REAL DEFAULT 0,
        profit_share_percentage REAL DEFAULT 75,
        dividend_rate REAL DEFAULT 0,
        allocable_profit REAL DEFAULT 0,
        total_payout REAL DEFAULT 0,
        status TEXT DEFAULT 'DRAFT',
        created_at TEXT
    )`);

    db.all("SELECT * FROM dividend_runs ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create Run
app.post('/api/dividends/runs', (req, res) => {
    const data = req.body;
    const stmt = db.prepare(`
        INSERT INTO dividend_runs (
            financial_year, group_id, run_number, banking_interest, stl_interest, ltl_interest,
            penalties, other_income, operating_expenses, mandatory_reserves, risk_buffer,
            reinvested_capital, profit_share_percentage, status, created_at, dividend_rate, total_payout, allocable_profit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Calculate Allocable Profit
    const income = (data.banking_interest || 0) + (data.stl_interest || 0) + (data.ltl_interest || 0) + (data.penalties || 0) + (data.other_income || 0);
    const deductions = (data.operating_expenses || 0) + (data.mandatory_reserves || 0) + (data.risk_buffer || 0) + (data.reinvested_capital || 0);
    const allocable = Math.max(0, income - deductions);

    const now = new Date().toISOString();
    stmt.run(
        data.financial_year, data.group_id, data.run_number, data.banking_interest, data.stl_interest,
        data.ltl_interest, data.penalties, data.other_income, data.operating_expenses, data.mandatory_reserves,
        data.risk_buffer, data.reinvested_capital, data.profit_share_percentage, 'DRAFT', now, 0, 0, allocable,
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...data, status: 'DRAFT', created_at: now, allocable_profit: allocable });
        }
    );
    stmt.finalize();
});

// Calculate Run (Mock Logic for Demo)
app.post('/api/dividends/:id/calculate', (req, res) => {
    const runId = req.params.id;
    // Update status to CALCULATED
    db.run("UPDATE dividend_runs SET status = 'CALCULATED', dividend_rate = 0.12, total_payout = 150000 WHERE id = ?", [runId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, total_members: 5, total_payout: 150000 });
    });
});

// Approve Run
app.post('/api/dividends/:id/approve', (req, res) => {
    const runId = req.params.id;
    db.run("UPDATE dividend_runs SET status = 'APPROVED' WHERE id = ?", [runId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Get Allocations
app.get('/api/dividends/:id/allocations', (req, res) => {
    // Return mock allocations
    res.json([
        { member_name: 'Alice Wanjiku', average_shares: 5000, gross_dividend: 600, net_dividend: 600, posted_to_savings: false },
        { member_name: 'John Doe', average_shares: 3000, gross_dividend: 360, net_dividend: 360, posted_to_savings: false }
    ]);
});

// Post Dividend Run (Payouts)
app.post('/api/dividends/post', (req, res) => {
    const { runId } = req.body; // Expect runId, irrelevant if logic handles array, but let's stick to update status
    db.run("UPDATE dividend_runs SET status = 'POSTED' WHERE id = ?", [runId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Dividends posted" });
    });
});

// Contributions Endpoint (Local)
app.post('/api/contributions', (req, res) => {
    const { memberId, amount, type } = req.body;
    const stmt = db.prepare(`
        INSERT INTO transactions (
            memberId, savings_amount, transaction_type, description, created_at, uploaded
        ) VALUES (?, ?, 'Contribution', ?, ?, 1)
    `);

    stmt.run(memberId, amount, `${type} Contribution`, new Date().toISOString(), function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Update Savings
        db.run("UPDATE members SET current_savings = current_savings + ? WHERE id = ?", [amount, memberId]);
        res.json({ id: this.lastID, status: 'Completed', message: 'Contribution recorded' });
    });
    stmt.finalize();
});


// ==========================================
// OFFICERS API
// ==========================================

// Get all officers with their assigned groups
app.get('/api/officers', (req, res) => {
    const query = `
        SELECT o.*, GROUP_CONCAT(g.name) as groupNames, GROUP_CONCAT(g.id) as groupIds
        FROM officers o
        LEFT JOIN officer_groups og ON o.id = og.officer_id
        LEFT JOIN groups g ON og.group_id = g.id
        GROUP BY o.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => ({
            ...row,
            assignedGroups: row.groupNames ? row.groupNames.split(',').map((name, i) => ({
                id: row.groupIds.split(',')[i],
                name: name
            })) : []
        })));
    });
});

// Create/Update officer
app.post('/api/officers', (req, res) => {
    const { id, name, role, phone, email, status, password_hash, password } = req.body;
    const final_password_hash = password_hash || password || null;

    if (id) {
        const stmt = db.prepare("UPDATE officers SET name=?, role=?, phone=?, email=?, status=? WHERE id=?");
        stmt.run(name, role, phone, email, status, id, function (err) {
            if (err) {
                console.error("Update Officer Error:", err);
                return res.status(500).json({ error: err.message });
            }
            logAudit(`Update Officer: ${name}`, 'admin', { id, email });
            res.json({ success: true, id });
        });
        stmt.finalize();
    } else {
        const stmt = db.prepare("INSERT INTO officers (name, role, phone, email, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)");
        stmt.run(name, role, phone, email, status || 'active', final_password_hash, function (err) {
            if (err) {
                console.error("Create Officer Error:", err);
                if (err.message.includes('UNIQUE constraint failed: officers.email')) {
                    return res.status(400).json({ error: "An officer with this email already exists." });
                }
                return res.status(500).json({ error: err.message });
            }
            logAudit(`Create Officer: ${name}`, 'admin', { id: this.lastID, email });
            res.json({ success: true, id: this.lastID });
        });
        stmt.finalize();
    }
});

// Reset Officer Password
app.post('/api/officers/:id/reset-password', (req, res) => {
    const { id } = req.params;
    const { password_hash } = req.body;

    if (!password_hash) return res.status(400).json({ error: "Password hash required" });

    const stmt = db.prepare("UPDATE officers SET password_hash = ? WHERE id = ?");
    stmt.run(password_hash, id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(`Reset Password: Officer ID ${id}`, 'admin', { id });
        res.json({ success: true, message: "Password reset successful" });
    });
    stmt.finalize();
});

// Allocate Groups to Officer
app.post('/api/officers/:id/groups', (req, res) => {
    const officerId = req.params.id;
    const { groupIds } = req.body; // Array of group IDs

    db.serialize(() => {
        db.run("DELETE FROM officer_groups WHERE officer_id = ?", [officerId]);
        const stmt = db.prepare("INSERT INTO officer_groups (officer_id, group_id) VALUES (?, ?)");
        groupIds.forEach(groupId => {
            stmt.run(officerId, groupId);
        });
        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Delete Officer
app.delete('/api/officers/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM officers WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});


// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
