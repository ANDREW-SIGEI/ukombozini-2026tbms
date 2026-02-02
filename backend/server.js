const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Modular Imports ("Well Arranged")
const { initSchema } = require('./database/schema');
const { authenticateToken, isAdmin } = require('./middleware/auth');
const { checkFreeze } = require('./middleware/guards');
const { logAudit, logAndSendSMS } = require('./utils/logger');
const { initLedgerSchema } = require('./database/ledger_schema');
const { initCashControl } = require('./database/cash_control_schema');
const CashControlService = require('./services/CashControlService');
const MonthlyReportService = require('./services/MonthlyReportService');
const reportService = require('./services/reportService');

const partnershipRoutes = require('./routes/partnership');
const governanceRoutes = require('./routes/governance');
const reversalRoutes = require('./routes/reversals');

const JWT_SECRET = process.env.JWT_SECRET || 'ukombozi-secret-key-2026';

// ==========================================
// 🛡️ GLOBAL ERROR GUARDS
// ==========================================
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception!');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    console.error('Stack:', err.stack);
    // Don't exit - let the server keep trying to run
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection');
    console.error('Reason:', reason);
    // Don't exit - let the server keep trying to run
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// 📝 REQUEST LOGGER
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
    });
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Initialize Database Schema
initSchema();
initLedgerSchema(db).catch(err => console.error("Ledger Init Failed:", err));
initCashControl().catch(err => console.error("Cash Control Init Failed:", err));

// Mount Modular Routes
app.use('/api/partnership', partnershipRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/reversals', reversalRoutes);

// Compatibility Mounts (Ensures legacy frontend paths work)
app.use('/api/admin', governanceRoutes);
app.use('/api/risk', governanceRoutes);
app.use('/api/audit', governanceRoutes);
// Basic Health Check (Public)
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ONLINE',
        version: '2.5.0-HARDENED',
        environment: 'Production-Local',
        lockdown: true
    });
});

// Loan Product Management
// Get Loan Products (Admin/Officer)
app.get('/api/loan-products', (req, res) => {
    db.all("SELECT * FROM loan_products WHERE is_active = 1 ORDER BY loan_amount", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/admin/loan-products', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT * FROM loan_products ORDER BY loan_amount", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create/Update Loan Product
app.post('/api/admin/loan-products', authenticateToken, isAdmin, (req, res) => {
    const {
        id, name, code, loan_amount, monthly_installment,
        principal_portion, interest_portion, shares_contribution,
        repayment_period_months, is_active
    } = req.body;

    if (id) {
        // Update
        const stmt = db.prepare(`
            UPDATE loan_products 
            SET name=?, code=?, loan_amount=?, monthly_installment=?, 
                principal_portion=?, interest_portion=?, shares_contribution=?, 
                repayment_period_months=?, is_active=?
            WHERE id=?
        `);
        stmt.run(
            name, code, loan_amount, monthly_installment,
            principal_portion, interest_portion, shares_contribution,
            repayment_period_months, is_active, id,
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                logAudit(`Update Loan Product: ${code}`, 'admin', { id, name });
                res.json({ success: true, id });
            }
        );
        stmt.finalize();
    } else {
        // Create
        const stmt = db.prepare(`
            INSERT INTO loan_products (
                name, code, loan_amount, monthly_installment, 
                principal_portion, interest_portion, shares_contribution, 
                repayment_period_months, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            name, code, loan_amount, monthly_installment,
            principal_portion, interest_portion, shares_contribution,
            repayment_period_months, is_active,
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, id: this.lastID });
            }
        );
        stmt.finalize();
    }
});

// Redundant reversal routes moved to routes/reversals.js

// ==========================================
// AUTHENTICATION API
// ==========================================

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get("SELECT * FROM officers WHERE email = ? AND status = 'active'", [email], async (err, officer) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!officer) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, officer.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create token
        const token = jwt.sign(
            { id: officer.id, email: officer.email, role: officer.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: officer.id,
                email: officer.email,
                name: officer.name,
                role: officer.role.toLowerCase()
            }
        });
    });
});

// Get Current User (Me)
app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        db.get("SELECT id, name, email, role, phone, created_at FROM officers WHERE id = ?", [verified.id], (err, officer) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!officer) return res.status(404).json({ error: 'User not found' });
            res.json({
                ...officer,
                role: officer.role.toLowerCase(),
                full_name: officer.name, // Mapping for frontend
                member_since: officer.created_at
            });
        });
    } catch (err) {
        res.status(400).json({ error: 'Invalid token' });
    }
});

// ==========================================
// 👤 MEMBER & GROUP CONTEXT API
// ==========================================

// GET /api/members/:id - Get single member by ID
app.get('/api/members/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.get(`
        SELECT m.*, g.name as group_name 
        FROM members m 
        LEFT JOIN groups g ON m.group_id = g.id 
        WHERE m.id = ?
    `, [id], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.status(404).json({ error: 'Member not found' });
        res.json(member);
    });
});

// GET /api/groups/:id - Get single group by ID
app.get('/api/groups/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM groups WHERE id = ?`, [id], (err, group) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        res.json(group);
    });
});

// GET /api/groups - Get all groups
app.get('/api/groups', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM groups ORDER BY name ASC`, [], (err, groups) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(groups || []);
    });
});


// GET /api/sessions/latest - Get latest cash session for a group
app.get('/api/sessions/latest', authenticateToken, (req, res) => {
    const { groupId } = req.query;
    if (!groupId) return res.status(400).json({ error: 'groupId is required' });

    db.get(`
        SELECT * FROM cash_sessions 
        WHERE group_id = ? 
        ORDER BY opened_at DESC 
        LIMIT 1
    `, [groupId], (err, session) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(session || null);
    });
});

// GET /api/members/:id/day-limit - Get member's daily project limit (stub)
app.get('/api/members/:id/day-limit', authenticateToken, (req, res) => {
    // Stub - returns null, can be extended later
    res.json(null);
});

// Legacy Aliases for frontend compatibility
app.get('/api/cash-sessions/latest/:groupId', authenticateToken, (req, res) => {
    const { groupId } = req.params;
    db.get(`SELECT * FROM cash_sessions WHERE group_id = ? ORDER BY opened_at DESC LIMIT 1`, [groupId], (err, session) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(session || null);
    });
});

app.get('/api/projects/member/:id/daily-limit', authenticateToken, (req, res) => {
    res.json({ remaining_limit: 50000, daily_savings: 0 }); // Hardcoded safe defaults
});

// GET /api/notifications/logs - Simple stub
app.get('/api/notifications/logs', (req, res) => {
    res.json([]);
});


// GET /api/loans - Get loans (optionally filtered by memberId)
app.get('/api/loans', authenticateToken, (req, res) => {
    const { memberId } = req.query;

    let query = `
        SELECT l.*, m.name as member_name, g.name as group_name
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        LEFT JOIN groups g ON m.group_id = g.id
    `;
    let params = [];

    if (memberId) {
        query += ` WHERE l.member_id = ?`;
        params.push(memberId);
    }

    query += ` ORDER BY l.disbursed_at DESC`;

    db.all(query, params, (err, loans) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(loans || []);
    });
});

// GET /api/members - Get members (optionally filtered by groupId)
app.get('/api/members', authenticateToken, (req, res) => {
    const { groupId } = req.query;

    let query = `
        SELECT m.*, g.name as group_name
        FROM members m
        LEFT JOIN groups g ON m.group_id = g.id
    `;
    let params = [];

    if (groupId) {
        query += ` WHERE m.group_id = ?`;
        params.push(groupId);
    }

    query += ` ORDER BY m.name ASC`;

    db.all(query, params, (err, members) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(members || []);
    });
});


// ==========================================
// 🏛️ MEMBER TRANSACTION ENGINE (MTE)
// ==========================================

// POST /api/transactions/preview - Preview the impact of a transaction
app.post('/api/transactions/preview', authenticateToken, (req, res) => {
    const { memberId, transaction_type, amount } = req.body;

    if (!memberId || !transaction_type || amount === undefined) {
        return res.status(400).json({ error: 'Missing required fields for preview' });
    }

    db.get(`SELECT * FROM members WHERE id = ?`, [memberId], (err, member) => {
        if (err || !member) return res.status(404).json({ error: 'Member not found' });

        const val = parseFloat(amount) || 0;
        let preview = {
            metrics: [],
            split: null
        };

        switch (transaction_type) {
            case 'savings':
                preview.metrics = [
                    { label: 'Current Savings', before: member.current_savings, after: (member.current_savings || 0) + val },
                    { label: 'Risk Score', before: member.risk_score, after: Math.max(0, (member.risk_score || 50) - 1), isRisk: true }
                ];
                break;
            case 'welfare':
                preview.metrics = [
                    { label: 'Welfare Balance', before: member.welfare_balance, after: (member.welfare_balance || 0) + val }
                ];
                break;
            case 'loanrepayment':
                // For repayment, we normally need more context (penalties vs principal)
                // This is a simplified preview
                preview.metrics = [
                    { label: 'Active Loan Bal', before: member.active_loan_balance, after: Math.max(0, (member.active_loan_balance || 0) - val) }
                ];
                break;
            // ... more cases can be added
        }

        res.json(preview);
    });
});

// POST /api/transactions/post - Unified Commit Endpoint
app.post('/api/transactions/post', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const {
        memberId, sessionId, transaction_type, amount,
        description, officerId, breakdown
    } = req.body;

    if (!memberId || !transaction_type || !amount) {
        return res.status(400).json({ error: 'Missing mandatory fields: memberId, transaction_type, and amount are required' });
    }

    const val = parseFloat(amount);
    if (val <= 0 && transaction_type !== 'adjustment') {
        return res.status(400).json({ error: 'Transaction amount must be greater than 0' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const txType = transaction_type.toLowerCase();
        let memberUpdates = [];
        let memberParams = [];
        let txColumns = ['memberId', 'sessionId', 'transaction_type', 'description', 'status', 'uploaded', 'attended'];
        let txValues = [memberId, sessionId || null, transaction_type.toUpperCase(), description || '', 'COMPLETED', 1, 1];

        // 1. Determine Logic based on Type
        if (txType === 'savings') {
            memberUpdates.push('current_savings = COALESCE(current_savings, 0) + ?');
            memberUpdates.push('risk_score = MAX(0, COALESCE(risk_score, 50) - 1)');
            memberParams.push(val);
            txColumns.push('savings_amount');
            txValues.push(val);
        } else if (txType === 'welfare') {
            memberUpdates.push('welfare_balance = COALESCE(welfare_balance, 0) + ?');
            memberParams.push(val);
            txColumns.push('welfare');
            txValues.push(val);
        } else if (txType === 'penalty') {
            memberUpdates.push('penalties = COALESCE(penalties, 0) + ?');
            memberUpdates.push('risk_score = MIN(100, COALESCE(risk_score, 50) + 10)');
            memberParams.push(val);
            txColumns.push('fines');
            txValues.push(val);
        } else if (txType === 'education' || txType === 'agriculture') {
            const col = txType === 'education' ? 'education_savings' : 'agriculture_savings';
            memberUpdates.push(`${col} = COALESCE(${col}, 0) + ?`);
            memberParams.push(val);
            // We use the general 'savings_amount' or custom project mapping if exists
            txColumns.push('savings_amount');
            txValues.push(val);
        } else if (txType === 'loanrepayment') {
            // Simplified repayment logic for the orchestrator
            // In a real system, this would use the 'breakdown' from preview
            const penaltyPart = breakdown?.penalty || 0;
            const principalPart = val - penaltyPart;

            memberUpdates.push('active_loan_balance = MAX(0, COALESCE(active_loan_balance, 0) - ?)');
            memberUpdates.push('penalties = MAX(0, COALESCE(penalties, 0) - ?)');
            memberParams.push(principalPart, penaltyPart);

            txColumns.push('stl_repayment', 'fines');
            txValues.push(principalPart, penaltyPart);
        } else if (txType === 'withdrawal') {
            memberUpdates.push('current_savings = MAX(0, COALESCE(current_savings, 0) - ?)');
            memberParams.push(val);
            txColumns.push('withdrawals');
            txValues.push(val);
        } else if (txType === 'productfinancing') {
            // Asset Financing Commitment
            memberUpdates.push('current_savings = COALESCE(current_savings, 0) + ?');
            // In some systems, this goes to savings, in others to a dedicated asset account. 
            // For now, we align with the existing 'issue-product' logic which usually tracks it as savings/commitment.
            memberParams.push(val);
            txColumns.push('savings_amount');
            txValues.push(val);
        }

        if (memberUpdates.length === 0) {
            db.run('ROLLBACK');
            return res.status(400).json({ error: 'Unsupported transaction type' });
        }

        memberParams.push(memberId);
        const memberQuery = `UPDATE members SET ${memberUpdates.join(', ')} WHERE id = ?`;

        db.run(memberQuery, memberParams, function (err) {
            if (err) {
                console.error('[MTE ERROR] Member Update:', err.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Database update failed: ' + err.message });
            }

            const placeholders = txValues.map(() => '?').join(', ');
            const txQuery = `INSERT INTO transactions (${txColumns.join(', ')}) VALUES (${placeholders})`;

            db.run(txQuery, txValues, function (err) {
                if (err) {
                    console.error('[MTE ERROR] Transaction Log:', err.message);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Transaction logging failed: ' + err.message });
                }

                const txId = this.lastID;
                const txRef = `TXN-${txId}-${Date.now()}`;

                // 2. Write to Central Ledger (MANDATORY for Financial Integrity)
                db.run(`INSERT INTO ledger_entries (
                    tx_ref, member_id, group_id, product_code, direction, amount, session_id, officer_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    txRef, memberId, breakdown?.groupId || null, transaction_type.toUpperCase(),
                    txType === 'withdrawal' ? 'DEBIT' : 'CREDIT', val,
                    sessionId || null, officerId || req.user.id, description || ''
                ], (ledgerErr) => {
                    if (ledgerErr) {
                        console.error('[MTE ERROR] Ledger Logging Failed:', ledgerErr.message);
                        // We don't rollback here because the main transaction has already been logged,
                        // but we should definitely log it clearly. In a strict system, this would be within the same transaction.
                    }

                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Commit failed' });
                        }

                        logAudit(`MTE Commit: ${transaction_type} KES ${val}`, 'FINANCIAL', { memberId, val }, officerId || req.user.id, req.user.name, req);

                        res.json({
                            success: true,
                            transactionId: txId,
                            tx_reference: txRef,
                            message: `✅ ${transaction_type} of KES ${val.toLocaleString()} processed successfully`
                        });
                    });
                });
            });
        });
    });
});

// ==========================================
// 💰 CONTRIBUTION ENGINE API
// ==========================================

// POST /api/contributions/post - Post a contribution (savings, welfare, project)
app.post('/api/contributions/post', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { memberId, sessionId, savings, welfare, project, projectType, penalty, description, officerId } = req.body;

    if (!memberId) return res.status(400).json({ error: 'Member ID is required' });

    const savingsAmt = parseFloat(savings) || 0;
    const welfareAmt = parseFloat(welfare) || 0;
    const projectAmt = parseFloat(project) || 0;
    const penaltyAmt = parseFloat(penalty) || 0;
    const totalAmount = savingsAmt + welfareAmt + projectAmt + penaltyAmt;

    if (totalAmount <= 0) {
        return res.status(400).json({ error: 'At least one contribution type must be greater than 0' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Build update query dynamically
        let updates = [];
        let params = [];

        if (savingsAmt > 0) {
            updates.push('current_savings = COALESCE(current_savings, 0) + ?');
            updates.push('risk_score = MAX(0, COALESCE(risk_score, 50) - 1)');
            params.push(savingsAmt);
        }
        if (welfareAmt > 0) {
            updates.push('welfare_balance = COALESCE(welfare_balance, 0) + ?');
            params.push(welfareAmt);
        }
        if (projectType === 'education' && projectAmt > 0) {
            updates.push('education_savings = COALESCE(education_savings, 0) + ?');
            params.push(projectAmt);
        }
        if (projectType === 'agriculture' && projectAmt > 0) {
            updates.push('agriculture_savings = COALESCE(agriculture_savings, 0) + ?');
            params.push(projectAmt);
        }
        if (penaltyAmt > 0) {
            updates.push('penalties = COALESCE(penalties, 0) + ?');
            updates.push('risk_score = MIN(100, COALESCE(risk_score, 50) + 10)');
            params.push(penaltyAmt);
        }

        if (updates.length === 0) {
            db.run('ROLLBACK');
            return res.status(400).json({ error: 'No valid contribution types provided' });
        }

        params.push(memberId);

        db.run(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
            if (err) {
                console.error('[DB ERROR] Member Update Failed:', err.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            // Log the transaction
            const transactionType = savingsAmt > 0 ? 'SAVINGS' : welfareAmt > 0 ? 'WELFARE' : penaltyAmt > 0 ? 'PENALTY' : 'PROJECT';
            const txRef = `TXN-${Date.now()}`;

            db.run(`
                INSERT INTO transactions (
                    memberId, sessionId, transaction_type, 
                    savings_amount, welfare, fines, description, 
                    status, uploaded, attended
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', 1, 1)
            `, [
                memberId, sessionId || null, transactionType,
                savingsAmt, welfareAmt, penaltyAmt, description || ''
            ], function (err) {
                if (err) {
                    console.error('[DB ERROR] Transaction Insertion Failed:', err.message);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                const txId = this.lastID;
                const txRef = `TXN-${txId}-${Date.now()}`;

                // Commit transaction
                db.run('COMMIT', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    logAudit(`Posted contribution: ${transactionType} KES ${totalAmount}`, 'contribution', {
                        memberId, savings: savingsAmt, welfare: welfareAmt, project: projectAmt
                    });

                    // 📱 Send SMS Confirmation
                    db.get(`SELECT name, current_savings FROM members WHERE id = ?`, [memberId], (err, member) => {
                        if (!err && member) {
                            const smsMessage = `✅ UKOMBOZI: Your ${transactionType} of KES ${totalAmount.toLocaleString()} has been received.\n\nNew Savings Balance: KES ${(member.current_savings || 0).toLocaleString()}\n\nRef: ${txRef}\n\nThank you!`;
                            logAndSendSMS(memberId, smsMessage, 'CONTRIBUTION_CONFIRMATION', txId);
                        }
                    });

                    res.json({
                        success: true,
                        transactionId: txId,
                        tx_reference: txRef,
                        breakdown: {
                            savings: savingsAmt,
                            welfare: welfareAmt,
                            project: projectAmt,
                            penalty: penaltyAmt,
                            total: totalAmount
                        },
                        message: `✅ Contribution of KES ${totalAmount.toLocaleString()} posted successfully`
                    });
                });
            });
        });
    });
});

// GET /api/contributions/history/:memberId - Get contribution history
app.get('/api/contributions/history/:memberId', authenticateToken, (req, res) => {
    db.all(`
        SELECT * FROM transactions 
        WHERE member_id = ? AND transaction_type IN ('SAVINGS', 'WELFARE', 'PROJECT', 'PENALTY')
        ORDER BY created_at DESC
        LIMIT 50
    `, [req.params.memberId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// POST /api/contributions/validate - Validate contribution before posting
app.post('/api/contributions/validate', authenticateToken, (req, res) => {
    const { memberId, savings, welfare, project } = req.body;

    if (!memberId) return res.status(400).json({ valid: false, error: 'Member ID required' });

    db.get(`SELECT * FROM members WHERE id = ?`, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.status(404).json({ valid: false, error: 'Member not found' });

        res.json({
            valid: true,
            member: {
                name: member.name,
                current_savings: member.current_savings || 0,
                risk_score: member.risk_score || 50
            },
            message: 'Contribution validated successfully'
        });
    });
});

// ==========================================
// 💸 WITHDRAWAL ENGINE API
// ==========================================

// POST /api/withdrawals/post - Process a withdrawal
app.post('/api/withdrawals/post', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { memberId, sessionId, amount, reason, officerId } = req.body;

    if (!memberId || !amount) {
        return res.status(400).json({ error: 'Member ID and amount are required' });
    }

    const withdrawalAmt = parseFloat(amount);
    if (withdrawalAmt <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Check member has sufficient savings
    db.get(`SELECT * FROM members WHERE id = ?`, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const currentSavings = member.current_savings || 0;
        if (currentSavings < withdrawalAmt) {
            return res.status(400).json({
                error: `Insufficient savings. Available: KES ${currentSavings.toLocaleString()}`
            });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Update member savings
            db.run(`UPDATE members SET 
                current_savings = current_savings - ?,
                risk_score = MIN(100, COALESCE(risk_score, 50) + 2)
            WHERE id = ?`, [withdrawalAmt, memberId], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                const txRef = `WDR-${Date.now()}`;

                // Log the withdrawal transaction
                db.run(`
                    INSERT INTO transactions (
                        memberId, sessionId, transaction_type, withdrawals,
                        description, status, uploaded, attended
                    ) VALUES (?, ?, 'WITHDRAWAL', ?, ?, 'COMPLETED', 1, 1)
                `, [
                    memberId, sessionId || null, withdrawalAmt,
                    reason || 'Savings withdrawal'
                ], function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    const txId = this.lastID;
                    const newBalance = currentSavings - withdrawalAmt;

                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }

                        logAudit(`Withdrawal: KES ${withdrawalAmt}`, 'withdrawal', { memberId, reason });

                        // 📱 Send SMS Confirmation
                        const smsMessage = `⚠️ UKOMBOZI: Withdrawal of KES ${withdrawalAmt.toLocaleString()} processed.\n\nRemaining Balance: KES ${newBalance.toLocaleString()}\n\nRef: ${txRef}`;
                        logAndSendSMS(memberId, smsMessage, 'WITHDRAWAL_CONFIRMATION', txId);

                        res.json({
                            success: true,
                            transactionId: txId,
                            tx_reference: txRef,
                            newBalance: newBalance,
                            message: `✅ Withdrawal of KES ${withdrawalAmt.toLocaleString()} processed successfully`
                        });
                    });
                });
            });
        });
    });
});

// POST /api/withdrawals/validate - Validate withdrawal before posting
app.post('/api/withdrawals/validate', authenticateToken, (req, res) => {
    const { memberId, amount } = req.body;

    db.get(`SELECT name, current_savings, risk_score FROM members WHERE id = ?`, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.status(404).json({ valid: false, error: 'Member not found' });

        const available = member.current_savings || 0;
        const requested = parseFloat(amount) || 0;

        res.json({
            valid: requested <= available,
            available: available,
            requested: requested,
            shortfall: requested > available ? requested - available : 0,
            member: member
        });
    });
});

// ==========================================
// 💳 LOAN REPAYMENT ENGINE API
// ==========================================

// POST /api/loans/repay - Process loan repayment
app.post('/api/loans/repay', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { loanId, amount, sessionId, description } = req.body;

    if (!loanId || !amount) {
        return res.status(400).json({ error: 'Loan ID and amount are required' });
    }

    const repaymentAmt = parseFloat(amount);
    if (repaymentAmt <= 0) {
        return res.status(400).json({ error: 'Repayment amount must be greater than 0' });
    }

    // Get loan details
    db.get(`SELECT l.*, m.name as member_name, m.id as member_id 
            FROM loans l JOIN members m ON l.member_id = m.id
            WHERE l.id = ?`, [loanId], (err, loan) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!loan) return res.status(404).json({ error: 'Loan not found' });

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Calculate allocation: Penalties → Interest → Principal
            let remaining = repaymentAmt;
            const penaltyPaid = Math.min(remaining, loan.outstanding_penalty || 0);
            remaining -= penaltyPaid;
            const interestPaid = Math.min(remaining, loan.outstanding_interest || 0);
            remaining -= interestPaid;
            const principalPaid = remaining;

            const newPenalty = (loan.outstanding_penalty || 0) - penaltyPaid;
            const newInterest = (loan.outstanding_interest || 0) - interestPaid;
            const newPrincipal = (loan.principal_amount || 0) - principalPaid;

            const isFullyPaid = newPrincipal <= 0 && newInterest <= 0 && newPenalty <= 0;
            const newStatus = isFullyPaid ? 'CLOSED' : 'Active';

            // Update loan
            db.run(`UPDATE loans SET 
                outstanding_penalty = ?,
                outstanding_interest = ?,
                principal_amount = ?,
                status = ?
            WHERE id = ?`, [
                Math.max(0, newPenalty),
                Math.max(0, newInterest),
                Math.max(0, newPrincipal),
                newStatus,
                loanId
            ], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                // Update member loan balance and risk score
                db.run(`UPDATE members SET 
                    active_loan_balance = MAX(0, COALESCE(active_loan_balance, 0) - ?),
                    penalties = MAX(0, COALESCE(penalties, 0) - ?),
                    risk_score = MAX(0, COALESCE(risk_score, 50) - 10)
                WHERE id = ?`, [principalPaid, penaltyPaid, loan.member_id], function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    const txRef = `REP-${Date.now()}`;

                    // Log repayment transaction
                    db.run(`
                        INSERT INTO transactions (
                            memberId, sessionId, transaction_type, 
                            stl_repayment, ltl_repayment, loan_interest, fines,
                            description, status, uploaded, attended
                        ) VALUES (?, ?, 'LOAN_REPAYMENT', ?, ?, ?, ?, ?, 'COMPLETED', 1, 1)
                    `, [
                        loan.member_id, sessionId || null,
                        repaymentAmt, // Basic mapping, engine normally splits this but for log we put in stl_repayment by default or distribute
                        0, 0, penaltyPaid,
                        description || `Repayment for Loan #${loanId}`
                    ], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }

                        const txId = this.lastID;

                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: err.message });
                            }

                            logAudit(`Loan Repayment: KES ${repaymentAmt}`, 'loan_repayment', {
                                loanId, penaltyPaid, interestPaid, principalPaid
                            });

                            // 📱 Send SMS Confirmation
                            const remainingBal = Math.max(0, newPrincipal) + Math.max(0, newInterest) + Math.max(0, newPenalty);
                            const smsMessage = isFullyPaid
                                ? `🎉 UKOMBOZI: Loan #${loanId} FULLY PAID!\n\nTotal Repaid: KES ${repaymentAmt.toLocaleString()}\n\nThank you for your commitment!`
                                : `✅ UKOMBOZI: Loan repayment of KES ${repaymentAmt.toLocaleString()} received.\n\nRemaining: KES ${remainingBal.toLocaleString()}\n\nRef: ${txRef}`;
                            logAndSendSMS(loan.member_id, smsMessage, 'LOAN_REPAYMENT_CONFIRMATION', txId);

                            res.json({
                                success: true,
                                transactionId: txId,
                                tx_reference: txRef,
                                allocation: {
                                    penalty: penaltyPaid,
                                    interest: interestPaid,
                                    principal: principalPaid
                                },
                                remainingBalance: remainingBal,
                                loanStatus: newStatus,
                                message: isFullyPaid
                                    ? `🎉 Loan #${loanId} fully paid! Congratulations!`
                                    : `✅ Repayment of KES ${repaymentAmt.toLocaleString()} processed`
                            });
                        });
                    });
                });
            });
        });
    });
});

// ==========================================
// 📊 ARREARS TRACKING & DEFAULTER API
// ==========================================

// GET /api/arrears/summary - System-wide arrears statistics
app.get('/api/arrears/summary', authenticateToken, (req, res) => {
    const { groupId } = req.query;

    let whereClause = "WHERE l.status = 'Active'";
    const params = [];

    if (groupId) {
        whereClause += " AND m.group_id = ?";
        params.push(groupId);
    }

    db.get(`
        SELECT 
            COUNT(DISTINCT l.id) as total_active_loans,
            COUNT(DISTINCT CASE WHEN l.days_overdue > 0 THEN l.id END) as loans_in_arrears,
            COUNT(DISTINCT CASE WHEN l.days_overdue > 30 THEN l.id END) as critical_arrears,
            SUM(CASE WHEN l.days_overdue > 0 THEN l.principal_amount + COALESCE(l.outstanding_interest, 0) + COALESCE(l.outstanding_penalty, 0) ELSE 0 END) as total_arrears_amount,
            AVG(CASE WHEN l.days_overdue > 0 THEN l.days_overdue ELSE NULL END) as avg_days_overdue,
            COUNT(DISTINCT CASE WHEN l.days_overdue BETWEEN 1 AND 7 THEN l.member_id END) as warning_members,
            COUNT(DISTINCT CASE WHEN l.days_overdue BETWEEN 8 AND 30 THEN l.member_id END) as overdue_members,
            COUNT(DISTINCT CASE WHEN l.days_overdue > 30 THEN l.member_id END) as defaulter_members
        FROM loans l
        JOIN members m ON l.member_id = m.id
        ${whereClause}
    `, params, (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });

        // Get risk distribution
        db.all(`
            SELECT 
                CASE 
                    WHEN m.risk_score <= 30 THEN 'LOW'
                    WHEN m.risk_score <= 60 THEN 'MEDIUM'
                    ELSE 'HIGH'
                END as risk_level,
                COUNT(*) as count,
                SUM(COALESCE(m.active_loan_balance, 0)) as total_exposure
            FROM members m
            ${groupId ? 'WHERE m.group_id = ?' : ''}
            GROUP BY CASE 
                WHEN m.risk_score <= 30 THEN 'LOW'
                WHEN m.risk_score <= 60 THEN 'MEDIUM'
                ELSE 'HIGH'
            END
        `, groupId ? [groupId] : [], (err, riskDist) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                success: true,
                stats: {
                    totalActiveLoans: stats?.total_active_loans || 0,
                    loansInArrears: stats?.loans_in_arrears || 0,
                    criticalArrears: stats?.critical_arrears || 0,
                    totalArrearsAmount: stats?.total_arrears_amount || 0,
                    avgDaysOverdue: Math.round(stats?.avg_days_overdue || 0),
                    arrearsRate: stats?.total_active_loans ? ((stats.loans_in_arrears / stats.total_active_loans) * 100).toFixed(1) : 0
                },
                memberStatus: {
                    warning: stats?.warning_members || 0,
                    overdue: stats?.overdue_members || 0,
                    defaulter: stats?.defaulter_members || 0
                },
                riskDistribution: riskDist || []
            });
        });
    });
});

// GET /api/arrears/members - Get all members in arrears
app.get('/api/arrears/members', authenticateToken, (req, res) => {
    const { status, groupId, sortBy } = req.query;

    let whereClause = "WHERE l.status = 'Active' AND l.days_overdue > 0";
    const params = [];

    if (groupId) {
        whereClause += " AND m.group_id = ?";
        params.push(groupId);
    }

    // Filter by severity
    if (status === 'warning') {
        whereClause += " AND l.days_overdue BETWEEN 1 AND 7";
    } else if (status === 'overdue') {
        whereClause += " AND l.days_overdue BETWEEN 8 AND 30";
    } else if (status === 'defaulter') {
        whereClause += " AND l.days_overdue > 30";
    }

    const orderBy = sortBy === 'amount'
        ? 'ORDER BY total_arrears DESC'
        : sortBy === 'risk'
            ? 'ORDER BY m.risk_score DESC'
            : 'ORDER BY l.days_overdue DESC';

    db.all(`
        SELECT 
            m.id as member_id,
            m.name as member_name,
            m.phone,
            m.risk_score,
            g.name as group_name,
            l.id as loan_id,
            l.loan_type,
            l.days_overdue,
            l.principal_amount + COALESCE(l.outstanding_interest, 0) + COALESCE(l.outstanding_penalty, 0) as total_arrears,
            l.principal_amount,
            l.outstanding_interest,
            l.outstanding_penalty,
            l.due_date,
            CASE 
                WHEN l.days_overdue BETWEEN 1 AND 7 THEN 'WARNING'
                WHEN l.days_overdue BETWEEN 8 AND 30 THEN 'OVERDUE'
                ELSE 'DEFAULTER'
            END as severity,
            (SELECT COUNT(*) FROM sms_logs WHERE member_id = m.id AND type = 'ARREARS_REMINDER' AND created_at > date('now', '-7 days')) as reminders_sent_week
        FROM loans l
        JOIN members m ON l.member_id = m.id
        LEFT JOIN groups g ON m.group_id = g.id
        ${whereClause}
        ${orderBy}
        LIMIT 100
    `, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            success: true,
            count: rows?.length || 0,
            members: rows || []
        });
    });
});

// POST /api/arrears/notify - Send arrears reminder to selected members
app.post('/api/arrears/notify', authenticateToken, (req, res) => {
    const { memberIds, customMessage } = req.body;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: 'Member IDs array is required' });
    }

    const placeholders = memberIds.map(() => '?').join(',');

    db.all(`
        SELECT 
            m.id, m.name, m.phone,
            l.principal_amount + COALESCE(l.outstanding_interest, 0) + COALESCE(l.outstanding_penalty, 0) as arrears,
            l.days_overdue
        FROM members m
        JOIN loans l ON m.id = l.member_id
        WHERE m.id IN (${placeholders}) AND l.status = 'Active' AND l.days_overdue > 0
    `, memberIds, async (err, members) => {
        if (err) return res.status(500).json({ error: err.message });

        const results = { sent: 0, failed: 0, details: [] };

        for (const member of members) {
            const message = customMessage
                ? customMessage.replace('{{name}}', member.name).replace('{{amount}}', member.arrears.toLocaleString()).replace('{{days}}', member.days_overdue)
                : `🚨 UKOMBOZI URGENT: Dear ${member.name}, your loan payment of KES ${member.arrears.toLocaleString()} is ${member.days_overdue} days overdue.\n\nPlease make payment immediately to avoid penalties.\n\nContact: 0700-000-000`;

            try {
                await logAndSendSMS(member.id, message, 'ARREARS_REMINDER');
                results.sent++;
                results.details.push({ memberId: member.id, name: member.name, status: 'SENT' });
            } catch (err) {
                results.failed++;
                results.details.push({ memberId: member.id, name: member.name, status: 'FAILED', error: err.message });
            }
        }

        logAudit(`Sent ${results.sent} arrears reminders`, 'arrears', { memberIds, sent: results.sent, failed: results.failed });

        res.json({
            success: true,
            ...results,
            message: `📱 Sent ${results.sent} reminders, ${results.failed} failed`
        });
    });
});

// GET /api/arrears/history/:memberId - Get arrears history for a member
app.get('/api/arrears/history/:memberId', authenticateToken, (req, res) => {
    db.all(`
        SELECT 
            l.id as loan_id,
            l.loan_type,
            l.principal_amount,
            l.interest_rate,
            l.status,
            l.days_overdue,
            l.created_at as loan_date,
            (SELECT COUNT(*) FROM sms_logs WHERE member_id = ? AND type LIKE '%ARREARS%') as total_reminders_sent
        FROM loans l
        WHERE l.member_id = ?
        ORDER BY l.created_at DESC
    `, [req.params.memberId, req.params.memberId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// ==========================================
// 📈 DIRECTOR DASHBOARD API
// ==========================================

// GET /api/dashboard/director - Executive Summary KPIs
app.get('/api/dashboard/director', authenticateToken, (req, res) => {
    // Get comprehensive system metrics
    db.serialize(() => {
        const result = {};

        // 1. Member Metrics
        db.get(`
            SELECT 
                COUNT(*) as total_members,
                SUM(COALESCE(current_savings, 0)) as total_savings,
                SUM(COALESCE(welfare_balance, 0)) as total_welfare,
                SUM(COALESCE(education_savings, 0) + COALESCE(agriculture_savings, 0)) as total_projects,
                AVG(COALESCE(risk_score, 50)) as avg_risk_score,
                COUNT(CASE WHEN risk_score > 70 THEN 1 END) as high_risk_members
            FROM members WHERE status = 'Active'
        `, [], (err, memberStats) => {
            if (err) return res.status(500).json({ error: err.message });
            result.members = memberStats;

            // 2. Loan Portfolio
            db.get(`
                SELECT 
                    COUNT(*) as total_loans,
                    COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_loans,
                    SUM(CASE WHEN status = 'Active' THEN principal_amount ELSE 0 END) as outstanding_principal,
                    SUM(CASE WHEN status = 'Active' THEN COALESCE(outstanding_interest, 0) ELSE 0 END) as outstanding_interest,
                    COUNT(CASE WHEN days_overdue > 0 THEN 1 END) as loans_in_arrears,
                    SUM(CASE WHEN days_overdue > 0 THEN principal_amount + COALESCE(outstanding_interest, 0) ELSE 0 END) as arrears_amount
                FROM loans
            `, [], (err, loanStats) => {
                if (err) return res.status(500).json({ error: err.message });
                result.loans = loanStats;

                // 3. Group Stats
                db.get(`
                    SELECT 
                        COUNT(*) as total_groups,
                        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_groups
                    FROM groups
                `, [], (err, groupStats) => {
                    if (err) return res.status(500).json({ error: err.message });
                    result.groups = groupStats;

                    // 4. Transaction Summary (Last 30 days)
                    db.get(`
                        SELECT 
                            COUNT(*) as transaction_count,
                            SUM(amount) as total_amount,
                            SUM(CASE WHEN transaction_type IN ('SAVINGS', 'WELFARE', 'PROJECT') THEN amount ELSE 0 END) as deposits,
                            SUM(CASE WHEN transaction_type = 'WITHDRAWAL' THEN amount ELSE 0 END) as withdrawals,
                            SUM(CASE WHEN transaction_type = 'LOAN_REPAYMENT' THEN amount ELSE 0 END) as repayments
                        FROM transactions
                        WHERE created_at > date('now', '-30 days')
                    `, [], (err, txStats) => {
                        if (err) return res.status(500).json({ error: err.message });
                        result.transactions = txStats;

                        // 5. KPIs
                        const totalAssets = (result.members?.total_savings || 0) + (result.members?.total_welfare || 0) + (result.members?.total_projects || 0);
                        const totalLiabilities = (result.loans?.outstanding_principal || 0) + (result.loans?.outstanding_interest || 0);
                        const netPosition = totalAssets - totalLiabilities;
                        const arrearsRate = result.loans?.active_loans ? ((result.loans.loans_in_arrears / result.loans.active_loans) * 100).toFixed(1) : 0;

                        res.json({
                            success: true,
                            timestamp: new Date().toISOString(),
                            kpis: {
                                totalAssets,
                                totalLiabilities,
                                netPosition,
                                arrearsRate: parseFloat(arrearsRate),
                                avgRiskScore: Math.round(result.members?.avg_risk_score || 50),
                                portfolioHealth: arrearsRate < 5 ? 'EXCELLENT' : arrearsRate < 15 ? 'GOOD' : arrearsRate < 30 ? 'FAIR' : 'CRITICAL'
                            },
                            members: result.members,
                            loans: result.loans,
                            groups: result.groups,
                            transactions: result.transactions
                        });
                    });
                });
            });
        });
    });
});

// GET /api/dashboard/portfolio - Detailed Portfolio Analytics
app.get('/api/dashboard/portfolio', authenticateToken, (req, res) => {
    db.serialize(() => {
        // Loan type distribution
        db.all(`
            SELECT 
                loan_type,
                COUNT(*) as count,
                SUM(principal_amount) as total_principal,
                AVG(interest_rate) as avg_interest_rate,
                COUNT(CASE WHEN days_overdue > 0 THEN 1 END) as in_arrears
            FROM loans
            WHERE status = 'Active'
            GROUP BY loan_type
        `, [], (err, loanTypes) => {
            if (err) return res.status(500).json({ error: err.message });

            // Monthly trend (last 6 months)
            db.all(`
                SELECT 
                    strftime('%Y-%m', created_at) as month,
                    SUM(CASE WHEN transaction_type IN ('SAVINGS', 'WELFARE', 'PROJECT') THEN amount ELSE 0 END) as deposits,
                    SUM(CASE WHEN transaction_type = 'LOAN_REPAYMENT' THEN amount ELSE 0 END) as repayments,
                    SUM(CASE WHEN transaction_type = 'WITHDRAWAL' THEN amount ELSE 0 END) as withdrawals
                FROM transactions
                WHERE created_at > date('now', '-6 months')
                GROUP BY strftime('%Y-%m', created_at)
                ORDER BY month DESC
            `, [], (err, monthlyTrend) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                    success: true,
                    loanDistribution: loanTypes || [],
                    monthlyTrend: monthlyTrend || []
                });
            });
        });
    });
});

// GET /api/dashboard/groups - Group Performance Ranking
app.get('/api/dashboard/groups', authenticateToken, (req, res) => {
    db.all(`
        SELECT 
            g.id,
            g.name,
            g.status,
            COUNT(DISTINCT m.id) as member_count,
            SUM(COALESCE(m.current_savings, 0)) as total_savings,
            SUM(COALESCE(m.active_loan_balance, 0)) as total_outstanding,
            AVG(COALESCE(m.risk_score, 50)) as avg_risk,
            SUM(COALESCE(m.current_savings, 0)) - SUM(COALESCE(m.active_loan_balance, 0)) as net_position,
            (SELECT COUNT(*) FROM loans l JOIN members m2 ON l.member_id = m2.id WHERE m2.group_id = g.id AND l.status = 'Active' AND l.days_overdue > 0) as loans_in_arrears
        FROM groups g
        LEFT JOIN members m ON g.id = m.group_id AND m.status = 'Active'
        GROUP BY g.id
        ORDER BY net_position DESC
        LIMIT 20
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Add ranking and health score
        const ranked = (rows || []).map((g, idx) => ({
            ...g,
            rank: idx + 1,
            avg_risk: Math.round(g.avg_risk || 50),
            health: g.loans_in_arrears === 0 ? 'EXCELLENT' : g.loans_in_arrears <= 2 ? 'GOOD' : 'NEEDS_ATTENTION'
        }));

        res.json({
            success: true,
            count: ranked.length,
            groups: ranked
        });
    });
});

// GET /api/dashboard/activity - Recent Activity Feed
app.get('/api/dashboard/activity', authenticateToken, (req, res) => {
    const limit = parseInt(req.query.limit) || 20;

    db.all(`
        SELECT 
            t.id,
            t.transaction_type,
            t.amount,
            t.created_at,
            m.name as member_name,
            g.name as group_name
        FROM transactions t
        JOIN members m ON t.member_id = m.id
        LEFT JOIN groups g ON m.group_id = g.id
        ORDER BY t.created_at DESC
        LIMIT ?
    `, [limit], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            success: true,
            count: rows?.length || 0,
            activities: rows || []
        });
    });
});

// Profile Management Endpoints
app.get('/api/profile', authenticateToken, (req, res) => {
    const userId = req.query.id || req.user.id;

    // Only admins or the user themselves can view full profiles if needed, 
    // but for now, any authenticated user can view their own.
    if (req.user.role !== 'Admin' && req.user.role !== 'director' && userId != req.user.id) {
        return res.status(403).json({ error: "Access denied." });
    }

    db.get("SELECT id, name, email, role, phone, created_at FROM officers WHERE id = ?", [userId], (err, officer) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!officer) return res.status(404).json({ error: "Officer profile not found." });

        res.json({
            ...officer,
            full_name: officer.name, // UI Expects full_name
            member_since: officer.created_at,
            role: officer.role.toLowerCase()
        });
    });
});

app.put('/api/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { full_name, phone } = req.body;

    if (!full_name) {
        return res.status(400).json({ error: "Full name is required." });
    }

    db.run(
        "UPDATE officers SET name = ?, phone = ? WHERE id = ?",
        [full_name, phone, userId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Profile not found or no changes made." });

            logAudit(`Update Profile: ${userId}`, 'security', { full_name, phone }, userId, full_name, req);
            res.json({ success: true, message: "Profile updated successfully.", data: { full_name, phone } });
        }
    );
});

// Delete Loan Product - ADMIN ONLY
app.delete('/api/admin/loan-products/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM loan_products WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(`Delete Loan Product: ${id}`, 'admin', { id });
        res.json({ success: true, message: "Product deleted" });
    });
});

// Backup Database
app.get('/api/admin/backup', authenticateToken, isAdmin, (req, res) => {
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
app.get('/api/admin/export/:table', authenticateToken, isAdmin, (req, res) => {
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
app.get('/api/groups', authenticateToken, (req, res) => {
    const { role, id: officerId } = req.user;
    let query = `
        SELECT g.*, 
               g.meetingDay as meeting_day,
               g.meetingFrequency as meeting_frequency,
               g.registrationDate as registration_date,
               m1.name as chairperson_name, 
               m2.name as secretary_name, 
               m3.name as treasurer_name
        FROM groups g
        LEFT JOIN members m1 ON g.chairperson_id = m1.id
        LEFT JOIN members m2 ON g.secretary_id = m2.id
        LEFT JOIN members m3 ON g.treasurer_id = m3.id
        WHERE 1=1
    `;
    let params = [];

    if (role === 'field officer') {
        query += ` AND g.id IN (SELECT group_id FROM officer_groups WHERE officer_id = ?) `;
        params.push(officerId);
    }

    query += ` ORDER BY g.name`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get single group
app.get('/api/groups/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM groups WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Group not found" });
        res.json(row);
    });
});

// Create new group
app.post('/api/groups', authenticateToken, isAdmin, (req, res) => {
    const {
        name, group_name, location, meetingDay, meeting_day, chairperson, secretary, treasurer,
        chairperson_phone, secretary_phone, treasurer_phone,
        registrationDate, registration_date, meetingFrequency, meeting_frequency,
        dividendPolicy, minMonthlySaving, loanMultiplier, stlInterestRate, ltlInterestRate,
        financial_year
    } = req.body;

    const finalName = name || group_name;
    const finalMeetingDay = meetingDay || meeting_day;
    const finalMeetingFreq = meetingFrequency || meeting_frequency;
    const finalRegDate = registrationDate || registration_date || new Date().toISOString().split('T')[0];
    const finalFinancialYear = financial_year || new Date().getFullYear();

    if (!finalName) return res.status(400).json({ error: "Group name is required." });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Check for duplicate name
        db.get("SELECT id FROM groups WHERE name COLLATE NOCASE = ?", [finalName], (err, row) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }
            if (row) {
                db.run("ROLLBACK");
                return res.status(400).json({ error: `Group '${finalName}' already exists.` });
            }

            // 2. Insert Group
            const groupStmt = db.prepare(`
                INSERT INTO groups (
                    name, location, meetingDay, chairperson, secretary, treasurer,
                    registrationDate, meetingFrequency, dividendPolicy,
                    minMonthlySaving, loanMultiplier, stlInterestRate, ltlInterestRate,
                    financial_year, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `);

            groupStmt.run(
                finalName, location, finalMeetingDay, chairperson, secretary, treasurer,
                finalRegDate, finalMeetingFreq, dividendPolicy || 'Standard Policy',
                minMonthlySaving || 100, loanMultiplier || 3, stlInterestRate || 10, ltlInterestRate || 10,
                finalFinancialYear,
                function (err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    const groupId = this.lastID;

                    // 3. Register officials as members
                    const officialsMap = [
                        { name: chairperson, phone: chairperson_phone, role: 'Chairman' },
                        { name: secretary, phone: secretary_phone, role: 'Secretary' },
                        { name: treasurer, phone: treasurer_phone, role: 'Treasurer' }
                    ];

                    const createdStaffIds = {};
                    let pending = 0;
                    let errorOccurred = false;

                    officialsMap.forEach(off => {
                        if (off.name) pending++;
                    });

                    if (pending === 0) {
                        db.run("COMMIT");
                        logAudit(`Create Group: ${finalName}`, 'admin', { id: groupId, name: finalName });
                        return res.json({ id: groupId, name: finalName, status: 'active', officialsCreated: 0 });
                    }

                    officialsMap.forEach((off, idx) => {
                        if (!off.name) return;

                        db.run(
                            `INSERT INTO members (name, phone, group_id, status, registration_date) VALUES (?, ?, ?, 'active', ?)`,
                            [off.name, off.phone || null, groupId, finalRegDate],
                            function (err) {
                                if (errorOccurred) return;
                                if (err) {
                                    errorOccurred = true;
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ error: `Failed to register ${off.role}: ${err.message}` });
                                }

                                createdStaffIds[off.role] = this.lastID;
                                pending--;

                                if (pending === 0) {
                                    // 4. Update group with member IDs
                                    db.run(
                                        `UPDATE groups SET chairperson_id = ?, secretary_id = ?, treasurer_id = ? WHERE id = ?`,
                                        [createdStaffIds['Chairman'] || null, createdStaffIds['Secretary'] || null, createdStaffIds['Treasurer'] || null, groupId],
                                        (err) => {
                                            if (err) {
                                                db.run("ROLLBACK");
                                                return res.status(500).json({ error: err.message });
                                            }

                                            db.run("COMMIT");
                                            logAudit(`Create Group: ${finalName}`, 'admin', { id: groupId, name: finalName });
                                            logAudit(`Register Officials for ${finalName}`, 'member', { groupId, officials: createdStaffIds });
                                            res.json({ id: groupId, name: finalName, status: 'active', officialsCreated: Object.keys(createdStaffIds).length });
                                        }
                                    );
                                }
                            }
                        );
                    });
                }
            );
            groupStmt.finalize();
        });
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

// Update Group Details
app.put('/api/groups/:id', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { id } = req.params;
    const {
        name, group_name, location, meeting_day, meeting_frequency,
        chairperson, secretary, treasurer,
        chairperson_phone, secretary_phone, treasurer_phone,
        chairperson_id, secretary_id, treasurer_id,
        minMonthlySaving, loanMultiplier, stlInterestRate, ltlInterestRate,
        financial_year, status
    } = req.body;

    const finalName = group_name || name;

    const query = `
        UPDATE groups 
        SET name = COALESCE(?, name),
            location = COALESCE(?, location),
            meetingDay = COALESCE(?, meetingDay),
            meetingFrequency = COALESCE(?, meetingFrequency),
            chairperson = COALESCE(?, chairperson),
            secretary = COALESCE(?, secretary),
            treasurer = COALESCE(?, treasurer),
            chairperson_id = COALESCE(?, chairperson_id),
            secretary_id = COALESCE(?, secretary_id),
            treasurer_id = COALESCE(?, treasurer_id),
            minMonthlySaving = COALESCE(?, minMonthlySaving),
            loanMultiplier = COALESCE(?, loanMultiplier),
            stlInterestRate = COALESCE(?, stlInterestRate),
            ltlInterestRate = COALESCE(?, ltlInterestRate),
            financial_year = COALESCE(?, financial_year),
            dividendPolicy = COALESCE(?, dividendPolicy),
            status = COALESCE(?, status)
        WHERE id = ?
    `;

    db.run(query, [
        finalName, location, meeting_day, meeting_frequency,
        chairperson, secretary, treasurer,
        chairperson_id, secretary_id, treasurer_id,
        minMonthlySaving, loanMultiplier, stlInterestRate, ltlInterestRate,
        financial_year, req.body.dividendPolicy || null, status, id
    ], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Group not found" });

        logAudit(`Update Group: ${finalName || id}`, 'admin', { id, ...req.body });
        res.json({ success: true, message: "Group updated successfully" });
    });
});

// Delete Group (Safe Deletion) - ADMIN ONLY
app.delete('/api/groups/:id', authenticateToken, isAdmin, (req, res) => {
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

// Get members (optionally filter by groupId) - PROTECTED
app.get('/api/members', authenticateToken, (req, res) => {
    const { groupId } = req.query;
    const { role, id: officerId } = req.user;

    let query = `
        SELECT m.*, g.name as group_name,
        (SELECT COALESCE(SUM(principal_amount), 0) FROM loans WHERE (guarantor1_id = m.id OR guarantor2_id = m.id) AND status = 'active') as total_guaranteed_amount,
        (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = m.id) as project_savings_total,
        CASE 
            WHEN m.id = g.chairperson_id THEN 'Chairman'
            WHEN m.id = g.secretary_id THEN 'Secretary'
            WHEN m.id = g.treasurer_id THEN 'Treasurer'
            ELSE 'Member'
        END as group_role
        FROM members m
        LEFT JOIN groups g ON m.group_id = g.id
        WHERE 1=1
    `;
    let params = [];

    // Role-based filtering: Field Officers only see their assigned groups
    if (role === 'Field Officer') {
        query += ` AND m.group_id IN (SELECT group_id FROM officer_groups WHERE officer_id = ?) `;
        params.push(officerId);
    }

    if (groupId) {
        query += " AND m.group_id = ?";
        params.push(groupId);
    }

    query += " ORDER BY m.name";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get Single Member Profile (Enhanced for Smart Workbench)
app.get('/api/members/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { role, id: officerId } = req.user;

    const query = `
        SELECT m.*, g.name as group_name,
        (SELECT COALESCE(SUM(principal_amount), 0) FROM loans WHERE (guarantor1_id = m.id OR guarantor2_id = m.id) AND status = 'active') as total_guaranteed_amount,
        (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = m.id AND pr.project_type = 'EDUCATION') as education_savings,
        (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = m.id AND pr.project_type = 'AGRICULTURE') as agriculture_savings,
        (SELECT COUNT(*) FROM project_registrations WHERE member_id = m.id AND project_type = 'EDUCATION' AND year = strftime('%Y', 'now')) as is_registered_edu,
        (SELECT COUNT(*) FROM project_registrations WHERE member_id = m.id AND project_type = 'AGRICULTURE' AND year = strftime('%Y', 'now')) as is_registered_agri,
        (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id JOIN members m2 ON pr.member_id = m2.id WHERE m2.group_id = m.group_id AND pr.project_type = 'EDUCATION') as group_edu_pool,
        (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id JOIN members m2 ON pr.member_id = m2.id WHERE m2.group_id = m.group_id AND pr.project_type = 'AGRICULTURE') as group_agri_pool,
        (SELECT COALESCE(SUM(financed_amount), 0) FROM product_financing WHERE member_id = m.id AND status = 'ACTIVE') as active_asset_balance,
        (SELECT COALESCE(SUM(fines), 0) - (SELECT COALESCE(SUM(fines), 0) FROM transactions WHERE memberId = m.id AND transaction_type = 'LoanRepayment') FROM transactions WHERE memberId = m.id AND transaction_type = 'Fine') as penalties,
        (SELECT COALESCE(SUM(welfare), 0) FROM transactions WHERE memberId = m.id AND transaction_type = 'Welfare') as welfare_balance,
        (SELECT COALESCE(SUM(t2.welfare), 0) FROM transactions t2 JOIN members m2 ON t2.memberId = m2.id WHERE m2.group_id = m.group_id AND t2.transaction_type = 'Welfare') as group_welfare_pool,
        (SELECT created_at FROM transactions WHERE memberId = m.id AND transaction_type = 'Welfare' ORDER BY created_at DESC LIMIT 1) as last_welfare_date,
        (SELECT score FROM risk_scores WHERE target_id = m.id AND scope = 'MEMBER' ORDER BY calculated_at DESC LIMIT 1) as risk_score,
        CASE 
            WHEN m.id = g.chairperson_id THEN 'Chairman'
            WHEN m.id = g.secretary_id THEN 'Secretary'
            WHEN m.id = g.treasurer_id THEN 'Treasurer'
            ELSE 'Member'
        END as group_role
        FROM members m
        LEFT JOIN groups g ON m.group_id = g.id
        WHERE m.id = ?
    `;

    db.get(query, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Member not found" });

        // Access Control: Field Officer must belong to member's group
        if (role === 'Field Officer') {
            db.get("SELECT 1 FROM officer_groups WHERE officer_id = ? AND group_id = ?", [officerId, row.group_id], (err, allowed) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!allowed) return res.status(403).json({ error: "Access denied: You are not assigned to this member's group" });
                res.json(row);
            });
        } else {
            res.json(row);
        }
    });
});

// Create new member (WITH OPENING BALANCE RULES)
app.post('/api/members', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const {
        name, full_name, phone, groupId, group_id,
        opening_balance_savings = 0,
        opening_balance_ltl = 0,
        opening_balance_stl = 0,
        opening_balance_reason,
        userId // Who is creating this member (for audit)
    } = req.body;

    const finalName = name || full_name;
    const finalGroupId = groupId || group_id;

    // Validation: Opening balance reason required if any opening balance > 0
    const hasOpeningBalance = opening_balance_savings > 0 || opening_balance_ltl > 0 || opening_balance_stl > 0;
    if (hasOpeningBalance && !opening_balance_reason) {
        return res.status(400).json({ error: 'Opening balance reason is required when setting opening balances' });
    }

    // Validation: Check for duplicate Name OR Phone
    db.get("SELECT id, name, phone, group_id FROM members WHERE name COLLATE NOCASE = ? OR phone = ?", [finalName, phone], (err, existing) => {
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
            opening_balance_set_by, opening_balance_set_at, opening_balance_reason, opening_balance_locked,
            next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, next_of_kin_member_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        const now = new Date().toISOString();
        const locked = hasOpeningBalance ? 1 : 0; // Lock if opening balance is set

        stmt.run(
            finalName, phone, finalGroupId,
            opening_balance_savings, opening_balance_ltl, opening_balance_stl,
            userId || 1, now, opening_balance_reason || 'New member', locked,
            req.body.next_of_kin_name || null,
            req.body.next_of_kin_phone || null,
            req.body.next_of_kin_relationship || null,
            req.body.next_of_kin_member_id || null,
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                logAudit(`Register Member: ${finalName}`, 'member', { id: this.lastID, name: finalName, groupId: finalGroupId });
                res.json({
                    id: this.lastID,
                    name: finalName, phone,
                    group_id: finalGroupId,
                    status: 'active',
                    opening_balance_savings,
                    opening_balance_ltl,
                    opening_balance_stl,
                    opening_balance_locked: locked,
                    registration_date: now,
                    next_of_kin_name: req.body.next_of_kin_name || null,
                    next_of_kin_phone: req.body.next_of_kin_phone || null,
                    next_of_kin_relationship: req.body.next_of_kin_relationship || null
                });
            }
        );
        stmt.finalize();
    });
});

// Update Member Profile
app.put('/api/members/:id', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { id } = req.params;
    const { name, phone, groupId, status, next_of_kin_name, next_of_kin_phone, next_of_kin_relationship } = req.body;

    const stmt = db.prepare(`
        UPDATE members 
        SET name = COALESCE(?, name), 
            phone = COALESCE(?, phone), 
            group_id = COALESCE(?, group_id), 
            status = COALESCE(?, status),
            next_of_kin_name = COALESCE(?, next_of_kin_name),
            next_of_kin_phone = COALESCE(?, next_of_kin_phone),
            next_of_kin_relationship = COALESCE(?, next_of_kin_relationship)
        WHERE id = ?
    `);

    stmt.run(name, phone, groupId, status, next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Member not found' });

        res.json({ id, name, phone, groupId, status, message: 'Member updated successfully' });
    });
    stmt.finalize();
});

// Delete Member (Safe Deletion) - ADMIN ONLY
app.get('/api/admin/check-member-safety/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;

    // Check for active loans or high savings
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM loans WHERE member_id = ? AND status = 'active') as active_loans,
            (SELECT current_savings FROM members WHERE id = ?) as current_savings
        FROM members WHERE id = ?
    `, [id, id, id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Member not found" });

        res.json({
            isSafe: row.active_loans === 0 && (row.current_savings || 0) <= 0,
            activeLoans: row.active_loans,
            currentSavings: row.current_savings || 0
        });
    });
});

app.delete('/api/members/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;

    // Check for active loans OR transactions before hard delete
    db.get("SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND status = 'active'", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count > 0) {
            return res.status(400).json({ error: `Cannot delete member: They still have ${row.count} active loans.` });
        }

        // Hard delete member (soft delete would be better, but system seems to use hard delete for groups)
        db.run("DELETE FROM members WHERE id = ?", [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Member not found" });

            logAudit(`Delete Member ID: ${id}`, 'admin', { memberId: id });
            res.json({ success: true, message: "Member record removed from system" });
        });
    });
});

// ==========================================
// REPORTS & ANALYTICS API
// ==========================================

// Officer Performance Scorecard
app.get('/api/reports/officer-performance', authenticateToken, isAdmin, (req, res) => {
    const query = `
        SELECT 
            o.id, o.name, o.role, o.status,
            COUNT(r.id) as reports_filed,
            COALESCE(SUM(r.total_cash_in), 0) as total_collected,
            COALESCE(SUM(CASE WHEN r.variance != 0 THEN 1 ELSE 0 END), 0) as variance_issues,
            MAX(r.report_date) as last_active
        FROM officers o
        LEFT JOIN daily_cash_reports r ON o.id = r.officer_id AND r.status = 'submitted'
        WHERE o.role != 'Admin' 
        GROUP BY o.id
        ORDER BY total_collected DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Calculate Efficiency Score (Example: 100 - (VarianceIssues * 5))
        const scorecard = rows.map(row => ({
            ...row,
            efficiency_score: Math.max(0, 100 - (row.variance_issues * 10)) // Penalize 10 points per variance
        }));

        res.json(scorecard);
    });
});

// ==========================================
// SESSIONS API (MEETING MANAGEMENT)
// ==========================================

// Get all sessions
app.get('/api/sessions', (req, res) => {
    const query = `
        SELECT s.*, g.name as group_name 
        FROM meeting_sessions s
        LEFT JOIN groups g ON s.groupId = g.id
        ORDER BY s.date DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Parse JSON fields and Normalize for Frontend
        const sessions = rows.map(row => ({
            ...row,
            meeting_date: row.date, // Map 'date' to 'meeting_date' for UI
            session_number: `MTG-${row.id.toString().padStart(3, '0')}`,
            members_present: row.members_present || 0,
            members_absent: row.members_absent || 0,
            total_collected: row.total_collected || 0,
            attendance_percentage: row.members_present ? (row.members_present / (row.members_present + (row.members_absent || 0)) * 100) : 0,
            totals: row.totals ? JSON.parse(row.totals) : null,
            reversalMetadata: row.reversalMetadata ? JSON.parse(row.reversalMetadata) : null
        }));
        res.json(sessions);
    });
});

// ==========================================
// 🏛️ CASH CONTROL & RECONCILIATION API (BANK-GRADE)
// ==========================================

// Open a new Cash Session
app.post('/api/cash-sessions/open', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    const { groupId, date } = req.body;
    const officerId = req.user.id || 1;

    try {
        const result = await CashControlService.openSession(groupId, officerId, date);
        res.json(result);
    } catch (err) {
        res.status(400).json({
            error: "Institutional Guard: Session Error",
            message: err.message,
            action: "Ensure all previous sessions for this group are LOCKED."
        });
    }
});

// Get session context (Reconciliation View)
app.get('/api/cash-sessions/:id/context', authenticateToken, async (req, res) => {
    try {
        const session = await CashControlService.getInternal(`
            SELECT s.*, g.name as group_name, o.name as officer_name 
            FROM cash_sessions s 
            JOIN groups g ON s.group_id = g.id 
            JOIN officers o ON s.reported_by = o.id 
            WHERE s.id = ?
        `, [req.params.id]);

        if (!session) return res.status(404).json({ error: "Session not found" });

        const transactions = await CashControlService.getInternal(`
            SELECT 
                SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END) as total_in,
                SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END) as total_out
            FROM cash_transactions 
            WHERE cash_session_id = ?
        `, [req.params.id]);

        const ledger = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM cash_transactions WHERE cash_session_id = ? ORDER BY created_at ASC`, [req.params.id], (err, rows) => {
                err ? reject(err) : resolve(rows);
            });
        });

        res.json({
            session,
            summary: {
                total_in: transactions.total_in || 0,
                total_out: transactions.total_out || 0,
                expected_closing: session.opening_balance + (transactions.total_in || 0) - (transactions.total_out || 0)
            },
            ledger
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Open New Cash Session (Step 1)
app.post('/api/cash-sessions/open', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    const { groupId, date } = req.body;
    const officerId = req.user.id;

    if (!groupId || !date) {
        return res.status(400).json({ error: "Group ID and Date are required" });
    }

    try {
        const session = await CashControlService.openSession(groupId, officerId, date);
        res.json(session);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Verify and Lock Session (The 5-Step Flow)
app.patch('/api/cash-sessions/:id/verify', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    const { physical_cash_count, explanation } = req.body;
    const officerId = req.user.id || 1;

    try {
        const result = await CashControlService.verifyAndLock(req.params.id, physical_cash_count, explanation, officerId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get Latest Session for Group (Direct Access)
app.get('/api/cash-sessions/latest/:groupId', authenticateToken, async (req, res) => {
    try {
        const session = await CashControlService.getInternal(
            `SELECT * FROM cash_sessions WHERE group_id = ? ORDER BY meeting_date DESC LIMIT 1`,
            [req.params.groupId]
        );
        res.json(session || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Get all daily reports
app.get('/api/daily-reports', authenticateToken, (req, res) => {
    const { groupId, officerId, date } = req.query;
    let query = "SELECT r.*, g.name as group_name, o.name as officer_name FROM daily_cash_reports r JOIN groups g ON r.group_id = g.id JOIN officers o ON r.officer_id = o.id WHERE 1=1";
    let params = [];

    if (groupId) { query += " AND r.group_id = ?"; params.push(groupId); }
    if (officerId) { query += " AND r.officer_id = ?"; params.push(officerId); }
    if (date) { query += " AND r.report_date = ?"; params.push(date); }

    query += " ORDER BY r.report_date DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get report context (Automated Aggregation)
app.get('/api/daily-reports/context/:groupId/:date', authenticateToken, async (req, res) => {
    const { groupId, date } = req.params;

    try {
        const getRow = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        });

        const getAll = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });

        // 1. Get Opening Balance (Closing from last submitted report)
        const lastReport = await getRow(
            "SELECT expected_closing_balance FROM daily_cash_reports WHERE group_id = ? AND status = 'submitted' AND report_date < ? ORDER BY report_date DESC LIMIT 1",
            [groupId, date]
        );
        const openingBalance = lastReport?.expected_closing_balance || 0;

        // 2. Aggregate Transactions for this date and group
        // We link transactions to groups via members
        const transactions = await getAll(`
            SELECT 
                t.transaction_type,
                SUM(t.savings_amount) as savings,
                SUM(t.stl_repayment + t.ltl_repayment + t.loan_interest + t.loan_principal) as repayments,
                SUM(t.fines) as fines,
                SUM(t.welfare) as welfare,
                SUM(t.project) as projects,
                SUM(t.withdrawals) as withdrawals,
                SUM(t.loans_issued) as disbursements
            FROM transactions t
            JOIN members m ON t.memberId = m.id
            WHERE m.group_id = ? AND date(t.created_at) = date(?)
            GROUP BY t.transaction_type
        `, [groupId, date]);

        // 3. Get Session Info
        const session = await getRow(
            "SELECT id, status FROM meeting_sessions WHERE groupId = ? AND date(date) = date(?) LIMIT 1",
            [groupId, date]
        );

        // Group into Inflows and Outflows
        const summary = {
            opening_balance: openingBalance,
            session_id: session?.id || null,
            session_status: session?.status || 'N/A',
            inflows: {
                savings: 0,
                repayments: 0,
                fines: 0,
                welfare: 0,
                projects: 0,
                total: 0
            },
            outflows: {
                withdrawals: 0,
                disbursements: 0,
                total: 0
            }
        };

        transactions.forEach(tx => {
            summary.inflows.savings += tx.savings || 0;
            summary.inflows.repayments += tx.repayments || 0;
            summary.inflows.fines += tx.fines || 0;
            summary.inflows.welfare += tx.welfare || 0;
            summary.inflows.projects += tx.projects || 0;

            summary.outflows.withdrawals += tx.withdrawals || 0;
            summary.outflows.disbursements += tx.disbursements || 0;
        });

        summary.inflows.total = summary.inflows.savings + summary.inflows.repayments + summary.inflows.fines + summary.inflows.welfare + summary.inflows.projects;
        summary.outflows.total = summary.outflows.withdrawals + summary.outflows.disbursements;
        summary.expected_closing = summary.opening_balance + summary.inflows.total - summary.outflows.total;

        res.json(summary);
    } catch (err) {
        console.error("Report Context Error:", err);
        res.status(500).json({ error: "Failed to aggregate report data" });
    }
});

// Get single daily report
app.get('/api/daily-reports/:id', authenticateToken, (req, res) => {
    const query = "SELECT r.*, g.name as group_name, o.name as officer_name FROM daily_cash_reports r JOIN groups g ON r.group_id = g.id JOIN officers o ON r.officer_id = o.id WHERE r.id = ?";
    db.get(query, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Report not found" });
        res.json(row);
    });
});

// Save or Update Daily Report
app.post('/api/daily-reports', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const {
        id, officer_id, group_id, session_id, report_date,
        morning_balance, total_cash_in, total_cash_out,
        expected_closing_balance, physical_cash_counted, variance, status,
        transactions // Array of member transactions
    } = req.body;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const finalizeReport = (reportId) => {
            // Process Transactions if provided and report is being submitted or just saved?
            // Strategy: We only persist transactions when status is 'submitted' to avoid "partial" ledger entries
            // OR we save them to a temp table?
            // BETTER STRATEGY: We delete existing transactions for this report/session and re-insert them to support "draft" editing.
            // BUT transactions table is the source of truth.
            // DECISION: Transactions are only written to the main `transactions` table when the report is SUBMITTED.
            // DRAFTS only save the `sessionData` JSON blob in the report table? 
            // We don't have a JSON column, we rely on SQLite text.

            // For now, let's update the report status.
            // If the frontend sends 'submitted', we process transactions.

            db.run("COMMIT", (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, id: reportId });
            });
        };

        const handleDraft = (reportId) => {
            // If we want to save draft data, we might need a 'data' column in daily_cash_reports.
            // Since we didn't add one, we will just save the summary for now.
            // TODO: Add 'draft_data' column to daily_cash_reports for full session restore.
            db.run("COMMIT", (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, id: reportId });
            });
        };

        if (id) {
            // Update existing
            const query = `
                UPDATE daily_cash_reports SET 
                    morning_balance = ?, total_cash_in = ?, total_cash_out = ?,
                    expected_closing_balance = ?, physical_cash_counted = ?,
                    variance = ?, status = ?, officer_declaration = ?,
                    ip_address = ?, submission_timestamp = ?
                WHERE id = ? AND status = 'draft'
            `;
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const now = new Date().toISOString();

            db.run(query, [
                morning_balance, total_cash_in, total_cash_out,
                expected_closing_balance, physical_cash_counted,
                variance, status || 'draft', req.body.officer_declaration ? 1 : 0,
                ip, status === 'submitted' ? now : null, id
            ], function (err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                if (this.changes === 0) { db.run("ROLLBACK"); return res.status(403).json({ error: "Cannot update a submitted report." }); }

                if (status === 'submitted' && transactions) {
                    processTransactions(id, group_id, report_date, transactions, res);
                } else {
                    handleDraft(id);
                }
            });
        } else {
            // Insert new
            const query = `
                INSERT INTO daily_cash_reports (
                    officer_id, group_id, session_id, report_date,
                    morning_balance, total_cash_in, total_cash_out,
                    expected_closing_balance, physical_cash_counted, variance, 
                    status, officer_declaration, ip_address, submission_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const now = new Date().toISOString();

            db.run(query, [
                officer_id, group_id, session_id, report_date,
                morning_balance, total_cash_in, total_cash_out,
                expected_closing_balance, physical_cash_counted, variance,
                status || 'draft', req.body.officer_declaration ? 1 : 0,
                ip, status === 'submitted' ? now : null
            ], function (err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                const newId = this.lastID;

                if (status === 'submitted' && transactions) {
                    processTransactions(newId, group_id, report_date, transactions, res);
                } else {
                    handleDraft(newId);
                }
            });
        }
    });
});

// Helper to process transactions on submit
const processTransactions = (reportId, groupId, date, transactions, res) => {
    // 1. Create a Meeting Session if not exists (or use passed session_id)
    // For simplicity, we create a specialized "Daily Report Session"

    // We need to iterate and insert.
    const stmt = db.prepare(`
        INSERT INTO transactions (
            sessionId, memberId, transaction_type, description, 
            savings_amount, stl_repayment, ltl_repayment, loan_interest, 
            loan_principal, welfare, project, fines, withdrawals, loans_issued, status, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
    `);

    // We need a dummy session ID or link it to report.
    // Let's assume passed session_id is null for now and we rely on date/group.
    // We should probably create a session entry first.
    // For this implementation, we will use '0' or a placeholder if no session logic exists yet.
    // But we should try to link it properly.

    let processed = 0;

    transactions.forEach(t => {
        // Only insert if there's activity
        if (
            t.savings_amount > 0 || t.stl_repayment > 0 || t.ltl_repayment > 0 ||
            t.welfare > 0 || t.withdrawals > 0 || t.loans_issued > 0
        ) {
            stmt.run(
                reportId, // Using ReportID as SessionID proxy for now
                t.member_id,
                'DAILY_REPORT',
                `Daily Report Transaction`,
                t.savings_amount || 0,
                t.stl_repayment || 0,
                t.ltl_repayment || 0,
                t.loan_interest || 0,
                t.loan_principal || 0,
                t.welfare || 0,
                t.project || 0,
                t.fines || 0,
                t.withdrawals || 0,
                t.loans_issued || 0,
                date,
                (err) => {
                    if (err) console.error("Transaction Insert Error", err);
                }
            );

            // UPDATE MEMBER BALANCES
            if (t.savings_amount) db.run("UPDATE members SET current_savings = current_savings + ? WHERE id = ?", [t.savings_amount, t.member_id]);
            if (t.withdrawals) db.run("UPDATE members SET current_savings = current_savings - ? WHERE id = ?", [t.withdrawals, t.member_id]);
            if (t.loans_issued) db.run("UPDATE members SET active_loan_balance = active_loan_balance + ? WHERE id = ?", [t.loans_issued, t.member_id]);
            const totalRepayment = (Number(t.stl_repayment) || 0) + (Number(t.ltl_repayment) || 0) + (Number(t.loan_principal) || 0) + (Number(t.loan_interest) || 0);
            if (totalRepayment > 0) db.run("UPDATE members SET active_loan_balance = active_loan_balance - ? WHERE id = ?", [totalRepayment, t.member_id]);
            if (t.project) db.run("UPDATE members SET project_balance = project_balance + ? WHERE id = ?", [t.project, t.member_id]);
        }
        processed++;
    });

    stmt.finalize();
    db.run("COMMIT", (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: reportId, message: "Report and Transactions Processed" });
    });
};

// Submit Daily Report (Finalize)
app.patch('/api/daily-reports/:id/submit', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { id } = req.params;
    const { officer_declaration } = req.body;

    if (officer_declaration !== true && officer_declaration !== 1) {
        return res.status(400).json({ error: "Officer declaration is mandatory for submission." });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = new Date().toISOString();

    db.run(
        "UPDATE daily_cash_reports SET status = 'submitted', officer_declaration = 1, ip_address = ?, submission_timestamp = ? WHERE id = ? AND status = 'draft'",
        [ip, now, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(403).json({ error: "Report already submitted or not found." });
            logAudit(`Submit Daily Cash Report: ${id}`, 'transaction', { reportId: id, ip });
            res.json({ success: true, message: "Report submitted successfully and locked." });
        }
    );
});



// 📊 MONTHLY REPORTS API
app.get('/api/monthly-reports', authenticateToken, (req, res) => {
    const { groupId, month, year } = req.query;
    let query = "SELECT m.*, g.name as group_name FROM monthly_cash_reports m JOIN groups g ON m.group_id = g.id WHERE 1=1";
    let params = [];

    if (groupId) { query += " AND m.group_id = ?"; params.push(groupId); }
    if (month) { query += " AND m.month = ?"; params.push(month); }
    if (year) { query += " AND m.year = ?"; params.push(year); }

    query += " ORDER BY m.year DESC, m.month DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/monthly-reports/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.get("SELECT m.*, g.name as group_name FROM monthly_cash_reports m JOIN groups g ON m.group_id = g.id WHERE m.id = ?", [id], (err, report) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!report) return res.status(404).json({ error: "Monthly report not found" });

        // Fetch underlying daily sessions for drill-down
        const dailyQuery = `
            SELECT id, meeting_date, opening_balance, expected_closing_balance, physical_cash_count, variance, status
            FROM cash_sessions
            WHERE group_id = ? 
            AND strftime('%m', meeting_date) = ? 
            AND strftime('%Y', meeting_date) = ?
            AND status = 'LOCKED'
            ORDER BY meeting_date ASC
        `;
        const monthStr = report.month.toString().padStart(2, '0');
        db.all(dailyQuery, [report.group_id, monthStr, report.year.toString()], (err, sessions) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...report, daily_sessions: sessions });
        });
    });
});


// ==========================================
// 🛡️ CASH CONTROL AUTOMATION HELPERS
// ==========================================

const autoLogToCashControl = async (groupId, source, amount, direction, referenceId, userId) => {
    try {
        // Find if there is an OPEN cash session for today/this group
        const date = new Date().toISOString().split('T')[0];
        const session = await CashControlService.getInternal(
            "SELECT id FROM cash_sessions WHERE group_id = ? AND status = 'OPEN' AND meeting_date = ?",
            [groupId, date]
        );

        if (session) {
            await CashControlService.logRecord({
                sessionId: session.id,
                source,
                amount,
                direction,
                referenceId,
                createdBy: userId || 1
            });
            console.log(`Auto-Log Success: ${source} -> Session ${session.id}`);
        }
    } catch (err) {
        console.error("Auto-Log Failed:", err.message);
    }
};

// ==========================================
// UNIFIED TRANSACTION API
// ==========================================

// Create/Record a Transaction (Generic Hub)
app.post('/api/transactions', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    const {
        type, transaction_type,
        memberId, sessionId,
        amount, description,
        loanId, loanType, breakdown
    } = req.body;

    const finalType = (type || transaction_type || '').toLowerCase();

    // 🛡️ RISK GUARD: Anti-Fraud Duplicate Check
    if (sessionId) {
        const isDuplicate = await RiskService.checkDuplicateTransaction(sessionId, memberId, amount, finalType);
        if (isDuplicate) {
            return res.status(429).json({ error: "DUPLICATE TRANSACTION: An identical record exists for this session." });
        }
    }

    if (!memberId || !amount) {
        return res.status(400).json({ error: "Member ID and Amount are required." });
    }

    // 🏛️ Get member context early for Cash Control & Liquidity
    const member = await CashControlService.getInternal("SELECT group_id FROM members WHERE id = ?", [memberId]);
    const groupId = member?.group_id;

    // 🛡️ INSTITUTIONAL LIQUIDITY GUARD (Outflows only)
    if (groupId && finalType === 'withdrawal') {
        try {
            await CashControlService.validateLiquidity(groupId, amount);
        } catch (e) {
            return res.status(400).json({ error: e.message });
        }
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        if (finalType === 'loanrepayment' || finalType === 'loan_repayment') {
            // Handle Loan Repayment with Strict Hierarchy: 1. Penalties -> 2. Interest -> 3. Principal
            if (!loanId) {
                db.run("ROLLBACK");
                return res.status(400).json({ error: "Loan ID is required for repayment." });
            }

            const desc = description || `Repayment for Loan #${loanId}`;
            const penalty_paid = breakdown?.penalty || 0;
            const interest_paid = breakdown?.interest || 0;
            const principal_paid = breakdown?.principal || (amount - penalty_paid - interest_paid);

            const stmt = db.prepare(`
                INSERT INTO transactions (
                    sessionId, memberId, stl_repayment, ltl_repayment, loan_interest, fines, description, transaction_type, uploaded, attended, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'LoanRepayment', 1, 1, 'PENDING')
            `);

            const stl_amt = (loanType === 'STL' || !loanType) ? principal_paid : 0;
            const ltl_amt = (loanType === 'LTL') ? principal_paid : 0;

            stmt.run(sessionId || null, memberId, stl_amt, ltl_amt, interest_paid, penalty_paid, desc, function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                const transId = this.lastID;

                // Decrease Loan Balance + Reduce Risk (Master Guideline: On-time Repayment -10)
                db.get("SELECT active_loan_balance FROM members WHERE id = ?", [memberId], (err, row) => {
                    const isClearance = (row?.active_loan_balance || 0) <= amount;
                    const riskReduction = isClearance ? 20 : 10;

                    db.run("UPDATE members SET active_loan_balance = MAX(0, active_loan_balance - ?), risk_score = MAX(0, risk_score - ?) WHERE id = ?",
                        [amount, riskReduction, memberId], async (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                if (!res.headersSent) return res.status(500).json({ error: err.message });
                                return;
                            }
                            db.run("COMMIT");
                            logAudit(`Repayment Received`, 'transaction', { memberId, amount, loanId });

                            const smsMsg = `UKOMBOZI: Repayment of KES ${Number(amount).toLocaleString()} confirmed. Order: Penalties -> Int -> Principal. Ref: ${transId}`;
                            await logAndSendSMS(memberId, smsMsg, 'LOAN_REPAYMENT', transId);

                            if (!res.headersSent) res.json({ success: true, message: "Repayment recorded with strict hierarchy.", transaction_id: transId });

                            if (groupId) {
                                autoLogToCashControl(groupId, 'LOAN_REPAYMENT', amount, 'IN', transId, req.user?.id);
                            }
                        });
                });
                stmt.finalize();
            });

        } else if (finalType === 'savings') {
            // Handle Savings
            const stmt = db.prepare(`
                INSERT INTO transactions (
                    sessionId, memberId, savings_amount, transaction_type, description, uploaded, attended, status
                ) VALUES (?, ?, ?, 'Contribution', ?, 1, 1, 'PENDING')
            `);

            stmt.run(sessionId || null, memberId, amount, description || 'Savings Deposit', async function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                const transId = this.lastID;

                // Increase Savings + Reduce Risk
                db.run("UPDATE members SET current_savings = current_savings + ?, risk_score = MAX(0, risk_score - 1) WHERE id = ?", [amount, memberId], async (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        if (!res.headersSent) return res.status(500).json({ error: err.message });
                        return;
                    }
                    db.run("COMMIT");
                    logAudit(`Savings Deposit`, 'transaction', { memberId, amount }, req.user?.id);

                    const smsMsg = `UKOMBOZI: Savings Deposit Received KES ${Number(amount).toLocaleString()}. Net Position Improved. Ref: ${transId}.`;
                    await logAndSendSMS(memberId, smsMsg, 'CONTRIBUTION', transId);

                    if (!res.headersSent) res.json({ success: true, message: "Savings recorded. Risk reduced.", transaction_id: transId });

                    if (groupId) {
                        autoLogToCashControl(groupId, 'CONTRIBUTION', amount, 'IN', transId, req.user?.id);
                    }
                });
            });
            stmt.finalize();

        } else if (finalType === 'productfinancing') {
            // Handle Asset Financing
            const { productName, totalValue, commitmentPaid } = req.body;
            const financedAmount = (totalValue || amount) - (commitmentPaid || 0);

            db.run(`INSERT INTO product_financing (member_id, product_name, total_value, commitment_paid, financed_amount, status) 
                VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
                [memberId, productName || description, totalValue || amount, commitmentPaid || 0, financedAmount],
                function (err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    const assetId = this.lastID;

                    const stmt = db.prepare(`
                        INSERT INTO transactions (
                            sessionId, memberId, withdrawals, transaction_type, description, uploaded, attended, status
                        ) VALUES (?, ?, ?, 'AssetFinancing', ?, 1, 1, 'COMPLETED')
                    `);

                    stmt.run(sessionId || null, memberId, amount, description || `Product: ${productName}`, async function (err) {
                        if (err) {
                            db.run("ROLLBACK");
                            if (!res.headersSent) return res.status(500).json({ error: err.message });
                            return;
                        }
                        const transId = this.lastID;

                        // Increase Risk for new Asset Asset/Liability (Guide: +5)
                        db.run("UPDATE members SET risk_score = MIN(100, risk_score + 5) WHERE id = ?", [memberId], (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                if (!res.headersSent) return res.status(500).json({ error: err.message });
                                return;
                            }
                            db.run("COMMIT");
                            logAudit(`Asset Financed`, 'transaction', { memberId, assetId, amount });
                            if (!res.headersSent) res.json({ success: true, message: "Asset financing recorded.", transaction_id: transId });
                        });
                    });
                    stmt.finalize();
                }
            );

        } else if (finalType === 'penalty' || finalType === 'fine') {
            const stmt = db.prepare(`
                INSERT INTO transactions (
                    sessionId, memberId, fines, transaction_type, description, uploaded, attended, status
                ) VALUES (?, ?, ?, 'Fine', ?, 1, 1, 'COMPLETED')
            `);

            stmt.run(sessionId || null, memberId, amount, description || 'Member Fine / Penalty', function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                const transId = this.lastID;

                db.run("UPDATE members SET risk_score = MIN(100, risk_score + 10) WHERE id = ?", [memberId], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        if (!res.headersSent) return res.status(500).json({ error: err.message });
                        return;
                    }
                    db.run("COMMIT");
                    logAudit(`Penalty Issued`, 'transaction', { memberId, amount }, req.user?.id);
                    if (!res.headersSent) res.json({ success: true, message: "Penalty recorded. Risk increased.", transaction_id: transId });
                    if (groupId) {
                        autoLogToCashControl(groupId, 'PENALTY', amount, 'IN', transId, req.user?.id);
                    }
                });
            });
            stmt.finalize();

        } else if (finalType === 'welfare') {
            const stmt = db.prepare(`
                INSERT INTO transactions (
                    sessionId, memberId, welfare, transaction_type, description, uploaded, attended, status
                ) VALUES (?, ?, ?, 'Welfare', ?, 1, 1, 'COMPLETED')
            `);

            stmt.run(sessionId || null, memberId, amount, description || 'Welfare Contribution', function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }
                const transId = this.lastID;
                db.run("COMMIT");
                logAudit(`Welfare Contribution`, 'transaction', { memberId, amount }, req.user?.id);
                if (!res.headersSent) res.json({ success: true, message: "Welfare recorded successfully.", transaction_id: transId });
                if (groupId) {
                    autoLogToCashControl(groupId, 'WELFARE', amount, 'IN', transId, req.user?.id);
                }
            });
            stmt.finalize();

        } else if (['education', 'agriculture', 'projectsaving'].includes(finalType)) {
            const projectType = (finalType === 'projectsaving' || finalType === 'education') ? 'EDUCATION' : 'AGRICULTURE';
            const saveMonth = new Date().getMonth() + 1;
            const isAdmin = req.user?.role?.toLowerCase() === 'admin' || req.user?.role?.toLowerCase() === 'director';

            if (saveMonth > 8 && !isAdmin) {
                db.run("ROLLBACK");
                return res.status(403).json({ error: 'Savings period closed (Jan-Aug only). Admin bypass required.' });
            }

            const proceedWithSavings = (registration_id) => {
                const formattedDate = new Date().toISOString().split('T')[0];
                const savingsQuery = `SELECT COALESCE(SUM(savings_amount), 0) as total_savings FROM transactions WHERE memberId = ? AND date(created_at) = date(?)`;

                db.get(savingsQuery, [memberId, formattedDate], (err, sRow) => {
                    if (err) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: err.message }); return; }
                    const todayTableSavings = sRow?.total_savings || 0;

                    const proQuery = `SELECT COALESCE(SUM(ps.amount), 0) as total_pro FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = ? AND date(ps.date) = date(?)`;
                    db.get(proQuery, [memberId, formattedDate], (err, pRow) => {
                        if (err) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: err.message }); return; }
                        const todayExistingProjectSavings = pRow?.total_pro || 0;

                        if ((todayExistingProjectSavings + amount) > todayTableSavings && !isAdmin) {
                            db.run("ROLLBACK");
                            if (!res.headersSent) return res.status(400).json({ error: `1:1 Rule Violation: Project savings (${todayExistingProjectSavings + amount}) cannot exceed today's table savings (${todayTableSavings}).` });
                            return;
                        }

                        db.get("SELECT COALESCE(SUM(amount), 0) as total_saved FROM project_savings WHERE registration_id = ?", [registration_id], (err, cRow) => {
                            if (err) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: err.message }); return; }
                            if ((cRow.total_saved + amount) > 2000 && !isAdmin) {
                                db.run("ROLLBACK");
                                if (!res.headersSent) return res.status(400).json({ error: "Project limit reached (Max KES 2,000 per year). Admin bypass required." });
                                return;
                            }

                            db.run("INSERT INTO project_savings (registration_id, amount, date) VALUES (?, ?, ?)", [registration_id, amount, formattedDate], function (err) {
                                if (err) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: err.message }); return; }

                                const txStmt = db.prepare(`INSERT INTO transactions (sessionId, memberId, savings_amount, transaction_type, description, uploaded, attended, status) VALUES (?, ?, ?, 'ProjectSaving', ?, 1, 1, 'COMPLETED')`);
                                txStmt.run(sessionId || null, memberId, amount, description || `Project Savings: ${projectType}`, async function (txErr) {
                                    if (txErr) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: txErr.message }); return; }
                                    const transId = this.lastID;

                                    db.run("UPDATE members SET risk_score = MAX(0, risk_score - 5) WHERE id = ?", [memberId], async (riskErr) => {
                                        if (riskErr) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: riskErr.message }); return; }
                                        db.run("COMMIT");
                                        logAudit(`Project Savings`, 'member', { memberId, amount, project: projectType }, req.user?.id);
                                        const smsMsg = `UKOMBOZI: Project Savings for ${projectType} confirmed KES ${amount}. Ref: ${transId}.`;
                                        await logAndSendSMS(memberId, smsMsg, 'FINANCIAL', transId);
                                        if (!res.headersSent) res.json({ success: true, message: "Project savings recorded successfully.", transaction_id: transId });
                                        if (groupId) autoLogToCashControl(groupId, 'PROJECT_SAVING', amount, 'IN', transId, req.user?.id);
                                    });
                                });
                                txStmt.finalize();
                            });
                        });
                    });
                });
            };

            db.get("SELECT id FROM project_registrations WHERE member_id = ? AND project_type = ? AND year = ?",
                [memberId, projectType, new Date().getFullYear()],
                (err, reg) => {
                    if (err || !reg) {
                        if (isAdmin) {
                            // Auto-register for Admin (Simple Insert, no fee needed for bypass)
                            db.run("INSERT INTO project_registrations (member_id, project_type, year) VALUES (?, ?, ?)",
                                [memberId, projectType, new Date().getFullYear()],
                                function (insertErr) {
                                    if (insertErr) { db.run("ROLLBACK"); return res.status(500).json({ error: insertErr.message }); }
                                    proceedWithSavings(this.lastID);
                                }
                            );
                        } else {
                            db.run("ROLLBACK");
                            if (!res.headersSent) return res.status(404).json({ error: `Member not registered for ${projectType} project this year.` });
                            return;
                        }
                    } else {
                        proceedWithSavings(reg.id);
                    }
                }
            );

        } else if (finalType === 'withdrawal') {
            db.get("SELECT current_savings, group_id FROM members WHERE id = ?", [memberId], (err, mRow) => {
                if (err || !mRow) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(404).json({ error: "Member not found." }); return; }

                if (mRow.current_savings < amount) {
                    db.run("ROLLBACK");
                    if (!res.headersSent) return res.status(400).json({ error: "Insufficient Savings for this withdrawal." });
                    return;
                }

                const liquidityQuery = `SELECT (SELECT COALESCE(SUM(current_savings), 0) FROM members WHERE group_id = ?) as total_savings, (SELECT COALESCE(SUM(active_loan_balance), 0) FROM members WHERE group_id = ?) as total_loans`;
                db.get(liquidityQuery, [mRow.group_id, mRow.group_id], (err, stats) => {
                    if (err) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: err.message }); return; }
                    const liquidity = stats.total_savings - stats.total_loans;
                    if (liquidity < amount) {
                        db.run("ROLLBACK");
                        if (!res.headersSent) return res.status(403).json({ error: "Vault Liquidity Breach: Group cash reserve insufficient." });
                        return;
                    }

                    const stmt = db.prepare(`INSERT INTO transactions (sessionId, memberId, withdrawals, transaction_type, description, status, uploaded, attended) VALUES (?, ?, ?, 'Withdrawal', ?, 'COMPLETED', 1, 1)`);
                    stmt.run(sessionId || null, memberId, amount, description || 'Cash Withdrawal', function (err) {
                        if (err) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: err.message }); return; }
                        const transId = this.lastID;

                        db.run("UPDATE members SET current_savings = MAX(0, current_savings - ?), risk_score = MIN(100, risk_score + 2) WHERE id = ?", [amount, memberId], async (err) => {
                            if (err) { db.run("ROLLBACK"); if (!res.headersSent) return res.status(500).json({ error: err.message }); return; }
                            db.run("COMMIT");
                            logAudit(`Withdrawal Approved`, 'transaction', { memberId, amount }, req.user?.id);
                            if (mRow.group_id) autoLogToCashControl(mRow.group_id, 'WITHDRAWAL', amount, 'OUT', transId, req.user?.id);
                            if (!res.headersSent) res.json({ success: true, message: "Withdrawal approved and processed.", transaction_id: transId });
                        });
                    });
                    stmt.finalize();
                });
            });

        } else {
            db.run("ROLLBACK");
            if (!res.headersSent) return res.status(400).json({ error: `Invalid or unsupported transaction type: ${finalType}` });
        }
    });
});

// Start Session (Create)
app.post('/api/sessions', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { groupId, officerId, date, startTime, endTime, venue, agenda, meeting_type, expected_attendance } = req.body;

    const stmt = db.prepare(`
        INSERT INTO meeting_sessions (
            groupId, officerId, date, startTime, endTime, status,
            venue, agenda, meeting_type, expected_attendance
        ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)
    `);

    stmt.run(
        groupId, officerId, date, startTime, endTime,
        venue || 'Usual Venue',
        agenda || '',
        meeting_type || 'Routine',
        expected_attendance || null,
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Start Meeting Session`, 'transaction', { id: this.lastID, groupId, officerId });
            res.json({
                id: this.lastID,
                groupId,
                officerId,
                date,
                startTime,
                endTime,
                venue,
                agenda,
                meeting_type,
                expected_attendance,
                status: 'ACTIVE'
            });
        }
    );
    stmt.finalize();
});

// Reschedule/Update Meeting (PATCH)
app.patch('/api/sessions/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { date, venue, agenda, meeting_type, expected_attendance, status } = req.body;

    let updates = [];
    let params = [];

    if (date) { updates.push("date = ?"); params.push(date); }
    if (venue) { updates.push("venue = ?"); params.push(venue); }
    if (agenda) { updates.push("agenda = ?"); params.push(agenda); }
    if (meeting_type) { updates.push("meeting_type = ?"); params.push(meeting_type); }
    if (expected_attendance) { updates.push("expected_attendance = ?"); params.push(expected_attendance); }
    if (status) { updates.push("status = ?"); params.push(status); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(id);
    const query = `UPDATE meeting_sessions SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Meeting not found" });

        logAudit(`Reschedule Meeting`, 'admin', { id, updates: req.body });
        res.json({ message: "Meeting updated successfully", id });
    });
});

// Close Session (Update to PENDING_APPROVAL)
app.patch('/api/sessions/:id/close', authenticateToken, checkFreeze('GROUP'), (req, res) => {
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
app.post('/api/sessions/:id/post', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const sessionId = req.params.id;
    const { transactions, metadata } = req.body; // metadata contains ukomboziRepayment and groupId

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

                // 3. Update Member Savings and Loan Balances from transactions
                let updateCount = 0;
                transactions.forEach(t => {
                    if (t.savings_amount > 0 || t.withdrawals > 0) {
                        const netSavings = (t.savings_amount || 0) - (t.withdrawals || 0);
                        db.run("UPDATE members SET current_savings = current_savings + ? WHERE id = ?", [netSavings, t.memberId], (err) => {
                            updateCount++;
                        });
                    } else {
                        updateCount++;
                    }
                });

                // 4. Record Partnership Repayment if present
                if (metadata && metadata.ukomboziRepayment > 0) {
                    const repayAmt = metadata.ukomboziRepayment;
                    db.run(`INSERT INTO company_investments (group_id, amount, notes, type) 
                            VALUES (?, ?, ?, 'REPAYMENT')`,
                        [metadata.groupId, -repayAmt, `Session Repayment: SID-${sessionId}`],
                        (err) => {
                            if (err) console.error("Partnership Repayment Log Error:", err);
                            logAudit(`Company Repayment: ${repayAmt}`, 'partnership', { groupId: metadata.groupId, sessionId, amount: repayAmt });
                        }
                    );
                }

                // 5. Trigger Real-Time Risk Evaluation
                if (metadata && metadata.groupId) {
                    RiskService.evaluateGroupRisk(metadata.groupId).catch(e => console.error("Post-Session Risk Error:", e));
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
            COALESCE(SUM(savings_amount), 0) as total_savings,
            COALESCE(SUM(stl_repayment), 0) as total_stl_repayment,
            COALESCE(SUM(ltl_repayment), 0) as total_ltl_repayment,
            COALESCE(SUM(loan_interest), 0) as total_interest,
            COALESCE(SUM(welfare), 0) as total_welfare,
            COALESCE(SUM(fines), 0) as total_fines,
            COALESCE(SUM(withdrawals), 0) as total_withdrawals,
            COALESCE(SUM(loans_issued), 0) as total_loans_issued
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
app.get('/api/transactions', authenticateToken, (req, res) => {
    const { sessionId, groupId, memberId, month, year } = req.query;

    let query = `
        SELECT t.*, s.date as sessionDate 
        FROM transactions t
        LEFT JOIN meeting_sessions s ON t.sessionId = s.id
        WHERE 1=1
    `;
    let params = [];

    if (sessionId) {
        query += " AND t.sessionId = ?";
        params.push(sessionId);
    }

    if (memberId) {
        query += " AND t.memberId = ?";
        params.push(memberId);
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

// Get Single Transaction (For Receipt)
app.get('/api/transactions/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT 
            t.*, 
            s.date as session_date,
            g.name as group_name,
            o.name as officer_name
        FROM transactions t
        JOIN meeting_sessions s ON t.sessionId = s.id
        JOIN groups g ON s.groupId = g.id
        JOIN officers o ON s.officerId = o.id
        WHERE t.id = ?
    `;

    db.get(query, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Transaction not found" });
        res.json(row);
    });
});

// ==========================================
// EMAIL SERVICE API
// ==========================================
// DISABLED: Email service crashes server - need to fix email config first
// const emailService = require('./services/emailService');

app.post('/api/send-email', async (req, res) => {
    const { to, subject, body, html } = req.body;

    if (!to || !subject || (!body && !html)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await emailService.sendEmail({
            to,
            subject,
            text: body,
            html: html || body // Use body as HTML if HTML not provided
        });

        if (result.success) {
            logAudit('Email Sent', 'system', { to, subject });
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ==========================================
// USER PROFILE & METRICS
// ==========================================
app.get('/api/profile', (req, res) => {
    const userId = req.query.id || 1; // Default to Admin (ID 1) if no auth

    db.get("SELECT id, name as full_name, role, phone, email, created_at as member_since FROM officers WHERE id = ?", [userId], (err, officer) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!officer) return res.status(404).json({ error: "Officer profile not found" });

        // Calculate System Metrics for the Admin Dashboard
        const queries = {
            totalSavings: "SELECT SUM(current_savings) as total FROM members",
            activeLoanBalance: "SELECT SUM(active_loan_balance) as total FROM members",
            activeMembers: "SELECT COUNT(*) as count FROM members WHERE status = 'active'",
            totalRepaid: "SELECT SUM(COALESCE(stl_repayment,0) + COALESCE(ltl_repayment,0)) as total FROM transactions",
            totalIssued: "SELECT SUM(loans_issued) as total FROM transactions"
        };

        // Execute queries sequentially (simplified for SQLite)
        db.get(queries.totalSavings, (e1, r1) => {
            db.get(queries.activeLoanBalance, (e2, r2) => {
                db.get(queries.activeMembers, (e3, r3) => {
                    db.get(queries.totalRepaid, (e4, r4) => {
                        db.get(queries.totalIssued, (e5, r5) => {

                            const totalSavings = r1?.total || 0;
                            const loanBalance = r2?.total || 0;
                            const activeMembers = r3?.count || 0;
                            const repaid = r4?.total || 0;
                            const issued = r5?.total || 1; // Avoid div by zero

                            // Assets = Savings + Outstanding Loans
                            const managedAssets = totalSavings + loanBalance;

                            // Recovery Rate Calculation
                            let recoveryRate = (repaid / issued) * 100;
                            if (issued === 0) recoveryRate = 100;
                            if (recoveryRate > 100) recoveryRate = 100; // Cap at 100%

                            res.json({
                                id: officer.id,
                                full_name: officer.full_name,
                                role: officer.role,
                                phone: officer.phone || '0700 000 000',
                                email: officer.email,
                                member_since: officer.member_since,
                                avatar_url: null,
                                permissions: ['manage_members', 'approve_loans', 'view_reports', 'manage_finance', 'system_config'],
                                metrics: {
                                    managed_assets: managedAssets,
                                    active_members: activeMembers,
                                    recovery_rate: parseFloat(recoveryRate.toFixed(1)),
                                    efficiency: 98.2 // Static for now, hard to calc without logs
                                }
                            });
                        });
                    });
                });
            });
        });
    });
});

/**
 * Dashboard Statistics Engine
 * Aggregates real-time data for charts and KPI cards
 */
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const getRow = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        });

        const getAll = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });

        const [
            memberCount,
            activeLoanCount,
            totalSavings,
            overdueLoans,
            totalDividends,
            cashFlow,
            loanStatuses,
            groupContributions,
            companyInvestments
        ] = await Promise.all([
            getRow("SELECT COUNT(*) as count FROM members WHERE status = 'active'"),
            getRow("SELECT COUNT(*) as count FROM loans WHERE status = 'active'"),
            getRow("SELECT SUM(current_savings) as total FROM members"),
            getRow("SELECT COUNT(*) as count FROM loans WHERE status = 'active' AND date('now') > date(due_date)"),
            getRow("SELECT SUM(total_payout) as total FROM dividend_runs WHERE status = 'POSTED'"),
            getAll(`
                SELECT 
                    strftime('%Y-%m', s.date) as month,
                    SUM(t.savings_amount + t.stl_repayment + t.ltl_repayment + t.loan_interest + t.welfare + t.fines) as cash_in,
                    SUM(t.withdrawals + t.loans_issued) as cash_out
                FROM transactions t
                JOIN meeting_sessions s ON t.sessionId = s.id
                GROUP BY month
                ORDER BY month ASC
                LIMIT 6
            `),
            getAll("SELECT status, COUNT(*) as count FROM loans GROUP BY status"),
            getAll("SELECT g.name as group_name, SUM(m.current_savings) as total FROM members m JOIN groups g ON m.group_id = g.id GROUP BY g.id"),
            getRow("SELECT SUM(amount) as total FROM company_investments WHERE type = 'TOPUP'")
        ]);

        const totalIn = cashFlow.reduce((acc, curr) => acc + (curr.cash_in || 0), 0);
        const totalOut = cashFlow.reduce((acc, curr) => acc + (curr.cash_out || 0), 0);

        const stats = {
            totalMembers: memberCount?.count || 0,
            activeLoans: activeLoanCount?.count || 0,
            totalContributions: totalSavings?.total || 0,
            pendingRepayments: overdueLoans?.count || 0,
            totalDividends: totalDividends?.total || 0,
            netCashFlow: totalIn - totalOut,
            cashFlowData: cashFlow,
            loanStatusData: loanStatuses,
            contributionBreakdown: groupContributions,
            liquidityMatrix: {
                groupCapital: totalSavings?.total || 0,
                companyTopUp: companyInvestments?.total || 0
            }
        };

        res.json(stats);
    } catch (err) {
        console.error("Dashboard Stats Error:", err);
        res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
});

// ==========================================
// LOANS API
// ==========================================

// Get Loan Repayment Schedule
app.get('/api/loans/:id/schedule', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.all("SELECT * FROM repayment_schedule WHERE loan_id = ? ORDER BY installment_number", [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Post Loan Repayment (during session)
app.post('/api/sessions/repayment', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { memberId, sessionId, loanId, amount, breakdown, paymentMethod, loanType } = req.body;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const description = `Loan Repayment - ${loanType} | Loan ID: ${loanId}`;
        const stmt = db.prepare(`
            INSERT INTO transactions (
                sessionId, memberId, stl_repayment, ltl_repayment, loan_interest, fines, description, transaction_type, uploaded, attended, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'LoanRepayment', 1, 1, 'PENDING')
        `);

        const stl_amt = loanType === 'STL' ? (breakdown?.principal || amount) : 0;
        const ltl_amt = loanType === 'LTL' ? (breakdown?.principal || amount) : 0;
        const interest = breakdown?.interest || 0;
        const penalty = breakdown?.penalty || 0;

        stmt.run(sessionId, memberId, stl_amt, ltl_amt, interest, penalty, description, async function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            const transId = this.lastID; // Capture for SMS completion

            // Update member balance
            db.run("UPDATE members SET active_loan_balance = active_loan_balance - ? WHERE id = ?", [stl_amt + ltl_amt, memberId], async (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                db.run("COMMIT");

                const smsMsg = `UKOMBOZI: Payment of KES ${Number(amount).toLocaleString()} confirmed. New Loan Balance: KES ${(stl_amt + ltl_amt > 0 ? 'Updating...' : 'OK')}.`;
                await logAndSendSMS(memberId, smsMsg, 'REPAYMENT', transId);

                logAudit(`Loan Repayment: ${amount}`, 'transaction', { memberId, loanId, amount, loanType });
                res.json({ success: true, message: "Repayment recorded", transaction_id: transId });
            });
        });
        stmt.finalize();
    });
});

// Member Withdrawal
app.post('/api/withdrawals', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { memberId, sessionId, amount, description } = req.body;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const stmt = db.prepare(`
            INSERT INTO transactions (
                sessionId, memberId, withdrawals, description, transaction_type, uploaded, attended, status
            ) VALUES (?, ?, ?, ?, 'Withdrawal', 1, 1, 'PENDING')
        `);

        stmt.run(sessionId, memberId, amount, description || 'Savings Withdrawal', function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            // Update member savings
            db.run("UPDATE members SET current_savings = current_savings - ? WHERE id = ?", [amount, memberId], async (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                db.run("COMMIT");
                const transId = this.lastID;
                const smsMsg = `UKOMBOZI: Withdrawal of KES ${Number(amount).toLocaleString()} confirmed. Ref: ${Date.now()}.`;
                await logAndSendSMS(memberId, smsMsg, 'WITHDRAWAL', transId);

                res.json({ success: true, message: "Withdrawal recorded", transaction_id: transId });
            });
        });
        stmt.finalize();
    });
});

// ============================================================================
// 🏦 LOAN ELIGIBILITY CHECK - Pre-Disbursement Validation
// ============================================================================

// POST /api/loans/check-eligibility - Check member loan eligibility with preview
app.post('/api/loans/check-eligibility', authenticateToken, (req, res) => {
    const { memberId, groupId, requestedAmount, loanType, duration = 1 } = req.body;
    const numAmount = parseFloat(requestedAmount) || 0;

    // Validation
    if (!memberId) return res.status(400).json({ error: 'Member ID is required' });
    if (!groupId) return res.status(400).json({ error: 'Group ID is required' });

    // Fetch member data with eligibility factors
    db.get(`
        SELECT m.*,
               COALESCE(m.savings_balance, 0) as savings_balance,
               COALESCE(m.current_savings, 0) as current_savings,
               COALESCE(m.active_loan_balance, 0) as active_loan_balance,
               COALESCE(m.risk_score, 50) as risk_score,
               g.name as group_name, g.status as group_status,
               (SELECT COUNT(*) FROM loans WHERE member_id = m.id AND status = 'active') as active_loans_count,
               (SELECT COALESCE(SUM(principal_amount), 0) FROM loans WHERE member_id = m.id AND status = 'active') as total_active_principal
        FROM members m
        LEFT JOIN groups g ON m.group_id = g.id
        WHERE m.id = ?
    `, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.status(404).json({ error: 'Member not found' });

        // Check group status
        if (member.group_status === 'frozen') {
            return res.json({
                eligible: false,
                reason: 'Group is frozen - no loans allowed',
                maxEligible: 0,
                preview: null
            });
        }

        // Calculate eligibility based on savings (3x multiplier standard)
        const savingsBalance = member.savings_balance || member.current_savings || 0;
        const savingsMultiplier = 3;
        const maxBasedOnSavings = savingsBalance * savingsMultiplier;

        // Check for existing loans
        if (member.active_loans_count > 0) {
            return res.json({
                eligible: false,
                reason: `Member has ${member.active_loans_count} active loan(s) totaling KES ${member.total_active_principal.toLocaleString()}. Must clear before new loan.`,
                maxEligible: 0,
                currentLoans: member.active_loans_count,
                outstandingBalance: member.total_active_principal,
                preview: null
            });
        }

        // Check risk score (reject if too high)
        if (member.risk_score >= 80) {
            return res.json({
                eligible: false,
                reason: `Member risk score (${member.risk_score}) is too high. Maximum allowed is 80.`,
                maxEligible: 0,
                riskScore: member.risk_score,
                preview: null
            });
        }

        // Check minimum savings requirement
        const minSavings = 1000;
        if (savingsBalance < minSavings) {
            return res.json({
                eligible: false,
                reason: `Insufficient savings. Minimum KES ${minSavings.toLocaleString()} required. Current: KES ${savingsBalance.toLocaleString()}`,
                maxEligible: 0,
                currentSavings: savingsBalance,
                preview: null
            });
        }

        // Check group liquidity
        db.get(`
            SELECT 
                (SELECT COALESCE(SUM(current_savings), 0) FROM members WHERE group_id = ?) as total_savings,
                (SELECT COALESCE(SUM(active_loan_balance), 0) FROM members WHERE group_id = ?) as total_loans
        `, [groupId, groupId], (err, liquidity) => {
            if (err) return res.status(500).json({ error: err.message });

            const availableLiquidity = (liquidity.total_savings || 0) - (liquidity.total_loans || 0);
            const maxBasedOnLiquidity = Math.max(0, availableLiquidity * 0.7); // Only use 70% of available

            // Determine max eligible (lowest of savings-based and liquidity-based)
            const maxEligible = Math.min(maxBasedOnSavings, maxBasedOnLiquidity);

            // Check if requested amount exceeds eligibility
            const finalAmount = numAmount > 0 ? Math.min(numAmount, maxEligible) : maxEligible;
            const isEligible = maxEligible > 0;

            if (!isEligible) {
                return res.json({
                    eligible: false,
                    reason: 'Insufficient group liquidity or savings for loan issuance',
                    maxEligible: 0,
                    groupLiquidity: availableLiquidity,
                    preview: null
                });
            }

            // Calculate repayment preview
            const interestRate = 10; // Default 10%
            const monthlyInterest = interestRate / 100 / 12;
            const totalInterest = finalAmount * (interestRate / 100) * (duration || 1);
            const totalRepayment = finalAmount + totalInterest;
            const monthlyPayment = totalRepayment / (duration || 1);

            // Calculate risk impact
            const newRiskScore = Math.min(100, member.risk_score + 25);

            // Build preview
            const preview = {
                member_name: member.name,
                group_name: member.group_name,
                current_savings: savingsBalance,
                savings_multiplier: savingsMultiplier,
                max_from_savings: maxBasedOnSavings,
                group_liquidity: availableLiquidity,
                max_from_liquidity: maxBasedOnLiquidity,
                max_eligible: maxEligible,
                requested_amount: numAmount,
                approved_amount: finalAmount,
                interest_rate: interestRate,
                duration_months: duration,
                total_interest: totalInterest,
                total_repayment: totalRepayment,
                monthly_payment: monthlyPayment,
                risk_score_before: member.risk_score,
                risk_score_after: newRiskScore,
                ledger_entries: [
                    { account: 'member_loan', direction: 'DEBIT', amount: finalAmount, description: 'Loan principal issued' },
                    { account: 'group_cash', direction: 'CREDIT', amount: finalAmount, description: 'Cash disbursed to member' },
                    { account: 'group_loan_pool', direction: 'DEBIT', amount: finalAmount, description: 'Loan receivable recorded' }
                ],
                repayment_schedule: generateRepaymentSchedule(finalAmount, interestRate, duration)
            };

            res.json({
                eligible: true,
                reason: null,
                maxEligible: maxEligible,
                currentSavings: savingsBalance,
                groupLiquidity: availableLiquidity,
                preview
            });
        });
    });
});

// Helper: Generate repayment schedule preview
function generateRepaymentSchedule(principal, ratePercent, months) {
    const schedule = [];
    const monthlyRate = ratePercent / 100 / 12;
    const totalInterest = principal * (ratePercent / 100);
    const totalAmount = principal + totalInterest;
    const monthlyPayment = totalAmount / months;
    const principalMonthly = principal / months;
    const interestMonthly = totalInterest / months;

    let remainingBalance = totalAmount;
    const today = new Date();

    for (let i = 1; i <= months; i++) {
        const dueDate = new Date(today);
        dueDate.setMonth(today.getMonth() + i);

        remainingBalance -= monthlyPayment;

        schedule.push({
            installment: i,
            due_date: dueDate.toISOString().split('T')[0],
            principal: Math.round(principalMonthly),
            interest: Math.round(interestMonthly),
            total: Math.round(monthlyPayment),
            balance: Math.max(0, Math.round(remainingBalance))
        });
    }

    return schedule;
}

// Issue Loan
app.post('/api/loans', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    const {
        memberId, groupId, sessionId, loanType, amount, interestRate = 10, duration, officerId,
        guarantor1_id, guarantor2_id
    } = req.body;

    const issuedDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + (duration || 1));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // 🛡️ INSTITUTIONAL LIQUIDITY GUARD: Physical Cash Check (Immediate Bag Check)
    if (groupId) {
        try {
            await CashControlService.validateLiquidity(groupId, amount);
        } catch (e) {
            return res.status(400).json({ error: e.message });
        }
    }

    db.serialize(() => {
        // JANUARY ENGINE: LIQUIDITY ENFORCEMENT
        const liquidityQuery = `
            SELECT 
                (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id JOIN members m ON pr.member_id = m.id WHERE m.group_id = ?) as total_project_pool,
                (SELECT COALESCE(SUM(current_savings), 0) FROM members WHERE group_id = ?) as total_table_savings,
                (SELECT COALESCE(SUM(active_loan_balance), 0) FROM members WHERE group_id = ?) as total_active_loans
        `;

        db.get(liquidityQuery, [groupId || 1, groupId || 1, groupId || 1], (err, stats) => {
            if (err) return res.status(500).json({ error: err.message });

            const payoutObligation = stats.total_project_pool * 1.5;
            const currentLiquidity = (stats.total_table_savings + stats.total_project_pool) - stats.total_active_loans;

            if ((currentLiquidity - amount) < payoutObligation) {
                return res.status(403).json({
                    error: `Loan Denied: Strategic Liquidity Breach. Issuing KES ${amount} would leave KES ${currentLiquidity - amount} which is below the January Obligation of KES ${payoutObligation}.`
                });
            }

            db.run("BEGIN TRANSACTION");

            const stmt = db.prepare(`INSERT INTO loans (
            member_id, group_id, loan_type, principal_amount, interest_rate, 
            issued_date, due_date, status, issued_by, guarantor1_id, guarantor2_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`);

            stmt.run(
                memberId, groupId || 1, loanType, amount, interestRate,
                issuedDate, dueDateStr, officerId || 1,
                guarantor1_id || null, guarantor2_id || null,
                function (err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }

                    const loanId = this.lastID;

                    // 1. Update member active loan balance + Increase Risk (Guide: Loan Issued +25)
                    db.run("UPDATE members SET active_loan_balance = IFNULL(active_loan_balance, 0) + ?, risk_score = MIN(100, risk_score + 25) WHERE id = ?", [amount, memberId], (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: err.message });
                        }

                        // 2. Strict Session Enforcement for Ledger
                        if (!sessionId) {
                            db.run("ROLLBACK");
                            return res.status(400).json({ error: "Session Integrity Violation: Loan cannot be issued without an active Meeting Session." });
                        }

                        const txStmt = db.prepare(`
                        INSERT INTO transactions (
                            sessionId, memberId, loans_issued, transaction_type, description, attended, status
                        ) VALUES (?, ?, ?, 'LoanIssued', ?, 1, 'PENDING')
                    `);
                        txStmt.run(sessionId, memberId, amount, `${loanType} Loan Issued | Loan ID: ${loanId}`, async function (txErr) {
                            if (txErr) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: txErr.message });
                            }

                            const transId = this.lastID;

                            // 3. GENERATE REPAYMENT SCHEDULE (New)
                            const {
                                monthly_installment, principal_portion,
                                interest_portion, shares_contribution, duration
                            } = req.body;

                            // If it's a standardized loan product (fields provided)
                            if (monthly_installment && principal_portion) {
                                let scheduleInsert = db.prepare(`
                                    INSERT INTO repayment_schedule (
                                        loan_id, installment_number, due_date, 
                                        expected_installment, expected_principal, 
                                        expected_interest, expected_shares, status
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                                `);

                                for (let i = 1; i <= duration; i++) {
                                    const instDate = new Date();
                                    instDate.setMonth(instDate.getMonth() + i);
                                    const instDateStr = instDate.toISOString().split('T')[0];

                                    scheduleInsert.run(
                                        loanId, i, instDateStr,
                                        monthly_installment, principal_portion,
                                        interest_portion, shares_contribution
                                    );
                                }
                                scheduleInsert.finalize();
                            }

                            db.run("COMMIT");
                            logAudit(`Issue Loan: ${amount}`, 'transaction', { memberId, loanId, amount, loanType });

                            const smsMsg = `UKOMBOZI: LOAN DISBURSED! KES ${Number(amount).toLocaleString()} (${loanType}). Due: ${dueDateStr}. Ref: ${loanId}.`;
                            await logAndSendSMS(memberId, smsMsg, 'LOAN_DISBURSED', transId);

                            res.json({ id: loanId, status: 'active', message: 'Loan issued successfully', transaction_id: transId });
                        });
                        txStmt.finalize();
                    });
                });
            stmt.finalize();
        });
    });
});

// ============================================================================
// 🏦 LOAN REPAYMENT ENGINE - Process Loan Payments
// ============================================================================

// POST /api/loans/repay - Process loan repayment with atomic transaction
app.post('/api/loans/repay', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    const {
        loanId, memberId, groupId, sessionId, amount,
        paymentMethod = 'cash', officerId
    } = req.body;

    const repaymentAmount = parseFloat(amount) || 0;

    // Validation
    if (!loanId) return res.status(400).json({ error: 'Loan ID is required' });
    if (!memberId) return res.status(400).json({ error: 'Member ID is required' });
    if (!sessionId) return res.status(400).json({ error: 'Active session is required' });
    if (repaymentAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    try {
        // Get loan details
        const loan = await new Promise((resolve, reject) => {
            db.get(`
                SELECT l.*, m.name as member_name, m.active_loan_balance, m.risk_score
                FROM loans l
                JOIN members m ON l.member_id = m.id
                WHERE l.id = ?
            `, [loanId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!loan) return res.status(404).json({ error: 'Loan not found' });
        if (loan.status === 'paid') return res.status(400).json({ error: 'Loan is already fully paid' });

        // Calculate outstanding balance
        const totalRepaid = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COALESCE(SUM(amount_paid), 0) as total
                FROM loan_payments
                WHERE loan_id = ?
            `, [loanId], (err, row) => {
                if (err) reject(err);
                else resolve(row?.total || 0);
            });
        });

        const totalWithInterest = loan.principal_amount * (1 + (loan.interest_rate / 100));
        const outstandingBalance = totalWithInterest - totalRepaid;

        if (repaymentAmount > outstandingBalance) {
            return res.status(400).json({
                error: `Payment exceeds outstanding balance of KES ${outstandingBalance.toLocaleString()}`
            });
        }

        // Calculate principal and interest allocation
        const interestPortion = Math.min(repaymentAmount, loan.principal_amount * (loan.interest_rate / 100) - (totalRepaid * (loan.interest_rate / 100) / (1 + loan.interest_rate / 100)));
        const principalPortion = repaymentAmount - Math.max(0, interestPortion);

        // Determine if this is a full payoff
        const newOutstanding = outstandingBalance - repaymentAmount;
        const isFullPayoff = Math.abs(newOutstanding) < 1; // Allow for rounding

        const paymentDate = new Date().toISOString();
        const paymentRef = `PAY-${loanId}-${Date.now()}`;

        // Begin atomic transaction
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // 1. Insert loan payment record
            db.run(`
                INSERT INTO loan_payments (
                    loan_id, member_id, session_id, amount_paid, 
                    principal_paid, interest_paid, payment_method,
                    payment_ref, payment_date, posted_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                loanId, memberId, sessionId, repaymentAmount,
                principalPortion, interestPortion, paymentMethod,
                paymentRef, paymentDate, officerId || 1
            ], function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                const paymentId = this.lastID;

                // 2. Update member's active loan balance (reduce)
                const balanceReduction = principalPortion;
                db.run(`
                    UPDATE members 
                    SET active_loan_balance = MAX(0, active_loan_balance - ?),
                        risk_score = MAX(0, risk_score - ?)
                    WHERE id = ?
                `, [balanceReduction, isFullPayoff ? 15 : 5, memberId], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }

                    // 3. Update loan status if fully paid
                    if (isFullPayoff) {
                        db.run(`
                            UPDATE loans 
                            SET status = 'paid', 
                                paid_date = ?,
                                amount_paid = principal_amount * (1 + interest_rate / 100)
                            WHERE id = ?
                        `, [paymentDate, loanId]);
                    } else {
                        db.run(`
                            UPDATE loans 
                            SET amount_paid = COALESCE(amount_paid, 0) + ?
                            WHERE id = ?
                        `, [repaymentAmount, loanId]);
                    }

                    // 4. Update repayment schedule (mark installments as paid)
                    db.run(`
                        UPDATE repayment_schedule
                        SET status = 'paid', 
                            actual_payment = COALESCE(actual_payment, 0) + ?,
                            payment_date = ?
                        WHERE loan_id = ? 
                          AND status = 'pending'
                        ORDER BY installment_number ASC
                        LIMIT 1
                    `, [repaymentAmount, paymentDate.split('T')[0], loanId]);

                    // 5. Insert transaction record
                    db.run(`
                        INSERT INTO transactions (
                            sessionId, memberId, loan_principal, loan_interest, 
                            transaction_type, description, attended, status
                        ) VALUES (?, ?, ?, ?, 'LoanRepayment', ?, 1, 'POSTED')
                    `, [
                        sessionId, memberId, principalPortion, interestPortion,
                        `Loan Repayment | Ref: ${paymentRef} | Loan ID: ${loanId}`
                    ], async function (err) {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: err.message });
                        }

                        const transactionId = this.lastID;

                        // 6. Insert ledger entries
                        db.run(`
                            INSERT INTO contribution_ledger (
                                member_id, group_id, session_id, transaction_ref,
                                contribution_type, amount, status, officer_id, description
                            ) VALUES (?, ?, ?, ?, 'loan_repayment', ?, 'POSTED', ?, ?)
                        `, [
                            memberId, groupId, sessionId, paymentRef,
                            repaymentAmount, officerId || 1,
                            `Loan repayment - Principal: ${principalPortion.toFixed(0)}, Interest: ${interestPortion.toFixed(0)}`
                        ]);

                        db.run("COMMIT", async (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: err.message });
                            }

                            // Log audit
                            logAudit(`Loan Repayment: ${repaymentAmount}`, 'transaction', {
                                loanId, memberId, amount: repaymentAmount, paymentRef
                            });

                            // Send SMS notification
                            const smsMsg = isFullPayoff
                                ? `UKOMBOZI: Congratulations! Your loan of KES ${loan.principal_amount.toLocaleString()} is FULLY PAID! Thank you for your commitment. Ref: ${paymentRef}`
                                : `UKOMBOZI: Loan payment of KES ${repaymentAmount.toLocaleString()} received. Outstanding: KES ${newOutstanding.toFixed(0)}. Ref: ${paymentRef}.`;

                            await logAndSendSMS(memberId, smsMsg, isFullPayoff ? 'LOAN_CLEARED' : 'LOAN_REPAYMENT', transactionId);

                            res.json({
                                success: true,
                                payment_id: paymentId,
                                payment_ref: paymentRef,
                                amount_paid: repaymentAmount,
                                principal_paid: principalPortion,
                                interest_paid: interestPortion,
                                outstanding_balance: newOutstanding,
                                loan_status: isFullPayoff ? 'paid' : 'active',
                                risk_score_reduction: isFullPayoff ? 15 : 5,
                                message: isFullPayoff
                                    ? 'Loan fully paid! Congratulations!'
                                    : `Payment recorded successfully. Outstanding: KES ${newOutstanding.toFixed(0)}`
                            });
                        });
                    });
                });
            });
        });

    } catch (error) {
        console.error('Loan repayment error:', error);
        res.status(500).json({ error: 'Failed to process loan repayment' });
    }
});

// GET /api/loans/:id/arrears - Calculate loan arrears
app.get('/api/loans/:id/arrears', authenticateToken, (req, res) => {
    const loanId = req.params.id;

    // Get loan and payment details
    db.get(`
        SELECT l.*, m.name as member_name,
               (SELECT COALESCE(SUM(amount_paid), 0) FROM loan_payments WHERE loan_id = l.id) as total_paid
        FROM loans l
        JOIN members m ON l.member_id = m.id
        WHERE l.id = ?
    `, [loanId], (err, loan) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!loan) return res.status(404).json({ error: 'Loan not found' });

        // Get overdue installments
        const today = new Date().toISOString().split('T')[0];

        db.all(`
            SELECT * FROM repayment_schedule
            WHERE loan_id = ? AND status = 'pending' AND due_date < ?
            ORDER BY due_date ASC
        `, [loanId, today], (err, overdueInstallments) => {
            if (err) return res.status(500).json({ error: err.message });

            const totalOverdue = overdueInstallments.reduce((sum, inst) =>
                sum + (inst.expected_installment - (inst.actual_payment || 0)), 0);

            const daysOverdue = overdueInstallments.length > 0
                ? Math.floor((new Date() - new Date(overdueInstallments[0].due_date)) / (1000 * 60 * 60 * 24))
                : 0;

            const totalOwed = loan.principal_amount * (1 + loan.interest_rate / 100);
            const outstandingBalance = totalOwed - (loan.total_paid || 0);

            res.json({
                loan_id: loanId,
                member_name: loan.member_name,
                principal: loan.principal_amount,
                interest_rate: loan.interest_rate,
                total_owed: totalOwed,
                total_paid: loan.total_paid,
                outstanding_balance: outstandingBalance,
                overdue_installments: overdueInstallments.length,
                total_arrears: totalOverdue,
                days_overdue: daysOverdue,
                arrears_status: totalOverdue > 0
                    ? (daysOverdue > 30 ? 'CRITICAL' : (daysOverdue > 14 ? 'WARNING' : 'OVERDUE'))
                    : 'CURRENT',
                details: overdueInstallments
            });
        });
    });
});

// GET /api/loans/:id/payments - Get payment history for a loan
app.get('/api/loans/:id/payments', authenticateToken, (req, res) => {
    const loanId = req.params.id;

    db.all(`
        SELECT lp.*, m.name as member_name, o.name as officer_name
        FROM loan_payments lp
        JOIN members m ON lp.member_id = m.id
        LEFT JOIN officers o ON lp.posted_by = o.id
        WHERE lp.loan_id = ?
        ORDER BY lp.payment_date DESC
    `, [loanId], (err, payments) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(payments);
    });
});

// ==========================================
// LOAN APPLICATIONS API
// ==========================================

// Get all loan applications
app.get('/api/loan-applications', (req, res) => {
    const { status } = req.query;
    let query = `
        SELECT la.*, m.name as member_name, g.name as group_name
        FROM loan_applications la
        JOIN members m ON la.member_id = m.id
        JOIN groups g ON la.group_id = g.id
    `;
    let params = [];

    if (status && status !== 'ALL') {
        query += " WHERE la.status = ?";
        params.push(status);
    }

    query += " ORDER BY la.created_at DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Transform for frontend
        const apps = rows.map(r => ({
            ...r,
            member: {
                name: r.member_name,
                groups: { name: r.group_name }
            }
        }));
        res.json(apps);
    });
});

// Submit a new loan application
app.post('/api/loan-applications', authenticateToken, checkFreeze('OFFICER'), (req, res) => {
    const {
        memberId, groupId, loanType, amount, duration, purpose,
        monthly_installment, principal_portion, interest_portion, shares_contribution, officerId,
        guarantor1_id, guarantor2_id
    } = req.body;

    if (!memberId || !groupId) {
        return res.status(400).json({ error: "Member and Group are mandatory for loan applications." });
    }

    // Step 1: Authoritative Selection Validation
    db.get("SELECT status, is_frozen FROM groups WHERE id = ?", [groupId], (err, group) => {
        if (err || !group) return res.status(400).json({ error: "Selected Group does not exist or is unavailable." });
        if (group.status !== 'active' || group.is_frozen === 1) {
            return res.status(403).json({ error: "Action Blocked: The selected group is currently INACTIVE or FROZEN." });
        }

        db.get("SELECT status, group_id FROM members WHERE id = ?", [memberId], (err, member) => {
            if (err || !member) return res.status(400).json({ error: "Selected Member does not exist." });
            if (member.status !== 'active') {
                return res.status(403).json({ error: "Action Blocked: The selected member is currently INACTIVE." });
            }
            if (member.group_id !== parseInt(groupId)) {
                return res.status(403).json({ error: "Data Integrity Violation: Member does not belong to the selected group." });
            }

            // Step 2: Atomic Creation
            const appNumber = `APP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

            const stmt = db.prepare(`
                INSERT INTO loan_applications (
                    application_number, member_id, group_id, loan_type, amount_requested, 
                    duration_months, purpose, monthly_installment, interest_portion, 
                    principal_portion, shares_contribution, officer_id, guarantor1_id, guarantor2_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPLIED')
            `);

            stmt.run(
                appNumber, memberId, groupId, loanType, amount,
                duration, purpose, monthly_installment, interest_portion,
                principal_portion, shares_contribution, officerId, guarantor1_id || null, guarantor2_id || null,
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    logAudit(`Submit Loan App: ${appNumber}`, 'transaction', { id: this.lastID, memberId, amount });
                    res.json({ id: this.lastID, application_number: appNumber, success: true, status: 'APPLIED' });
                }
            );
            stmt.finalize();
        });
    });
});

// Update loan application status
app.patch('/api/loan-applications/:id/status', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    const { status, comments } = req.body;
    const officerId = req.user.id; // Enforce logged-in user

    db.get("SELECT * FROM loan_applications WHERE id = ?", [id], (err, app) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!app) return res.status(404).json({ error: "Application not found" });

        // NO MERCY ENFORCEMENT: Pre-Approval Checks
        if (status === 'APPROVED') {
            // 0. INSIDER ABUSE PROTECTION (Segregation of Duties)
            // Check if Approver == Applicant (via Phone Number Match)
            const checkQuery = `
                SELECT 
                    (SELECT phone FROM officers WHERE id = ?) as officer_phone,
                    (SELECT phone FROM members WHERE id = ?) as member_phone
            `;
            db.get(checkQuery, [officerId, app.member_id], (err, phones) => {
                if (err) return res.status(500).json({ error: err.message });

                if (phones && phones.officer_phone === phones.member_phone) {
                    return res.status(403).json({
                        error: "INSIDER PROTECTION BLOCK: Conflict of Interest. You cannot approve a loan for your own linked account."
                    });
                }

                const groupId = app.group_id;

                // 1. Treasurer Check

                // 1. Treasurer Check
                db.get("SELECT id FROM group_officials WHERE group_id = ? AND role = 'Treasurer' AND status = 'active'", [groupId], (err, treasurer) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (!treasurer) {
                        return res.status(403).json({
                            error: "NO MERCY: Approval Denied. Active Treasurer required for authorization. Position is currently vacant or inactive."
                        });
                    }

                    // 2. Liquidity Check
                    db.get(`
                    SELECT 
                        (SELECT COALESCE(SUM(current_savings), 0) FROM members WHERE group_id = ?) as total_savings,
                        (SELECT COALESCE(SUM(active_loan_balance), 0) FROM members WHERE group_id = ?) as total_loans
                `, [groupId, groupId], (err, stats) => {
                        if (err) return res.status(500).json({ error: err.message });

                        const availableLiquidity = stats.total_savings - stats.total_loans;
                        if (availableLiquidity < app.amount_requested) {
                            return res.status(403).json({
                                error: `NO MERCY: Liquidity Crisis. Available Cash (KES ${availableLiquidity.toLocaleString()}) matches inadequate for Loan (KES ${app.amount_requested.toLocaleString()}).`
                            });
                        }

                        // Proceed with Approval
                        executeApproval();
                    });
                });
            });
        } else {
            executeApproval();
        }

        function executeApproval() {
            db.run(
                "UPDATE loan_applications SET status = ?, comments = ?, officer_id = ? WHERE id = ?",
                [status, comments, officerId, id],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    // If FULLY APPROVED, create a real loan record
                    if (status === 'APPROVED') {
                        const issuedDate = new Date().toISOString().split('T')[0];
                        const dueDate = new Date();
                        dueDate.setMonth(dueDate.getMonth() + (app.duration_months || 1));
                        const dueDateStr = dueDate.toISOString().split('T')[0];

                        db.serialize(() => {
                            db.run("BEGIN TRANSACTION");
                            const loanStmt = db.prepare(`INSERT INTO loans (
                            member_id, group_id, loan_type, principal_amount, interest_rate, 
                            issued_date, due_date, status, issued_by
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`);

                            // Interest rate is heuristic for now, should ideally come from application or product
                            const interestRate = 10;

                            loanStmt.run(app.member_id, app.group_id, app.loan_type, app.amount_requested, interestRate, issuedDate, dueDateStr, officerId, function (err) {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return console.error("Loan Creation Error", err);
                                }
                                const loanId = this.lastID;

                                // GENERATE REPAYMENT SCHEDULE
                                if (app.monthly_installment && app.principal_portion) {
                                    let scheduleInsert = db.prepare(`
                                        INSERT INTO repayment_schedule (
                                            loan_id, installment_number, due_date, 
                                            expected_installment, expected_principal, 
                                            expected_interest, expected_shares, status
                                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                                    `);

                                    for (let i = 1; i <= app.duration_months; i++) {
                                        const instDate = new Date();
                                        instDate.setMonth(instDate.getMonth() + i);
                                        const instDateStr = instDate.toISOString().split('T')[0];

                                        scheduleInsert.run(
                                            loanId, i, instDateStr,
                                            app.monthly_installment, app.principal_portion,
                                            app.interest_portion, app.shares_contribution
                                        );
                                    }
                                    scheduleInsert.finalize();
                                }

                                db.run("UPDATE members SET active_loan_balance = IFNULL(active_loan_balance, 0) + ? WHERE id = ?", [app.amount_requested, app.member_id]);
                                db.run("UPDATE loan_applications SET status = 'DISBURSED' WHERE id = ?", [id]);
                                db.run("COMMIT");
                                logAudit(`Disburse Loan: ${app.amount_requested}`, 'transaction', { memberId: app.member_id, loanId });
                            });
                            loanStmt.finalize();
                        });
                    }

                    logAudit(`Update Loan App Status: ${id}`, 'transaction', { id, status });
                    res.json({ success: true, status });
                }
            );
        }
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

// ==========================================
// DIVIDEND ENGINE (FULL LOCAL IMPLEMENTATION)
// ==========================================
const dividendRules = require('./services/dividendRules');

// Get All Runs
app.get('/api/dividends/runs', (req, res) => {
    db.all("SELECT * FROM dividend_runs ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Preview Dividend Run
app.post('/api/dividends/preview', authenticateToken, isAdmin, async (req, res) => {
    const { year, groupId, expenses } = req.body;

    if (!year || !groupId) {
        return res.status(400).json({ error: "Missing required fields: year, groupId" });
    }

    try {
        const preview = await dividendRules.generatePreview(db, year, groupId, expenses || 0);
        res.json(preview);
    } catch (error) {
        console.error("Dividend Preview Error:", error);
        res.status(500).json({ error: "Calculations failed: " + error.message });
    }
});

// Post Dividend Run (Commit)
app.post('/api/dividends/post', authenticateToken, isAdmin, (req, res) => {
    const { runData } = req.body;
    // runData is the object returned by 'preview' with confirm flag

    if (!runData) return res.status(400).json({ error: "No run data provided" });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Insert Dividend Run Record
        const insertRun = `
            INSERT INTO dividend_runs (
                financial_year, group_id, 
                operating_expenses, profit_share_percentage, 
                dividend_rate, allocable_profit, total_payout, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'POSTED')
        `;

        db.run(insertRun, [
            runData.year, runData.groupId,
            runData.expenses, runData.ratio * 100,
            runData.dividendRate, runData.profitToShare,
            runData.profitToShare // Total payout assumes 100% distribution of shareable profit
        ], function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: "Failed to create run record: " + err.message });
            }

            const runId = this.lastID;
            const allocations = runData.allocations || [];

            if (allocations.length === 0) {
                db.run("COMMIT");
                return res.json({ success: true, message: "Dividend run recorded (Zero allocations)." });
            }

            // 2. Insert Allocations & Update Balances
            const insertAlloc = `
                INSERT INTO dividend_allocations (
                    dividend_run_id, member_id, average_shares, 
                    gross_dividend, net_dividend, posted_to_savings
                ) VALUES (?, ?, ?, ?, ?, 1)
            `;

            const insertTx = `
                INSERT INTO transactions (
                    memberId, savings_amount, transaction_type, 
                    description, uploaded, attended
                ) VALUES (?, ?, 'DividendPayout', ?, 1, 1)
            `;

            const updateMember = `UPDATE members SET current_savings = current_savings + ? WHERE id = ?`;

            let pending = allocations.length;
            let errorOccurred = false;

            allocations.forEach(alloc => {
                if (errorOccurred) return;

                // A. Record Allocation
                db.run(insertAlloc, [
                    runId, alloc.memberId, alloc.averageShares,
                    alloc.grossDividend, alloc.netDividend
                ], (err) => {
                    if (err) { errorOccurred = true; return; }

                    // B. Record Transaction (Ledger)
                    db.run(insertTx, [
                        alloc.memberId, alloc.grossDividend,
                        `Dividend Payout ${runData.year}`
                    ], (err) => {
                        if (err) { errorOccurred = true; return; }

                        // C. Update balance
                        db.run(updateMember, [alloc.grossDividend, alloc.memberId], (err) => {
                            if (err) errorOccurred = true;

                            pending--;
                            if (pending === 0) {
                                if (errorOccurred) {
                                    db.run("ROLLBACK");
                                    res.status(500).json({ error: "Batch processing failed" });
                                } else {
                                    db.run("COMMIT");
                                    res.json({ success: true, message: "Dividends distributed successfully!" });
                                }
                            }
                        });
                    });
                });
            });
        });
    });
});

// Create Run
app.post('/api/dividends/runs', authenticateToken, isAdmin, (req, res) => {
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

    // NO MERCY ENFORCEMENT: Financial Prudence
    if ((data.mandatory_reserves || 0) < (income * 0.10)) {
        return res.status(400).json({
            error: "NO MERCY: Violation of Reserve Policy. Minimum 10% of Gross Income must be allocated to Mandatory Reserves."
        });
    }

    if ((data.profit_share_percentage || 0) > 70) {
        return res.status(400).json({
            error: "NO MERCY: UNSUSTAINABLE DISTRIBUTION. Profit Share cannot exceed 70% to protect liquidity."
        });
    }

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
app.post('/api/dividends/:id/calculate', authenticateToken, isAdmin, (req, res) => {
    const runId = req.params.id;
    // Update status to CALCULATED
    db.run("UPDATE dividend_runs SET status = 'CALCULATED', dividend_rate = 0.12, total_payout = 150000 WHERE id = ?", [runId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, total_members: 5, total_payout: 150000 });
    });
});

// Approve Run
app.post('/api/dividends/:id/approve', authenticateToken, isAdmin, (req, res) => {
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

// Redundant mock dividend post removed.

// Contributions Endpoint (Local)
// Contributions Endpoint (Local) - STRICT SESSION ENFORCEMENT
app.post('/api/contributions', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { memberId, amount, type, sessionId } = req.body;

    if (!sessionId || !memberId || !amount) {
        return res.status(400).json({ error: "Missing required fields: sessionId, memberId, and amount are mandatory." });
    }

    // Step 1: Validate Session & Get Group Context
    db.get("SELECT status, groupId FROM meeting_sessions WHERE id = ?", [sessionId], (err, session) => {
        if (err || !session) return res.status(400).json({ error: "Session Integrity Violation: Meeting session does not exist." });
        if (session.status !== 'ACTIVE') {
            return res.status(403).json({ error: "Action Blocked: Cannot post to a CLOSED or INACTIVE meeting session." });
        }

        const groupId = session.groupId;

        // Step 2: Validate Group Status
        db.get("SELECT status, is_frozen FROM groups WHERE id = ?", [groupId], (err, group) => {
            if (err || !group) return res.status(400).json({ error: "Group context lost or unavailable." });
            if (group.status !== 'active' || group.is_frozen === 1) {
                return res.status(403).json({ error: "Action Blocked: The group for this session is currently INACTIVE or FROZEN." });
            }

            // Step 3: Validate Member & Relationship
            db.get("SELECT status, group_id, name FROM members WHERE id = ?", [memberId], (err, member) => {
                if (err || !member) return res.status(400).json({ error: "Selected Member does not exist." });
                if (member.status !== 'active') {
                    return res.status(403).json({ error: "Action Blocked: The selected member is currently INACTIVE." });
                }
                if (member.group_id !== groupId) {
                    return res.status(403).json({ error: "Relationship Violation: Member does not belong to the meeting's group." });
                }

                // Step 4: Atomic Record Creation (No direct balance updates as per Spec Step 8)
                const stmt = db.prepare(`
                    INSERT INTO transactions (
                        sessionId, memberId, memberName, savings_amount, transaction_type, description, created_at, uploaded, status
                    ) VALUES (?, ?, ?, ?, 'Contribution', ?, ?, 1, 'COMPLETED')
                `);

                const timestamp = new Date().toISOString();
                const description = `${type} Contribution`;

                stmt.run(sessionId, memberId, member.name, amount, description, timestamp, async function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    const transId = this.lastID;
                    logAudit(`Contribution: ${transId}`, 'transaction', { memberId, amount, sessionId });

                    // Optional but recommended Audit/Log for Traceability (Step 5)
                    const smsMsg = `UKOMBOZI: Contribution of KES ${Number(amount).toLocaleString()} confirmed. Type: ${type}. Ref: ${transId}.`;
                    try {
                        await logAndSendSMS(memberId, smsMsg, 'CONTRIBUTION', transId);
                    } catch (smsErr) {
                        console.error("SMS notification failed but contribution was recorded:", smsErr);
                    }

                    res.json({ id: transId, status: 'Completed', message: 'Contribution recorded atomically' });
                });
                stmt.finalize();
            });
        });
    });
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

// Get all transactions for a group
app.get('/api/groups/:id/transactions', (req, res) => {
    const groupId = req.params.id;
    const query = `
        SELECT t.*, m.name as memberName, m.phone as memberPhone
        FROM transactions t
        JOIN members m ON t.memberId = m.id
        WHERE m.group_id = ?
        ORDER BY t.created_at DESC
    `;
    db.all(query, [groupId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ==========================================
// REPORTS & ANALYTICS API
// ==========================================

// Loan Repayment Tracking
app.get('/api/reports/loan-tracking', (req, res) => {
    const { month } = req.query; // YYYY-MM
    const startDate = `${month}-01`;
    // Calculate end date (last day of month)
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${lastDay}`;

    // 1. Get all active loans
    // Note: In a real system, we'd filter by loans active DURING this period.
    // For simplicity, we take all loans that have a balance > 0 OR were paid off this month.
    const query = `
        SELECT l.id, l.member_id, l.principal_amount, l.loan_type, l.due_date, l.status,
               m.name as memberName, m.phone as memberPhone
        FROM loans l
        JOIN members m ON l.member_id = m.id
        WHERE l.status != 'written_off'
    `;

    db.all(query, [], (err, loans) => {
        if (err) return res.status(500).json({ error: err.message });

        const results = [];
        let pending = loans.length;

        if (pending === 0) return res.json([]);

        loans.forEach(loan => {
            // 2. Calculate Expected Payment (Simple Proxy: 20% of principal for STL, 5% LTL)
            // Real logic requires an amortization schedule table
            let monthlyRepayment = 0;
            if (loan.loan_type === 'STL') monthlyRepayment = loan.principal_amount * 0.2; // 5 months
            else if (loan.loan_type === 'LTL') monthlyRepayment = loan.principal_amount * 0.05; // 20 months
            else monthlyRepayment = loan.principal_amount; // Emergency - full amount

            // 3. Get total paid THIS MONTH for this loan
            db.get(`
                SELECT SUM(COALESCE(stl_repayment,0) + COALESCE(ltl_repayment,0)) as paid 
                FROM transactions 
                WHERE memberId = ? 
                AND date(created_at) BETWEEN ? AND ?
            `, [loan.member_id, startDate, endDate], (err, row) => {

                const paidThisMonth = row?.paid || 0;

                // 4. Calculate Status
                let status = 'Overdue';
                let arrears = 0;

                // Thresholds
                const tolerance = 100; // Allow small difference

                if (paidThisMonth >= (monthlyRepayment - tolerance)) {
                    status = 'Paid';
                    arrears = 0;
                } else if (paidThisMonth > 0) {
                    status = 'Partial';
                    arrears = monthlyRepayment - paidThisMonth;
                } else {
                    status = 'Overdue';
                    arrears = monthlyRepayment;
                }

                // Override for fully paid loans (balance check would go here if we tracked historical balance)

                results.push({
                    id: loan.id,
                    memberId: loan.member_id,
                    memberName: loan.memberName,
                    memberPhone: loan.memberPhone,
                    loanType: loan.loan_type,
                    monthlyRepayment,
                    paidThisMonth,
                    remainingBalance: 0, // Need to fetch current balance from member or loan
                    arrears,
                    status,
                    dueDate: loan.due_date
                });

                pending--;
                if (pending === 0) {
                    // Fetch current balance for each to finalize
                    const memberIds = results.map(r => r.memberId);
                    db.all(`SELECT id, active_loan_balance FROM members WHERE id IN (${memberIds.join(',')})`, [], (err, balances) => {
                        results.forEach(r => {
                            const b = balances.find(x => x.id === r.memberId);
                            r.remainingBalance = b ? b.active_loan_balance : 0;
                            // If balance is 0, they are Paid regardless of monthly target
                            if (r.remainingBalance <= 0) {
                                r.status = 'Paid';
                                r.arrears = 0;
                            }
                        });
                        res.json(results);
                    });
                }
            });
        });
    });
});

app.get('/api/reports/loan-repayment-pdf', authenticateToken, async (req, res) => {
    const { month, groupId, type } = req.query;
    try {
        const buffer = await reportService.generateLoanRepaymentReport(month, groupId, type);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Loan_Repayment_${month}.pdf`);
        res.send(buffer);
    } catch (error) {
        console.error("PDF Gen Error:", error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/officers', authenticateToken, isAdmin, (req, res) => {
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
app.post('/api/officers/:id/reset-password', authenticateToken, isAdmin, (req, res) => {
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
app.post('/api/officers/:id/groups', authenticateToken, isAdmin, (req, res) => {
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

// Delete Officer - ADMIN ONLY
app.delete('/api/officers/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM officers WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});


// ==========================================
// REPORTS API (PDF)
// ==========================================

// Meeting Minutes PDF
app.get('/api/reports/meeting/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const pdfBuffer = await reportService.generateMeetingMinutes(sessionId);

        res.setHeader('Content-Type', 'application/json'); // Dummy for now if errors
        res.setHeader('Content-Disposition', `attachment; filename=meeting_minutes_${sessionId}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Member Statement PDF (Institutional Grade)
app.get('/api/reports/member/:memberId', authenticateToken, async (req, res) => {
    try {
        const { memberId } = req.params;
        const { startDate, endDate } = req.query;
        const pdfBuffer = await reportService.generateMemberStatement(memberId, startDate, endDate);

        // Audit Logging
        db.run(`INSERT INTO export_logs (user_id, member_id, export_type, date_range) VALUES (?, ?, 'PDF', ?)`,
            [req.user.id, memberId, `${startDate || 'Start'} - ${endDate || 'End'}`]);
        logAudit(`Export Statement (PDF): Member ${memberId}`, 'audit', { memberId, startDate, endDate }, req.user.id);

        res.setHeader('Content-Disposition', `attachment; filename=member_statement_${memberId}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate professional statement' });
    }
});

// Member Statement Excel (Data Analysis)
app.get('/api/reports/member/:memberId/excel', authenticateToken, async (req, res) => {
    try {
        const { memberId } = req.params;
        const { startDate, endDate } = req.query;
        const excelBuffer = await reportService.generateMemberExcel(memberId, startDate, endDate);

        // Audit Logging
        db.run(`INSERT INTO export_logs (user_id, member_id, export_type, date_range) VALUES (?, ?, 'EXCEL', ?)`,
            [req.user.id, memberId, `${startDate || 'Start'} - ${endDate || 'End'}`]);
        logAudit(`Export Statement (Excel): Member ${memberId}`, 'audit', { memberId, startDate, endDate }, req.user.id);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=member_statement_${memberId}.xlsx`);
        res.send(excelBuffer);
    } catch (error) {
        console.error('Excel Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate analysis workbook' });
    }
});

// Dividend Report PDF
app.get('/api/reports/dividends/:runId', authenticateToken, async (req, res) => {
    try {
        const { runId } = req.params;
        const pdfBuffer = await reportService.generateDividendReport(runId);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=dividend_report_${runId}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Dividend PDF Error:', error);
        res.status(500).json({ error: 'Failed to generate dividend PDF' });
    }
});

app.get('/api/reports/compliance', authenticateToken, async (req, res) => {
    try {
        const { month, groupId } = req.query;
        const pdfBuffer = await reportService.generateContributionComplianceReport(month, groupId);

        res.setHeader('Content-Disposition', `attachment; filename=compliance_report_${month}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Compliance PDF Error:', error);
        res.status(500).json({ error: 'Failed to generate compliance PDF' });
    }
});

app.get('/api/reports/loan-repayments', authenticateToken, async (req, res) => {
    try {
        const { month, groupId, type } = req.query;
        const pdfBuffer = await reportService.generateLoanRepaymentReport(month, groupId, type);

        res.setHeader('Content-Disposition', `attachment; filename=loan_repayment_report_${month}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
    } catch (error) {
        console.error('Loan Repayment PDF Error:', error);
        res.status(500).json({ error: 'Failed to generate loan repayment PDF' });
    }
});

// ==========================================
// FINANCIAL REPORTS API
// ==========================================

// 1. Balance Sheet (Snapshot)
app.get('/api/reports/financial/balance-sheet', authenticateToken, isAdmin, (req, res) => {
    const date = req.query.date || new Date().toISOString();

    const query = `
        SELECT 
            -- Assets
            (SELECT SUM(current_savings) FROM members) as total_cash_asset_proxy, -- Assuming fully cash backed for now
            (SELECT SUM(active_loan_balance) FROM members) as total_loans_portfolio,
            
            -- Liabilities (Member Deposits)
            (SELECT SUM(current_savings) FROM members) as total_member_savings,
            
            -- Equity (Retained Earnings - Proxy)
            (SELECT SUM(loan_interest + fines) FROM transactions) as retained_earnings
    `;

    db.get(query, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        // Construct standard accounting JSON
        const balanceSheet = {
            asOf: date,
            assets: {
                cashAtHand: row.total_cash_asset_proxy || 0, // In reality, this should be tracked separately via cash_log
                loansPortfolio: row.total_loans_portfolio || 0,
                totalAssets: (row.total_cash_asset_proxy || 0) + (row.total_loans_portfolio || 0)
            },
            liabilities: {
                memberSavings: row.total_member_savings || 0,
                totalLiabilities: row.total_member_savings || 0
            },
            equity: {
                retainedEarnings: row.retained_earnings || 0,
                totalEquity: row.retained_earnings || 0
            }
        };
        // Verify A = L + E integrity (Gap analysis)
        balanceSheet.integrityCheck = balanceSheet.assets.totalAssets - (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity);

        res.json(balanceSheet);
    });
});

// 2. Income Statement (Period)
app.get('/api/reports/financial/income-statement', authenticateToken, isAdmin, (req, res) => {
    const { startDate, endDate } = req.query;
    // Defaults to current year if not specified
    const start = startDate || `${new Date().getFullYear()}-01-01`;
    const end = endDate || new Date().toISOString();

    const query = `
        SELECT 
            SUM(loan_interest) as interest_income,
            SUM(fines) as fee_income,
            0 as expense_proxy -- Placeholder
        FROM transactions 
        WHERE created_at BETWEEN ? AND ?
    `;

    db.get(query, [start, end], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const incomeStatement = {
            period: { start, end },
            revenue: {
                interestIncome: row.interest_income || 0,
                feesAndPenalties: row.fee_income || 0,
                totalRevenue: (row.interest_income || 0) + (row.fee_income || 0)
            },
            expenses: {
                operatingExpenses: 0, // Needs expense tracking table
                totalExpenses: 0
            },
            netIncome: (row.interest_income || 0) + (row.fee_income || 0)
        };
        res.json(incomeStatement);
    });
});

// 3. Daily Cash Flow (Reconciliation Support)
app.get('/api/reports/financial/daily-cash-flow', (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Better Query
    const betterQuery = `
        SELECT 
            SUM(savings_amount) as savings_in,
            SUM(stl_repayment + ltl_repayment + loan_interest + fines) as loan_repayment_in,
            SUM(withdrawals) as withdrawals_out,
            SUM(loans_issued) as loans_out
        FROM transactions 
        WHERE date(created_at) = date(?)
    `;

    db.get(betterQuery, [date], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const flow = {
            date,
            cashIn: {
                savings: row.savings_in || 0,
                repayments: row.loan_repayment_in || 0,
                total: (row.savings_in || 0) + (row.loan_repayment_in || 0)
            },
            cashOut: {
                withdrawals: row.withdrawals_out || 0,
                disbursements: row.loans_out || 0,
                total: (row.withdrawals_out || 0) + (row.loans_out || 0)
            },
            netFlow: ((row.savings_in || 0) + (row.loan_repayment_in || 0)) - ((row.withdrawals_out || 0) + (row.loans_out || 0))
        };
        res.json(flow);
    });
});


// ==========================================
// UKOMBOZI PARTNERSHIP MODEL API
// ==========================================

// 1. Company Top-Up (Investment)
app.post('/api/partnership/top-up', authenticateToken, isAdmin, (req, res) => {
    const { groupId, amount, notes } = req.body;
    db.run(
        "INSERT INTO company_investments (group_id, amount, notes) VALUES (?, ?, ?)",
        [groupId, amount, notes],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Company Top-Up: ${amount}`, 'partnership', { groupId, amount }, 1); // Admin
            res.json({ success: true, id: this.lastID });
        }
    );
});

// 2. Group Commitment Deposit
app.post('/api/partnership/commitment-deposit', authenticateToken, isAdmin, (req, res) => {
    const { groupId, amount, notes } = req.body;
    db.run(
        "INSERT INTO group_commitments (group_id, amount, notes) VALUES (?, ?, ?)",
        [groupId, amount, notes],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Group Commitment: ${amount}`, 'partnership', { groupId, amount }, 1);
            res.json({ success: true, id: this.lastID });
        }
    );
});

// 3. Issue Product (Asset Financing)
app.post('/api/partnership/issue-product', authenticateToken, isAdmin, (req, res) => {
    const { memberId, productName, totalValue, commitmentPaid, monthlyInstallment } = req.body;
    const financedAmount = totalValue - commitmentPaid;

    db.run(
        `INSERT INTO product_financing 
        (member_id, product_name, total_value, commitment_paid, financed_amount, monthly_installment)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [memberId, productName, totalValue, commitmentPaid, financedAmount, monthlyInstallment],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Product Issued: ${productName}`, 'partnership', { memberId, financedAmount }, 1);
            res.json({ success: true, id: this.lastID });
        }
    );
});

// 4. Get Partnership Exposure Report
app.get('/api/partnership/exposure/:groupId', (req, res) => {
    const { groupId } = req.params;

    // Get Top-Ups
    db.all("SELECT * FROM company_investments WHERE group_id = ?", [groupId], (err, investments) => {
        if (err) return res.status(500).json({ error: err.message });

        // Get Commitments
        db.all("SELECT * FROM group_commitments WHERE group_id = ?", [groupId], (err, commitments) => {
            if (err) return res.status(500).json({ error: err.message });

            const totalTopUp = investments.reduce((sum, inv) => sum + inv.amount, 0);
            const totalCommitment = commitments.reduce((sum, com) => sum + com.amount, 0);

            res.json({
                groupId,
                portfolio: {
                    totalTopUp,
                    investments
                },
                security: {
                    totalCommitment,
                    commitments
                },
                netExposure: totalTopUp - totalCommitment
            });
        });
    });
});

// 5. Apply Commitment Offset (Auto-Offset Logic)
app.post('/api/partnership/apply-offset', authenticateToken, isAdmin, (req, res) => {
    const { memberId, amount, notes } = req.body;

    // 1. Get Member's Group
    db.get("SELECT group_id FROM members WHERE id = ?", [memberId], (err, memberProto) => {
        if (err || !memberProto) return res.status(404).json({ error: "Member not found" });
        const groupId = memberProto.group_id;

        // 2. Check Available Commitment
        db.all("SELECT * FROM group_commitments WHERE group_id = ? AND status = 'LOCKED'", [groupId], (err, commitments) => {
            if (err) return res.status(500).json({ error: err.message });

            const totalLocked = commitments.reduce((sum, c) => sum + c.amount, 0);
            if (totalLocked < amount) {
                return res.status(400).json({ error: `Insufficient Commitment Balance. Available: KES ${totalLocked}` });
            }

            // 3. Apply Offset (Transaction)
            // Credit Member's Loan
            const txnDate = new Date().toISOString();
            db.run(`INSERT INTO transactions 
                (session_id, member_id, transaction_type, amount, loan_interest, loan_principal, stl_repayment, ltl_repayment, date, created_at)
                VALUES (?, ?, 'COMMITMENT_OFFSET', ?, 0, ?, ?, ?, ?, ?)`,
                ['SYSTEM-OFFSET', memberId, amount, amount, amount, amount, txnDate, txnDate], // Simplified: treating as generic repayment
                (err) => {
                    if (err) return res.status(500).json({ error: "Failed to post loan credit" });

                    // 4. Deduct from Commitment (Add a negative entry or update status)
                    // We'll add a negative entry with status 'APPLIED' to track usage history
                    db.run("INSERT INTO group_commitments (group_id, amount, status, notes) VALUES (?, ?, 'APPLIED', ?)",
                        [groupId, -amount, `Offset for Member #${memberId}: ${notes}`],
                        (err) => {
                            if (err) console.error("Commitment Deduct Error", err); // Non-fatal but bad

                            logAudit(`Commitment Offset Applied: ${amount}`, 'partnership', { memberId, groupId, amount }, 1);
                            res.json({ success: true, message: "Commitment Offset Successful" });
                        }
                    );
                }
            );
        });
    });
});

// 6. Download Partnership Statement PDF
app.get('/api/reports/partnership/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const buffer = await reportService.generatePartnershipStatement(groupId);

        res.setHeader('Content-Disposition', `attachment; filename=partnership_statement_${groupId}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
    } catch (error) {
        console.error("Partnership PDF Error:", error);
        res.status(500).json({ error: error.message || "Failed to generate PDF" });
    }
});

// 7. Get Group Relationship Score (Trust Level)
app.get('/api/partnership/score/:groupId', (req, res) => {
    const { groupId } = req.params;

    // Fetch data for scoring
    const queries = {
        topups: "SELECT SUM(amount) as val FROM company_investments WHERE group_id = ? AND status = 'ACTIVE'",
        commitments: "SELECT SUM(amount) as val FROM group_commitments WHERE group_id = ? AND status = 'LOCKED'",
        lastRepayment: "SELECT created_at FROM transactions t JOIN members m ON t.member_id = m.id WHERE m.group_id = ? AND t.transaction_type IN ('LOAN_REPAYMENT', 'STL_REPAYMENT', 'LTL_REPAYMENT') ORDER BY t.created_at DESC LIMIT 1"
    };

    const runQ = (q) => new Promise((res, rej) => db.get(q, [groupId], (e, r) => e ? rej(e) : res(r)));

    Promise.all([
        runQ(queries.topups),
        runQ(queries.commitments),
        runQ(queries.lastRepayment)
    ]).then(([topups, commitments, lastRepay]) => {
        const topUpVal = topups?.val || 0;
        const commitmentVal = commitments?.val || 0;

        let score = 0;
        let reasons = [];

        // 1. Commitment Coverage (Weighted 60%)
        if (topUpVal === 0) {
            score += 60; // No debt = baseline 60
            reasons.push("Zero Company Debt");
        } else {
            const ratio = (commitmentVal / topUpVal) * 100;
            const contrib = Math.min(60, (ratio / 50) * 60); // 50% coverage gives full 60 points
            score += contrib;
            reasons.push(`Commitment Coverage: ${ratio.toFixed(1)}%`);
        }

        // 2. Repayment Recency (Weighted 40%)
        if (lastRepay) {
            const lastDate = new Date(lastRepay.created_at);
            const daysSince = (new Date() - lastDate) / (1000 * 60 * 60 * 24);
            if (daysSince <= 31) {
                score += 40;
                reasons.push("Active Repayment Month (On Schedule)");
            } else if (daysSince <= 60) {
                score += 20;
                reasons.push("Last Repayment within 60 days");
            } else {
                reasons.push("Warning: No recent repayments");
            }
        } else {
            reasons.push("No repayment history found");
        }

        res.json({
            groupId,
            score: Math.round(score),
            label: score >= 80 ? "EXCELLENT" : score >= 60 ? "GOOD" : score >= 40 ? "FAIR" : "RISKY",
            reasons
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

// ==========================================
// PROJECT SAVINGS API (EDUCATION & AGRICULTURE)
// ==========================================

/**
 * GET MEMBER PROJECT SAVINGS DAILY LIMIT
 * Returns how much the member can save in projects today 
 * based on their table savings for that day.
 */
app.get('/api/projects/member-day-limit/:memberId/:date', authenticateToken, (req, res) => {
    const { memberId, date } = req.params;
    const formattedDate = date || new Date().toISOString().split('T')[0];

    const savingsQuery = `
        SELECT COALESCE(SUM(savings_amount), 0) as total_savings 
        FROM transactions 
        WHERE member_id = ? AND date(date) = date(?)
    `;

    db.get(savingsQuery, [memberId, formattedDate], (err, sRow) => {
        if (err) return res.status(500).json({ error: err.message });
        const todayTableSavings = sRow.total_savings;

        const proQuery = `
            SELECT COALESCE(SUM(ps.amount), 0) as total_pro 
            FROM project_savings ps
            JOIN project_registrations pr ON ps.registration_id = pr.id
            WHERE pr.member_id = ? AND date(ps.date) = date(?)
        `;

        db.get(proQuery, [memberId, formattedDate], (err, pRow) => {
            if (err) return res.status(500).json({ error: err.message });
            const todayExistingProjectSavings = pRow.total_pro;

            res.json({
                daily_limit: todayTableSavings,
                already_saved: todayExistingProjectSavings,
                remaining_limit: Math.max(0, todayTableSavings - todayExistingProjectSavings)
            });
        });
    });
});

/**
 * Register a member for a project
 * Window: Jan - March
 * Fee: 200 KES
 */
app.post('/api/projects/register', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { member_id, project_type } = req.body;
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentYear = new Date().getFullYear();

    if (currentMonth > 3) {
        return res.status(403).json({ error: 'Registration period closed (Jan-Mar only)' });
    }

    if (!member_id || !project_type) {
        return res.status(400).json({ error: 'Member ID and project type are required' });
    }

    const upperProjectType = project_type.toUpperCase();

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Check if already registered
        db.get("SELECT id FROM project_registrations WHERE member_id = ? AND project_type = ? AND year = ?", [member_id, upperProjectType, currentYear], (err, row) => {
            if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
            if (row) { db.run("ROLLBACK"); return res.status(400).json({ error: 'Member already registered for this project this year' }); }

            // 2. Record Registration
            const regStmt = db.prepare("INSERT INTO project_registrations (member_id, project_type, year) VALUES (?, ?, ?)");
            regStmt.run(member_id, upperProjectType, currentYear, function (err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                const regId = this.lastID;

                // 3. Record Company Revenue (The fee)
                const fee_desc = `Fee for ${upperProjectType} project registration`;
                const revStmt = db.prepare("INSERT INTO company_revenue (source, amount, member_id, description) VALUES (?, ?, ?, ?)");
                revStmt.run('PROJECT_REGISTRATION_FEE', 200, member_id, fee_desc, (err) => {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }

                    // 4. Record as Table CASH OUT
                    const transStmt = db.prepare("INSERT INTO transactions (memberId, transaction_type, description, withdrawals, status) VALUES (?, 'OUT', ?, 200, 'PENDING')");
                    transStmt.run(member_id, fee_desc, async function (err) {
                        if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                        const transId = this.lastID;
                        db.run("COMMIT");

                        logAndSendSMS(member_id, `Project Reg: ${upperProjectType} confirmed. Fee 200.`, 'FINANCIAL', transId);
                        res.json({ success: true, registration_id: regId, message: "Project registration successful" });
                    });
                    transStmt.finalize();
                });
                revStmt.finalize();
            });
            regStmt.finalize();
        });
    });
});

/**
 * Post project savings
 * Window: Jan - August
 * Rule: Combined project savings <= daily table saving
 */
app.post('/api/projects/save', authenticateToken, checkFreeze('GROUP'), (req, res) => {
    const { registration_id, amount, date } = req.body;
    const saveDate = date ? new Date(date) : new Date();
    const saveMonth = saveDate.getMonth() + 1;

    if (saveMonth > 8) {
        return res.status(403).json({ error: 'Savings period closed (Jan-Aug only)' });
    }

    if (!registration_id || !amount) {
        return res.status(400).json({ error: 'Registration ID and amount are required' });
    }

    db.get("SELECT member_id, project_type FROM project_registrations WHERE id = ?", [registration_id], (err, reg) => {
        if (err || !reg) return res.status(404).json({ error: 'Registration not found' });

        const member_id = reg.member_id;
        const formattedDate = saveDate.toISOString().split('T')[0];

        // CHECK DAILY LIMIT: Combined project savings <= today's table savings
        // First get today's savings for this member from the transactions table
        // NOTE: Standard Table Savings are in savings_amount columns in transactions table
        const savingsQuery = `
            SELECT COALESCE(SUM(savings_amount), 0) as total_savings 
            FROM transactions 
            WHERE memberId = ? AND date(created_at) = date(?)
        `;

        db.get(savingsQuery, [member_id, formattedDate], (err, sRow) => {
            if (err) return res.status(500).json({ error: err.message });

            const todayTableSavings = sRow.total_savings;

            // Get existing project savings for today
            const proQuery = `
                SELECT COALESCE(SUM(ps.amount), 0) as total_pro 
                FROM project_savings ps
                JOIN project_registrations pr ON ps.registration_id = pr.id
                WHERE pr.member_id = ? AND date(ps.date) = date(?)
            `;

            db.get(proQuery, [member_id, formattedDate], (err, pRow) => {
                if (err) return res.status(500).json({ error: err.message });

                const todayExistingProjectSavings = pRow.total_pro;
                const newTotal = todayExistingProjectSavings + amount;

                if (newTotal > todayTableSavings) {
                    return res.status(400).json({
                        error: `Limit exceeded. Total project savings (${newTotal}) cannot exceed daily table savings (${todayTableSavings}).`
                    });
                }

                // CHECK CUMULATIVE LIMIT: Max 2000 per project
                db.get("SELECT COALESCE(SUM(amount), 0) as total_saved FROM project_savings WHERE registration_id = ?", [registration_id], (err, cRow) => {
                    if (err) return res.status(500).json({ error: err.message });
                    const cumulativeSaved = cRow.total_saved;
                    if (cumulativeSaved + amount > 2000) {
                        return res.status(400).json({
                            error: `Project limit reached. Cumulative savings cannot exceed KES 2,000 per project. Current: KES ${cumulativeSaved}.`
                        });
                    }

                    // Proceed with save
                    db.serialize(() => {
                        db.run("BEGIN TRANSACTION");

                        const stmt = db.prepare("INSERT INTO project_savings (registration_id, amount, date) VALUES (?, ?, ?)");
                        stmt.run(registration_id, amount, formattedDate, function (err) {
                            if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                            const psId = this.lastID;

                            // Create Ledger Transaction for accountability
                            const txStmt = db.prepare("INSERT INTO transactions (memberId, savings_amount, description, transaction_type, status) VALUES (?, ?, ?, 'ProjectSaving', 'PENDING')");
                            txStmt.run(member_id, amount, `Project Savings: ${reg.project_type}`, async function (txErr) {
                                if (txErr) { db.run("ROLLBACK"); return res.status(500).json({ error: txErr.message }); }
                                const transId = this.lastID;

                                db.run("COMMIT");
                                logAudit(`Project Savings`, 'member', { member_id, amount, project: reg.project_type });

                                const smsMsg = `UKOMBOZI: Project Savings for ${reg.project_type} of KES ${amount} confirmed. Ref: ${transId}.`;
                                await logAndSendSMS(member_id, smsMsg, 'FINANCIAL', transId);

                                res.json({ success: true, id: psId, transaction_id: transId });
                            });
                            txStmt.finalize();
                        });
                        stmt.finalize();
                    });
                });
            });
        });
    });
});

/**
 * Project Payout (150%)
 * Window: January ONLY
 */
app.post('/api/projects/payout', authenticateToken, isAdmin, checkFreeze('GROUP'), (req, res) => {
    const { registration_id } = req.body;
    const currentMonth = new Date().getMonth() + 1;

    if (currentMonth !== 1) {
        return res.status(403).json({ error: 'NO MERCY: Payout Protocol Violation. Project Maturity Payouts are strictly limited to the January Window.' });
    }

    db.get(`
        SELECT pr.*, m.group_id, m.name as member_name, 
               COALESCE(SUM(ps.amount), 0) as total_principal 
        FROM project_registrations pr 
        JOIN members m ON pr.member_id = m.id 
        LEFT JOIN project_savings ps ON pr.id = ps.registration_id 
        WHERE pr.id = ? AND ps.status != 'PAID'
        GROUP BY pr.id
    `, [registration_id], (err, details) => {
        if (err || !details || details.total_principal === 0) {
            return res.status(404).json({ error: 'No eligible savings found for payout' });
        }

        const payoutAmount = details.total_principal * 1.5;
        const interestCost = payoutAmount - details.total_principal;

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // 1. Record Transaction (Payout as Withdrawal/Cash Out)
            const stmt = db.prepare(`
                INSERT INTO transactions (
                    memberId, transaction_type, description, withdrawals, status
                ) VALUES (?, 'PROJECT_PAYOUT', ?, ?, 'PENDING')
            `);
            stmt.run(details.member_id, `${details.project_type} Payout (Principal: ${details.total_principal})`, payoutAmount, async function (err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                const transId = this.lastID;

                // 2. Update status to PAID
                db.run("UPDATE project_savings SET status = 'PAID', payout_status = 'COMPLETED' WHERE registration_id = ?", [registration_id], async (err) => {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }

                    // 3. Update Member Balance (Optional, usually project savings are tracked separately)
                    // But if we want to reflect it in savings balance history, we can. 
                    // Usually payouts are handed over in cash.

                    db.run("COMMIT");
                    logAudit(`Project Payout: ${details.project_type}`, 'finance', { member_id: details.member_id, amount: payoutAmount });

                    const smsMsg = `UKOMBOZI: ${details.project_type} Payout Received KES ${payoutAmount.toLocaleString()}. Principal: ${details.total_principal}. Thank you!`;
                    await logAndSendSMS(details.member_id, smsMsg, 'PROJECT_PAYOUT', transId);

                    res.json({ success: true, payoutAmount, principal: details.total_principal, interest: interestCost, transaction_id: transId });
                });
            });
            stmt.finalize();
        });
    });
});

/**
 * Get Project Stats for a Group (Pool visibility)
 */
app.get('/api/projects/group-stats/:groupId', authenticateToken, (req, res) => {
    const { groupId } = req.params;

    // Deep Financial Analytics Query
    const query = `
        SELECT 
            (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id JOIN members m ON pr.member_id = m.id WHERE m.group_id = ?) as total_project_pool,
            (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id JOIN members m ON pr.member_id = m.id WHERE m.group_id = ? AND pr.project_type = 'EDUCATION') as education_pool,
            (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id JOIN members m ON pr.member_id = m.id WHERE m.group_id = ? AND pr.project_type = 'AGRICULTURE') as agriculture_pool,
            (SELECT COALESCE(SUM(current_savings), 0) FROM members WHERE group_id = ?) as total_table_savings,
            (SELECT COALESCE(SUM(active_loan_balance), 0) FROM members WHERE group_id = ?) as total_active_loans,
            (SELECT COUNT(DISTINCT member_id) FROM project_registrations pr JOIN members m ON pr.member_id = m.id WHERE m.group_id = ?) as members_in_projects,
            (SELECT COUNT(*) FROM members WHERE group_id = ?) as total_members
    `;

    db.get(query, [groupId, groupId, groupId, groupId, groupId, groupId, groupId], (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });

        const totalProjectPool = stats.total_project_pool;
        const payoutObligation = totalProjectPool * 1.5;
        const totalTablePool = stats.total_table_savings + totalProjectPool;
        const availableLiquidity = totalTablePool - stats.total_active_loans;

        // Risk Profile Calculation
        let liquidityAlert = 'SAFE';
        if (availableLiquidity < payoutObligation) {
            liquidityAlert = 'WARNING';
        }
        if (availableLiquidity < payoutObligation * 0.7) {
            liquidityAlert = 'RISK';
        }
        if (availableLiquidity < payoutObligation * 0.3) {
            liquidityAlert = 'CRITICAL';
        }

        res.json({
            pools: [
                { project_type: 'EDUCATION', pool_total: stats.education_pool },
                { project_type: 'AGRICULTURE', pool_total: stats.agriculture_pool }
            ],
            total_project_pool: totalProjectPool,
            total_table_savings: stats.total_table_savings,
            total_active_loans: stats.total_active_loans,
            payout_obligation: payoutObligation,
            available_cash: availableLiquidity,
            liquidity_alert: liquidityAlert,
            participation_rate: stats.total_members > 0 ? (stats.members_in_projects / stats.total_members * 100) : 0,
            loan_utilization: totalTablePool > 0 ? (stats.total_active_loans / totalTablePool * 100) : 0
        });
    });
});

// Redundant partnership routes removed - moved to routes/partnership.js

// ============================================================================
// 🏦 CONTRIBUTION ENGINE - Financial Approval & Posting System
// ============================================================================

// Generate unique transaction reference
function generateTransactionRef(type) {
    const prefix = type.toUpperCase().substring(0, 3);
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TRX-${prefix}-${timestamp}-${random}`;
}

// Ledger routing configuration per contribution type
const LEDGER_ROUTING = {
    savings: {
        entries: [
            { account: 'member_savings', direction: 'CREDIT', description: 'Member savings increase' },
            { account: 'group_cash', direction: 'DEBIT', description: 'Cash received' }
        ],
        affectsBalance: 'savings_balance',
        riskImpact: -5 // Reduces risk (good)
    },
    welfare: {
        entries: [
            { account: 'member_welfare', direction: 'CREDIT', description: 'Member welfare contribution' },
            { account: 'group_welfare_fund', direction: 'CREDIT', description: 'Group welfare pool increase' },
            { account: 'group_cash', direction: 'DEBIT', description: 'Cash received' }
        ],
        affectsBalance: 'welfare_balance',
        riskImpact: 0
    },
    project: {
        entries: [
            { account: 'member_project', direction: 'CREDIT', description: 'Member project contribution' },
            { account: 'group_project_pool', direction: 'CREDIT', description: 'Project pool increase' },
            { account: 'group_cash', direction: 'DEBIT', description: 'Cash received' }
        ],
        affectsBalance: 'project_balance',
        riskImpact: 0
    },
    registration: {
        entries: [
            { account: 'group_registration_income', direction: 'CREDIT', description: 'Registration fee' },
            { account: 'group_cash', direction: 'DEBIT', description: 'Cash received' }
        ],
        affectsBalance: null,
        riskImpact: 0
    },
    appreciation: {
        entries: [
            { account: 'group_appreciation_income', direction: 'CREDIT', description: 'Appreciation fee' },
            { account: 'group_cash', direction: 'DEBIT', description: 'Cash received' }
        ],
        affectsBalance: null,
        riskImpact: 0
    }
};

// POST /api/contributions/validate - Phase 1: Validation & Preview
app.post('/api/contributions/validate', authenticateToken, (req, res) => {
    const { memberId, groupId, sessionId, contributionType, amount, paymentMethod } = req.body;
    const officerId = req.user.id;
    const validationErrors = [];

    // Basic validation
    if (!memberId) validationErrors.push('Member ID is required');
    if (!groupId) validationErrors.push('Group ID is required');
    if (!contributionType) validationErrors.push('Contribution type is required');
    if (!amount || amount <= 0) validationErrors.push('Amount must be greater than 0');

    const normalizedType = (contributionType || '').toLowerCase().replace(/\s+/g, '_');
    const validTypes = ['savings', 'welfare', 'project', 'registration', 'appreciation', 'monthly_saving'];

    // Map monthly_saving to savings
    const mappedType = normalizedType === 'monthly_saving' ? 'savings' : normalizedType;

    if (!validTypes.includes(normalizedType) && normalizedType !== 'monthly_saving') {
        validationErrors.push(`Invalid contribution type: ${contributionType}`);
    }

    if (validationErrors.length > 0) {
        return res.json({ valid: false, validationErrors, preview: null });
    }

    // Fetch current member data for preview
    db.get(`
        SELECT m.id, m.name, m.group_id, m.risk_score,
               COALESCE(m.savings_balance, 0) as savings_balance,
               COALESCE(m.welfare_balance, 0) as welfare_balance,
               COALESCE(m.project_balance, 0) as project_balance,
               g.name as group_name, g.status as group_status
        FROM members m
        LEFT JOIN groups g ON m.group_id = g.id
        WHERE m.id = ?
    `, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.json({ valid: false, validationErrors: ['Member not found'], preview: null });

        // Check group status
        if (member.group_status === 'frozen') {
            return res.json({ valid: false, validationErrors: ['Group is frozen - no transactions allowed'], preview: null });
        }

        // Calculate preview based on contribution type
        const routing = LEDGER_ROUTING[mappedType] || LEDGER_ROUTING.savings;
        const numAmount = parseFloat(amount);

        const preview = {
            member_name: member.name,
            group_name: member.group_name,
            contribution_type: mappedType,
            amount: numAmount,
            savings_before: member.savings_balance,
            savings_after: mappedType === 'savings' ? member.savings_balance + numAmount : member.savings_balance,
            welfare_before: member.welfare_balance,
            welfare_after: mappedType === 'welfare' ? member.welfare_balance + numAmount : member.welfare_balance,
            project_before: member.project_balance,
            project_after: mappedType === 'project' ? member.project_balance + numAmount : member.project_balance,
            risk_score_before: member.risk_score || 50,
            risk_score_after: Math.max(0, Math.min(100, (member.risk_score || 50) + routing.riskImpact)),
            ledger_entries: routing.entries.map(e => ({
                ...e,
                amount: numAmount
            })),
            officer_id: officerId,
            payment_method: paymentMethod || 'cash'
        };

        res.json({
            valid: true,
            validationErrors: [],
            preview
        });
    });
});

// POST /api/contributions/post - Phase 2: Atomic Posting
app.post('/api/contributions/post', authenticateToken, (req, res) => {
    const { memberId, groupId, sessionId, contributionType, amount, paymentMethod, description } = req.body;
    const officerId = req.user.id;
    const numAmount = parseFloat(amount);

    // Normalize contribution type
    const normalizedType = (contributionType || '').toLowerCase().replace(/\s+/g, '_');
    const mappedType = normalizedType === 'monthly_saving' ? 'savings' : normalizedType;

    // Validate
    if (!memberId || !groupId || !mappedType || !numAmount || numAmount <= 0) {
        return res.status(400).json({ error: 'Invalid contribution data' });
    }

    const routing = LEDGER_ROUTING[mappedType];
    if (!routing) {
        return res.status(400).json({ error: `Unknown contribution type: ${contributionType}` });
    }

    const transactionRef = generateTransactionRef(mappedType);
    const ledgerEntriesJson = JSON.stringify(routing.entries.map(e => ({ ...e, amount: numAmount })));
    const auditMetadata = JSON.stringify({
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
        officer_name: req.user.name || req.user.email
    });

    // Start atomic transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Insert into contribution_ledger
        const insertStmt = db.prepare(`
            INSERT INTO contribution_ledger (
                transaction_ref, member_id, group_id, session_id, contribution_type,
                amount, ledger_entries, status, officer_id, payment_method,
                description, posted_at, audit_metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?, datetime('now'), ?)
        `);

        insertStmt.run(
            transactionRef, memberId, groupId, sessionId || null, mappedType,
            numAmount, ledgerEntriesJson, officerId, paymentMethod || 'cash',
            description || `${mappedType} contribution`, auditMetadata,
            function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('Contribution insert error:', err);
                    return res.status(500).json({ error: 'Failed to create contribution record' });
                }

                const ledgerId = this.lastID;

                // 2. Update member balance if applicable
                if (routing.affectsBalance) {
                    db.run(
                        `UPDATE members SET ${routing.affectsBalance} = COALESCE(${routing.affectsBalance}, 0) + ? WHERE id = ?`,
                        [numAmount, memberId],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('Balance update error:', err);
                                return res.status(500).json({ error: 'Failed to update member balance' });
                            }

                            // 3. Update risk score
                            db.run(
                                `UPDATE members SET risk_score = MAX(0, MIN(100, COALESCE(risk_score, 50) + ?)) WHERE id = ?`,
                                [routing.riskImpact, memberId],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        console.error('Risk score update error:', err);
                                        return res.status(500).json({ error: 'Failed to update risk score' });
                                    }

                                    // 4. Commit and respond
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: 'Failed to commit transaction' });
                                        }

                                        logAudit(`Contribution Posted: ${transactionRef}`, 'transaction', {
                                            memberId, groupId, type: mappedType, amount: numAmount
                                        }, officerId);

                                        res.json({
                                            success: true,
                                            message: 'Contribution posted successfully',
                                            transaction_ref: transactionRef,
                                            ledger_id: ledgerId,
                                            amount: numAmount,
                                            type: mappedType
                                        });
                                    });
                                }
                            );
                        }
                    );
                } else {
                    // No balance to update (registration/appreciation fees)
                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to commit transaction' });
                        }

                        logAudit(`Contribution Posted: ${transactionRef}`, 'transaction', {
                            memberId, groupId, type: mappedType, amount: numAmount
                        }, officerId);

                        res.json({
                            success: true,
                            message: 'Contribution posted successfully',
                            transaction_ref: transactionRef,
                            ledger_id: ledgerId,
                            amount: numAmount,
                            type: mappedType
                        });
                    });
                }
            }
        );
        insertStmt.finalize();
    });
});

// GET /api/contributions/history/:memberId - Get contribution history for a member
app.get('/api/contributions/history/:memberId', authenticateToken, (req, res) => {
    const { memberId } = req.params;

    db.all(`
        SELECT cl.*, o.name as officer_name, g.name as group_name
        FROM contribution_ledger cl
        LEFT JOIN officers o ON cl.officer_id = o.id
        LEFT JOIN groups g ON cl.group_id = g.id
        WHERE cl.member_id = ?
        ORDER BY cl.created_at DESC
        LIMIT 50
    `, [memberId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ============================================================================
// 💸 WITHDRAWAL ENGINE - High-Risk Debit Transaction System
// ============================================================================

// Withdrawal limits and thresholds
const WITHDRAWAL_LIMITS = {
    maxSingleWithdrawal: 50000,      // Max per transaction
    minWithdrawal: 100,               // Minimum withdrawal
    reserveRatio: 0.1,               // Must keep 10% of savings as reserve
    approvalThreshold: 20000         // Requires senior approval above this
};

// POST /api/withdrawals/validate - Phase 1: Balance & Liquidity Checks
app.post('/api/withdrawals/validate', authenticateToken, (req, res) => {
    const { memberId, groupId, amount, withdrawalType } = req.body;
    const numAmount = parseFloat(amount);
    const validationErrors = [];

    // Basic validation
    if (!memberId) validationErrors.push('Member ID is required');
    if (!groupId) validationErrors.push('Group ID is required');
    if (!numAmount || numAmount <= 0) validationErrors.push('Amount must be greater than 0');
    if (numAmount < WITHDRAWAL_LIMITS.minWithdrawal) {
        validationErrors.push(`Minimum withdrawal is KES ${WITHDRAWAL_LIMITS.minWithdrawal}`);
    }
    if (numAmount > WITHDRAWAL_LIMITS.maxSingleWithdrawal) {
        validationErrors.push(`Maximum single withdrawal is KES ${WITHDRAWAL_LIMITS.maxSingleWithdrawal.toLocaleString()}`);
    }

    if (validationErrors.length > 0) {
        return res.json({ valid: false, validationErrors, preview: null });
    }

    // Fetch member balance and check liquidity
    db.get(`
        SELECT m.id, m.name, m.group_id, m.risk_score,
               COALESCE(m.savings_balance, 0) as savings_balance,
               g.name as group_name, g.status as group_status
        FROM members m
        LEFT JOIN groups g ON m.group_id = g.id
        WHERE m.id = ?
    `, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.json({ valid: false, validationErrors: ['Member not found'], preview: null });

        // Check group status
        if (member.group_status === 'frozen') {
            return res.json({ valid: false, validationErrors: ['Group is frozen - no withdrawals allowed'], preview: null });
        }

        // Check sufficient balance
        const availableBalance = member.savings_balance;
        const requiredReserve = member.savings_balance * WITHDRAWAL_LIMITS.reserveRatio;
        const maxWithdrawable = Math.max(0, availableBalance - requiredReserve);

        if (numAmount > availableBalance) {
            return res.json({
                valid: false,
                validationErrors: [`Insufficient balance. Available: KES ${availableBalance.toLocaleString()}`],
                preview: null
            });
        }

        if (numAmount > maxWithdrawable) {
            return res.json({
                valid: false,
                validationErrors: [`Cannot withdraw full balance. Must keep ${WITHDRAWAL_LIMITS.reserveRatio * 100}% reserve (KES ${requiredReserve.toFixed(0)}). Max withdrawable: KES ${maxWithdrawable.toLocaleString()}`],
                preview: null
            });
        }

        // Build preview
        const requiresApproval = numAmount > WITHDRAWAL_LIMITS.approvalThreshold;

        const preview = {
            member_name: member.name,
            group_name: member.group_name,
            withdrawal_type: withdrawalType || 'savings_withdrawal',
            amount: numAmount,
            savings_before: member.savings_balance,
            savings_after: member.savings_balance - numAmount,
            reserve_held: requiredReserve,
            max_withdrawable: maxWithdrawable,
            risk_score_before: member.risk_score || 50,
            risk_score_after: Math.max(0, Math.min(100, (member.risk_score || 50) + 3)), // Slight risk increase
            requires_approval: requiresApproval,
            approval_threshold: WITHDRAWAL_LIMITS.approvalThreshold,
            ledger_entries: [
                { account: 'member_savings', direction: 'DEBIT', amount: numAmount, description: 'Savings withdrawal' },
                { account: 'group_cash', direction: 'CREDIT', amount: numAmount, description: 'Cash disbursed' }
            ]
        };

        res.json({
            valid: true,
            validationErrors: [],
            preview
        });
    });
});

// POST /api/withdrawals/post - Phase 2: Atomic Debit Transaction
app.post('/api/withdrawals/post', authenticateToken, (req, res) => {
    const { memberId, groupId, sessionId, amount, withdrawalType, reason } = req.body;
    const officerId = req.user.id;
    const numAmount = parseFloat(amount);

    // Validate
    if (!memberId || !groupId || !numAmount || numAmount <= 0) {
        return res.status(400).json({ error: 'Invalid withdrawal data' });
    }

    // Double-check balance before proceeding
    db.get(`
        SELECT COALESCE(savings_balance, 0) as savings_balance, name 
        FROM members WHERE id = ?
    `, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const availableBalance = member.savings_balance;
        const requiredReserve = availableBalance * WITHDRAWAL_LIMITS.reserveRatio;
        const maxWithdrawable = Math.max(0, availableBalance - requiredReserve);

        if (numAmount > maxWithdrawable) {
            return res.status(400).json({
                error: `Insufficient withdrawable balance. Max: KES ${maxWithdrawable.toLocaleString()}`
            });
        }

        const transactionRef = generateTransactionRef('WDR');
        const ledgerEntriesJson = JSON.stringify([
            { account: 'member_savings', direction: 'DEBIT', amount: numAmount, description: 'Savings withdrawal' },
            { account: 'group_cash', direction: 'CREDIT', amount: numAmount, description: 'Cash disbursed' }
        ]);
        const auditMetadata = JSON.stringify({
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
            officer_name: req.user.name || req.user.email,
            reason: reason || 'Member withdrawal request',
            balance_before: availableBalance,
            balance_after: availableBalance - numAmount
        });

        // Atomic transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // 1. Insert withdrawal record into contribution_ledger (reuse table with negative for withdrawals)
            const insertStmt = db.prepare(`
                INSERT INTO contribution_ledger (
                    transaction_ref, member_id, group_id, session_id, contribution_type,
                    amount, ledger_entries, status, officer_id, payment_method,
                    description, posted_at, audit_metadata
                ) VALUES (?, ?, ?, ?, 'withdrawal', ?, ?, 'POSTED', ?, 'cash', ?, datetime('now'), ?)
            `);

            insertStmt.run(
                transactionRef, memberId, groupId, sessionId || null,
                -numAmount, // Negative to indicate withdrawal
                ledgerEntriesJson, officerId,
                reason || 'Member savings withdrawal', auditMetadata,
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('Withdrawal insert error:', err);
                        return res.status(500).json({ error: 'Failed to create withdrawal record' });
                    }

                    const ledgerId = this.lastID;

                    // 2. Debit member balance
                    db.run(
                        `UPDATE members SET savings_balance = COALESCE(savings_balance, 0) - ? WHERE id = ?`,
                        [numAmount, memberId],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('Balance debit error:', err);
                                return res.status(500).json({ error: 'Failed to debit member balance' });
                            }

                            // 3. Slight risk score increase for withdrawal
                            db.run(
                                `UPDATE members SET risk_score = MAX(0, MIN(100, COALESCE(risk_score, 50) + 3)) WHERE id = ?`,
                                [memberId],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        console.error('Risk score update error:', err);
                                        return res.status(500).json({ error: 'Failed to update risk score' });
                                    }

                                    // 4. Commit and respond
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: 'Failed to commit withdrawal' });
                                        }

                                        logAudit(`Withdrawal Posted: ${transactionRef}`, 'transaction', {
                                            memberId, groupId, amount: numAmount, type: 'withdrawal'
                                        }, officerId);

                                        res.json({
                                            success: true,
                                            message: `Withdrawal of KES ${numAmount.toLocaleString()} processed successfully`,
                                            transaction_ref: transactionRef,
                                            ledger_id: ledgerId,
                                            amount: numAmount,
                                            new_balance: availableBalance - numAmount
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            );
            insertStmt.finalize();
        });
    });
});

// GET /api/withdrawals/history/:memberId - Get withdrawal history
app.get('/api/withdrawals/history/:memberId', authenticateToken, (req, res) => {
    const { memberId } = req.params;

    db.all(`
        SELECT cl.*, o.name as officer_name, g.name as group_name
        FROM contribution_ledger cl
        LEFT JOIN officers o ON cl.officer_id = o.id
        LEFT JOIN groups g ON cl.group_id = g.id
        WHERE cl.member_id = ? AND cl.contribution_type = 'withdrawal'
        ORDER BY cl.created_at DESC
        LIMIT 50
    `, [memberId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ============================================================================
// 📄 MEMBER STATEMENT GENERATION ENGINE
// ============================================================================

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fsSync = require('fs');

// Company branding constants
const COMPANY_NAME = 'UKOMBOZI TABLE BANKING';
const COMPANY_TAGLINE = 'Empowering Communities Through Financial Inclusion';
const COMPANY_ADDRESS = 'P.O Box 123, Nairobi, Kenya';
const COMPANY_PHONE = '+254 700 000 000';
const LOGO_PATH = path.join(__dirname, 'assets', 'logo.png');

// GET /api/statements/member/:id - Get member transaction data for statements
app.get('/api/statements/member/:id', authenticateToken, (req, res) => {
    const memberId = req.params.id;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [memberId];

    if (startDate && endDate) {
        dateFilter = "AND DATE(cl.created_at) BETWEEN ? AND ?";
        params.push(startDate, endDate);
    }

    // Get member info
    db.get(`
        SELECT m.*, g.name as group_name
        FROM members m
        LEFT JOIN groups g ON m.group_id = g.id
        WHERE m.id = ?
    `, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.status(404).json({ error: 'Member not found' });

        // Get all transactions from contribution_ledger
        db.all(`
            SELECT 
                cl.id,
                cl.transaction_ref,
                cl.contribution_type as type,
                cl.amount,
                cl.status,
                cl.description,
                cl.created_at,
                cl.posted_at,
                o.name as officer_name
            FROM contribution_ledger cl
            LEFT JOIN officers o ON cl.officer_id = o.id
            WHERE cl.member_id = ? ${dateFilter}
            ORDER BY cl.created_at ASC
        `, params, (err, transactions) => {
            if (err) return res.status(500).json({ error: err.message });

            // Calculate running balance
            let runningBalance = 0;
            const transactionsWithBalance = transactions.map(t => {
                runningBalance += (t.amount || 0);
                return {
                    ...t,
                    running_balance: runningBalance
                };
            });

            res.json({
                member,
                transactions: transactionsWithBalance,
                summary: {
                    total_deposits: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
                    total_withdrawals: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
                    closing_balance: runningBalance,
                    transaction_count: transactions.length
                },
                period: {
                    start: startDate || 'All time',
                    end: endDate || 'Present'
                }
            });
        });
    });
});

// GET /api/statements/member/:id/pdf - Generate PDF statement
app.get('/api/statements/member/:id/pdf', authenticateToken, (req, res) => {
    const memberId = req.params.id;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [memberId];

    if (startDate && endDate) {
        dateFilter = "AND DATE(cl.created_at) BETWEEN ? AND ?";
        params.push(startDate, endDate);
    }

    // Get member info
    db.get(`
        SELECT m.*, g.name as group_name
        FROM members m
        LEFT JOIN groups g ON m.group_id = g.id
        WHERE m.id = ?
    `, [memberId], (err, member) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!member) return res.status(404).json({ error: 'Member not found' });

        // Get all transactions
        db.all(`
            SELECT 
                cl.id,
                cl.transaction_ref,
                cl.contribution_type as type,
                cl.amount,
                cl.status,
                cl.description,
                cl.created_at
            FROM contribution_ledger cl
            WHERE cl.member_id = ? ${dateFilter}
            ORDER BY cl.created_at ASC
        `, params, (err, transactions) => {
            if (err) return res.status(500).json({ error: err.message });

            // Create PDF
            const doc = new PDFDocument({
                margin: 50,
                size: 'A4',
                bufferPages: true
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Statement_${member.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

            doc.pipe(res);

            // Check if logo exists
            const logoExists = fsSync.existsSync(LOGO_PATH);

            // ========== HEADER ==========
            const drawHeader = () => {
                if (logoExists) {
                    doc.image(LOGO_PATH, 50, 30, { width: 60 });
                }

                doc.fontSize(16).font('Helvetica-Bold')
                    .fillColor('#1a5f2a')
                    .text(COMPANY_NAME, logoExists ? 120 : 50, 35);

                doc.fontSize(8).font('Helvetica')
                    .fillColor('#666')
                    .text(COMPANY_TAGLINE, logoExists ? 120 : 50, 55);

                doc.fontSize(7)
                    .text(`${COMPANY_ADDRESS} | ${COMPANY_PHONE}`, logoExists ? 120 : 50, 67);

                // Line separator
                doc.strokeColor('#1a5f2a').lineWidth(2)
                    .moveTo(50, 90).lineTo(545, 90).stroke();
            };

            // ========== FOOTER ==========
            const drawFooter = (pageNum, totalPages) => {
                const y = 780;
                doc.fontSize(7).font('Helvetica').fillColor('#999')
                    .text(`Generated: ${new Date().toLocaleString('en-GB')}`, 50, y)
                    .text(`Page ${pageNum} of ${totalPages}`, 480, y)
                    .text('This is a computer-generated statement and does not require a signature.', 50, y + 12, { align: 'center' });

                // Footer line
                doc.strokeColor('#ddd').lineWidth(1)
                    .moveTo(50, y - 5).lineTo(545, y - 5).stroke();
            };

            // ========== WATERMARK ==========
            const drawWatermark = () => {
                if (logoExists) {
                    doc.opacity(0.05);
                    doc.image(LOGO_PATH, 150, 300, { width: 300 });
                    doc.opacity(1);
                }
            };

            // Draw header on first page
            drawHeader();
            drawWatermark();

            // ========== STATEMENT TITLE ==========
            let y = 110;
            doc.fontSize(14).font('Helvetica-Bold')
                .fillColor('#333')
                .text('MEMBER STATEMENT', 50, y, { align: 'center' });

            // Period
            y += 20;
            const periodText = startDate && endDate
                ? `Period: ${startDate} to ${endDate}`
                : `As of: ${new Date().toLocaleDateString('en-GB')}`;
            doc.fontSize(9).font('Helvetica')
                .fillColor('#666')
                .text(periodText, 50, y, { align: 'center' });

            // ========== MEMBER DETAILS BOX ==========
            y += 30;
            doc.rect(50, y, 495, 65).fillAndStroke('#f8f9fa', '#ddd');

            y += 10;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#333')
                .text('Member Name:', 60, y)
                .text('ID Number:', 60, y + 15)
                .text('Phone:', 60, y + 30)
                .text('Group:', 300, y)
                .text('Account Status:', 300, y + 15)
                .text('Risk Score:', 300, y + 30);

            doc.font('Helvetica')
                .text(member.name || 'N/A', 150, y)
                .text(member.id_number || 'N/A', 150, y + 15)
                .text(member.phone || 'N/A', 150, y + 30)
                .text(member.group_name || 'N/A', 400, y)
                .text(member.status || 'Active', 400, y + 15)
                .text(`${member.risk_score || 50}/100`, 400, y + 30);

            // ========== TRANSACTIONS TABLE ==========
            y += 80;
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('TRANSACTION HISTORY', 50, y);

            y += 20;

            // Table header
            const colWidths = [70, 100, 100, 80, 80, 65];
            const headers = ['Date', 'Reference', 'Type', 'Debit', 'Credit', 'Balance'];

            doc.rect(50, y, 495, 20).fillAndStroke('#1a5f2a', '#1a5f2a');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff');

            let x = 55;
            headers.forEach((header, i) => {
                doc.text(header, x, y + 6);
                x += colWidths[i];
            });

            y += 20;

            // Calculate running balance
            let runningBalance = 0;
            let totalDebit = 0;
            let totalCredit = 0;

            // Transaction rows
            transactions.forEach((t, index) => {
                // Check if we need a new page
                if (y > 720) {
                    doc.addPage();
                    drawHeader();
                    drawWatermark();
                    y = 110;
                }

                const isDebit = t.amount < 0;
                const amount = Math.abs(t.amount);
                runningBalance += t.amount;

                if (isDebit) totalDebit += amount;
                else totalCredit += amount;

                // Alternate row colors
                if (index % 2 === 0) {
                    doc.rect(50, y, 495, 18).fill('#f9f9f9');
                }

                doc.fontSize(7).font('Helvetica').fillColor('#333');

                x = 55;
                doc.text(new Date(t.created_at).toLocaleDateString('en-GB'), x, y + 5);
                x += colWidths[0];
                doc.text(t.transaction_ref || '-', x, y + 5);
                x += colWidths[1];
                doc.text((t.type || '').toUpperCase(), x, y + 5);
                x += colWidths[2];

                // Debit (red)
                if (isDebit) {
                    doc.fillColor('#dc3545').text(amount.toLocaleString(), x, y + 5);
                } else {
                    doc.fillColor('#333').text('-', x, y + 5);
                }
                x += colWidths[3];

                // Credit (green)
                if (!isDebit) {
                    doc.fillColor('#28a745').text(amount.toLocaleString(), x, y + 5);
                } else {
                    doc.fillColor('#333').text('-', x, y + 5);
                }
                x += colWidths[4];

                // Running Balance
                doc.fillColor(runningBalance >= 0 ? '#28a745' : '#dc3545')
                    .text(runningBalance.toLocaleString(), x, y + 5);

                y += 18;
            });

            // ========== TOTALS ROW ==========
            y += 5;
            doc.rect(50, y, 495, 22).fillAndStroke('#e9ecef', '#ccc');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#333');

            x = 55;
            doc.text('TOTALS', x, y + 7);
            x += colWidths[0] + colWidths[1] + colWidths[2];
            doc.fillColor('#dc3545').text(totalDebit.toLocaleString(), x, y + 7);
            x += colWidths[3];
            doc.fillColor('#28a745').text(totalCredit.toLocaleString(), x, y + 7);
            x += colWidths[4];
            doc.fillColor(runningBalance >= 0 ? '#28a745' : '#dc3545')
                .text(runningBalance.toLocaleString(), x, y + 7);

            // ========== SUMMARY BOX ==========
            y += 40;
            doc.rect(300, y, 245, 80).fillAndStroke('#f0fff4', '#28a745');

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('ACCOUNT SUMMARY', 310, y + 10);

            doc.fontSize(9).font('Helvetica').fillColor('#333')
                .text(`Total Credits:`, 310, y + 30)
                .text(`Total Debits:`, 310, y + 45)
                .text(`Closing Balance:`, 310, y + 60);

            doc.font('Helvetica-Bold')
                .fillColor('#28a745').text(`KES ${totalCredit.toLocaleString()}`, 440, y + 30)
                .fillColor('#dc3545').text(`KES ${totalDebit.toLocaleString()}`, 440, y + 45)
                .fillColor(runningBalance >= 0 ? '#28a745' : '#dc3545')
                .text(`KES ${runningBalance.toLocaleString()}`, 440, y + 60);

            // Add footers to all pages
            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                drawFooter(i + 1, pages.count);
            }

            doc.end();
        });
    });
});

// GET /api/statements/member/:id/excel - Generate Excel statement
app.get('/api/statements/member/:id/excel', authenticateToken, async (req, res) => {
    const memberId = req.params.id;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [memberId];

    if (startDate && endDate) {
        dateFilter = "AND DATE(cl.created_at) BETWEEN ? AND ?";
        params.push(startDate, endDate);
    }

    try {
        // Get member info
        const member = await new Promise((resolve, reject) => {
            db.get(`
                SELECT m.*, g.name as group_name
                FROM members m
                LEFT JOIN groups g ON m.group_id = g.id
                WHERE m.id = ?
            `, [memberId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!member) return res.status(404).json({ error: 'Member not found' });

        // Get transactions
        const transactions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    cl.id,
                    cl.transaction_ref,
                    cl.contribution_type as type,
                    cl.amount,
                    cl.status,
                    cl.description,
                    cl.created_at
                FROM contribution_ledger cl
                WHERE cl.member_id = ? ${dateFilter}
                ORDER BY cl.created_at ASC
            `, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = COMPANY_NAME;
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Statement', {
            pageSetup: { paperSize: 9, orientation: 'portrait' }
        });

        // Set column widths
        worksheet.columns = [
            { key: 'date', width: 15 },
            { key: 'reference', width: 20 },
            { key: 'type', width: 15 },
            { key: 'description', width: 30 },
            { key: 'debit', width: 15 },
            { key: 'credit', width: 15 },
            { key: 'balance', width: 15 }
        ];

        // Title
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = COMPANY_NAME;
        worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1A5F2A' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        // Subtitle
        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = 'MEMBER STATEMENT';
        worksheet.getCell('A2').font = { size: 12, bold: true };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Member info
        worksheet.getCell('A4').value = 'Member:';
        worksheet.getCell('B4').value = member.name;
        worksheet.getCell('D4').value = 'Group:';
        worksheet.getCell('E4').value = member.group_name;

        worksheet.getCell('A5').value = 'Phone:';
        worksheet.getCell('B5').value = member.phone;
        worksheet.getCell('D5').value = 'Period:';
        worksheet.getCell('E5').value = startDate && endDate ? `${startDate} to ${endDate}` : 'All time';

        // Headers
        const headerRow = worksheet.getRow(7);
        headerRow.values = ['Date', 'Reference', 'Type', 'Description', 'Debit', 'Credit', 'Balance'];
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1A5F2A' }
        };

        // Data rows
        let runningBalance = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        transactions.forEach((t, index) => {
            const isDebit = t.amount < 0;
            const amount = Math.abs(t.amount);
            runningBalance += t.amount;

            if (isDebit) totalDebit += amount;
            else totalCredit += amount;

            const row = worksheet.addRow({
                date: new Date(t.created_at).toLocaleDateString('en-GB'),
                reference: t.transaction_ref || '-',
                type: (t.type || '').toUpperCase(),
                description: t.description || '-',
                debit: isDebit ? amount : '',
                credit: !isDebit ? amount : '',
                balance: runningBalance
            });

            // Alternate row colors
            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9F9F9' }
                };
            }

            // Color debit/credit cells
            if (isDebit) {
                row.getCell('debit').font = { color: { argb: 'FFDC3545' } };
            } else {
                row.getCell('credit').font = { color: { argb: 'FF28A745' } };
            }

            row.getCell('balance').font = {
                color: { argb: runningBalance >= 0 ? 'FF28A745' : 'FFDC3545' }
            };
        });

        // Totals row
        const totalsRowNum = worksheet.rowCount + 1;
        const totalsRow = worksheet.addRow({
            date: 'TOTALS',
            debit: totalDebit,
            credit: totalCredit,
            balance: runningBalance
        });
        totalsRow.font = { bold: true };
        totalsRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE9ECEF' }
        };

        // Format number columns
        worksheet.getColumn('debit').numFmt = '#,##0.00';
        worksheet.getColumn('credit').numFmt = '#,##0.00';
        worksheet.getColumn('balance').numFmt = '#,##0.00';

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Statement_${member.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Excel generation error:', error);
        res.status(500).json({ error: 'Failed to generate Excel statement' });
    }
});

// ============================================================================
// 📊 GROUP STATEMENT GENERATION ENGINE
// ============================================================================

// GET /api/statements/group/:id - Get group financial summary
app.get('/api/statements/group/:id', authenticateToken, (req, res) => {
    const groupId = req.params.id;
    const { startDate, endDate } = req.query;

    // Get group info
    db.get(`SELECT * FROM groups WHERE id = ?`, [groupId], (err, group) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Get all members with balances
        db.all(`
            SELECT m.id, m.name, m.phone, m.status,
                   COALESCE(m.current_savings, 0) as savings,
                   COALESCE(m.active_loan_balance, 0) as loan_balance,
                   COALESCE(m.risk_score, 50) as risk_score
            FROM members m
            WHERE m.group_id = ?
            ORDER BY m.name
        `, [groupId], (err, members) => {
            if (err) return res.status(500).json({ error: err.message });

            // Get aggregated transactions
            db.get(`
                SELECT 
                    COUNT(*) as transaction_count,
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
                    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits
                FROM contribution_ledger
                WHERE group_id = ?
            `, [groupId], (err, stats) => {
                if (err) return res.status(500).json({ error: err.message });

                const totalSavings = members.reduce((sum, m) => sum + m.savings, 0);
                const totalLoans = members.reduce((sum, m) => sum + m.loan_balance, 0);
                const activeMembers = members.filter(m => m.status === 'active').length;

                res.json({
                    group,
                    members,
                    summary: {
                        total_members: members.length,
                        active_members: activeMembers,
                        total_savings: totalSavings,
                        total_loans_outstanding: totalLoans,
                        net_position: totalSavings - totalLoans,
                        total_credits: stats?.total_credits || 0,
                        total_debits: stats?.total_debits || 0,
                        transaction_count: stats?.transaction_count || 0
                    },
                    period: {
                        start: startDate || 'All time',
                        end: endDate || 'Present'
                    }
                });
            });
        });
    });
});

// GET /api/statements/group/:id/pdf - Generate Group PDF Statement
app.get('/api/statements/group/:id/pdf', authenticateToken, (req, res) => {
    const groupId = req.params.id;
    const { startDate, endDate } = req.query;

    db.get(`SELECT * FROM groups WHERE id = ?`, [groupId], (err, group) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!group) return res.status(404).json({ error: 'Group not found' });

        db.all(`
            SELECT m.id, m.name, m.phone, m.status,
                   COALESCE(m.current_savings, 0) as savings,
                   COALESCE(m.active_loan_balance, 0) as loan_balance,
                   COALESCE(m.risk_score, 50) as risk_score
            FROM members m
            WHERE m.group_id = ?
            ORDER BY m.name
        `, [groupId], (err, members) => {
            if (err) return res.status(500).json({ error: err.message });

            const doc = new PDFDocument({
                margin: 50,
                size: 'A4',
                bufferPages: true
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=GroupStatement_${group.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

            doc.pipe(res);

            const logoExists = fsSync.existsSync(LOGO_PATH);

            // Header
            const drawHeader = () => {
                if (logoExists) {
                    doc.image(LOGO_PATH, 50, 30, { width: 60 });
                }
                doc.fontSize(16).font('Helvetica-Bold')
                    .fillColor('#1a5f2a')
                    .text(COMPANY_NAME, logoExists ? 120 : 50, 35);
                doc.fontSize(8).font('Helvetica')
                    .fillColor('#666')
                    .text(COMPANY_TAGLINE, logoExists ? 120 : 50, 55);
                doc.strokeColor('#1a5f2a').lineWidth(2)
                    .moveTo(50, 90).lineTo(545, 90).stroke();
            };

            // Footer
            const drawFooter = (pageNum, totalPages) => {
                const y = 780;
                doc.fontSize(7).font('Helvetica').fillColor('#999')
                    .text(`Generated: ${new Date().toLocaleString('en-GB')}`, 50, y)
                    .text(`Page ${pageNum} of ${totalPages}`, 480, y);
                doc.strokeColor('#ddd').lineWidth(1)
                    .moveTo(50, y - 5).lineTo(545, y - 5).stroke();
            };

            // Watermark
            const drawWatermark = () => {
                if (logoExists) {
                    doc.opacity(0.05);
                    doc.image(LOGO_PATH, 150, 300, { width: 300 });
                    doc.opacity(1);
                }
            };

            drawHeader();
            drawWatermark();

            // Title
            let y = 110;
            doc.fontSize(14).font('Helvetica-Bold')
                .fillColor('#333')
                .text('GROUP STATEMENT', 50, y, { align: 'center' });

            y += 25;
            doc.fontSize(12).font('Helvetica-Bold')
                .fillColor('#1a5f2a')
                .text(group.name, 50, y, { align: 'center' });

            y += 20;
            const periodText = startDate && endDate
                ? `Period: ${startDate} to ${endDate}`
                : `As of: ${new Date().toLocaleDateString('en-GB')}`;
            doc.fontSize(9).font('Helvetica')
                .fillColor('#666')
                .text(periodText, 50, y, { align: 'center' });

            // Summary Box
            y += 30;
            const totalSavings = members.reduce((sum, m) => sum + m.savings, 0);
            const totalLoans = members.reduce((sum, m) => sum + m.loan_balance, 0);
            const activeMembers = members.filter(m => m.status === 'active').length;

            doc.rect(50, y, 495, 70).fillAndStroke('#f0fff4', '#28a745');

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('GROUP SUMMARY', 60, y + 10);

            doc.fontSize(9).font('Helvetica').fillColor('#333')
                .text(`Total Members: ${members.length}`, 60, y + 28)
                .text(`Active Members: ${activeMembers}`, 60, y + 43)
                .text(`Total Savings: KES ${totalSavings.toLocaleString()}`, 280, y + 28)
                .text(`Outstanding Loans: KES ${totalLoans.toLocaleString()}`, 280, y + 43)
                .text(`Net Position: KES ${(totalSavings - totalLoans).toLocaleString()}`, 280, y + 58);

            // Members Table
            y += 90;
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('MEMBER BALANCES', 50, y);

            y += 18;
            const colWidths = [30, 150, 90, 90, 70, 65];
            const headers = ['#', 'Member Name', 'Phone', 'Savings', 'Loan', 'Risk'];

            doc.rect(50, y, 495, 20).fillAndStroke('#1a5f2a', '#1a5f2a');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff');

            let x = 55;
            headers.forEach((header, i) => {
                doc.text(header, x, y + 6);
                x += colWidths[i];
            });

            y += 20;

            members.forEach((m, index) => {
                if (y > 720) {
                    doc.addPage();
                    drawHeader();
                    drawWatermark();
                    y = 110;
                }

                if (index % 2 === 0) {
                    doc.rect(50, y, 495, 18).fill('#f9f9f9');
                }

                doc.fontSize(7).font('Helvetica').fillColor('#333');

                x = 55;
                doc.text((index + 1).toString(), x, y + 5);
                x += colWidths[0];
                doc.text(m.name, x, y + 5);
                x += colWidths[1];
                doc.text(m.phone || '-', x, y + 5);
                x += colWidths[2];
                doc.fillColor('#28a745').text(`KES ${m.savings.toLocaleString()}`, x, y + 5);
                x += colWidths[3];
                doc.fillColor(m.loan_balance > 0 ? '#dc3545' : '#333')
                    .text(m.loan_balance > 0 ? `KES ${m.loan_balance.toLocaleString()}` : '-', x, y + 5);
                x += colWidths[4];
                doc.fillColor(m.risk_score > 70 ? '#dc3545' : '#333')
                    .text(`${m.risk_score}/100`, x, y + 5);

                y += 18;
            });

            // Totals row
            y += 5;
            doc.rect(50, y, 495, 22).fillAndStroke('#e9ecef', '#ccc');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#333');

            x = 55;
            doc.text('TOTALS', x, y + 7);
            x += colWidths[0] + colWidths[1] + colWidths[2];
            doc.fillColor('#28a745').text(`KES ${totalSavings.toLocaleString()}`, x, y + 7);
            x += colWidths[3];
            doc.fillColor('#dc3545').text(`KES ${totalLoans.toLocaleString()}`, x, y + 7);

            // Add footers
            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                drawFooter(i + 1, pages.count);
            }

            doc.end();
        });
    });
});

// GET /api/statements/group/:id/excel - Generate Group Excel Statement
app.get('/api/statements/group/:id/excel', authenticateToken, async (req, res) => {
    const groupId = req.params.id;

    try {
        const group = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM groups WHERE id = ?`, [groupId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const members = await new Promise((resolve, reject) => {
            db.all(`
                SELECT m.id, m.name, m.phone, m.status,
                       COALESCE(m.current_savings, 0) as savings,
                       COALESCE(m.active_loan_balance, 0) as loan_balance,
                       COALESCE(m.risk_score, 50) as risk_score
                FROM members m
                WHERE m.group_id = ?
                ORDER BY m.name
            `, [groupId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = COMPANY_NAME;

        const worksheet = workbook.addWorksheet('Group Statement');

        worksheet.columns = [
            { key: 'no', width: 6 },
            { key: 'name', width: 25 },
            { key: 'phone', width: 15 },
            { key: 'status', width: 12 },
            { key: 'savings', width: 15 },
            { key: 'loan', width: 15 },
            { key: 'risk', width: 10 }
        ];

        // Title
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = COMPANY_NAME;
        worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1A5F2A' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = `GROUP STATEMENT: ${group.name}`;
        worksheet.getCell('A2').font = { size: 12, bold: true };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Summary
        const totalSavings = members.reduce((sum, m) => sum + m.savings, 0);
        const totalLoans = members.reduce((sum, m) => sum + m.loan_balance, 0);

        worksheet.getCell('A4').value = 'Total Members:';
        worksheet.getCell('B4').value = members.length;
        worksheet.getCell('D4').value = 'Total Savings:';
        worksheet.getCell('E4').value = totalSavings;
        worksheet.getCell('E4').numFmt = '#,##0.00';

        worksheet.getCell('A5').value = 'Outstanding Loans:';
        worksheet.getCell('B5').value = totalLoans;
        worksheet.getCell('B5').numFmt = '#,##0.00';
        worksheet.getCell('D5').value = 'Net Position:';
        worksheet.getCell('E5').value = totalSavings - totalLoans;
        worksheet.getCell('E5').numFmt = '#,##0.00';

        // Headers
        const headerRow = worksheet.getRow(7);
        headerRow.values = ['#', 'Name', 'Phone', 'Status', 'Savings', 'Loan Balance', 'Risk'];
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1A5F2A' }
        };

        // Data
        members.forEach((m, index) => {
            const row = worksheet.addRow({
                no: index + 1,
                name: m.name,
                phone: m.phone || '-',
                status: m.status,
                savings: m.savings,
                loan: m.loan_balance,
                risk: m.risk_score
            });

            if (index % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9F9F9' }
                };
            }
        });

        // Totals
        const totalsRow = worksheet.addRow({
            no: '',
            name: 'TOTALS',
            savings: totalSavings,
            loan: totalLoans
        });
        totalsRow.font = { bold: true };
        totalsRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE9ECEF' }
        };

        worksheet.getColumn('savings').numFmt = '#,##0.00';
        worksheet.getColumn('loan').numFmt = '#,##0.00';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=GroupStatement_${group.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Excel generation error:', error);
        res.status(500).json({ error: 'Failed to generate Excel statement' });
    }
});

// ============================================================================
// 💰 DIVIDEND REPORT PDF GENERATION ENGINE
// ============================================================================

// GET /api/dividend-runs/:id/pdf - Generate Institutional Dividend PDF Report
app.get('/api/dividend-runs/:id/pdf', authenticateToken, (req, res) => {
    const runId = req.params.id;

    // Get dividend run data
    db.get(`SELECT * FROM dividend_runs WHERE id = ?`, [runId], (err, run) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!run) return res.status(404).json({ error: 'Dividend run not found' });

        // Get allocations with member names
        db.all(`
            SELECT da.*, m.name as member_name, m.phone
            FROM dividend_allocations da
            JOIN members m ON da.member_id = m.id
            WHERE da.run_id = ?
            ORDER BY m.name
        `, [runId], (err, allocations) => {
            if (err) return res.status(500).json({ error: err.message });

            const doc = new PDFDocument({
                margin: 50,
                size: 'A4',
                bufferPages: true
            });

            const fileName = `Dividend_Report_${run.run_number || 'DIV-' + runId}_${new Date().toISOString().split('T')[0]}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

            doc.pipe(res);

            const logoExists = fsSync.existsSync(LOGO_PATH);

            // Helper functions
            const drawHeader = () => {
                if (logoExists) {
                    doc.image(LOGO_PATH, 50, 30, { width: 60 });
                }
                doc.fontSize(16).font('Helvetica-Bold')
                    .fillColor('#1a5f2a')
                    .text(COMPANY_NAME, logoExists ? 120 : 50, 35);
                doc.fontSize(8).font('Helvetica')
                    .fillColor('#666')
                    .text('DIVIDEND DISTRIBUTION REPORT', logoExists ? 120 : 50, 55);
                doc.strokeColor('#1a5f2a').lineWidth(2)
                    .moveTo(50, 80).lineTo(545, 80).stroke();
            };

            const drawFooter = (pageNum, totalPages) => {
                const y = 780;
                doc.fontSize(7).font('Helvetica').fillColor('#999')
                    .text(`Generated: ${new Date().toLocaleString('en-GB')}`, 50, y)
                    .text(`Page ${pageNum} of ${totalPages}`, 480, y)
                    .text('UKOMBOZI TBMS', 250, y);
                doc.strokeColor('#ddd').lineWidth(1)
                    .moveTo(50, y - 5).lineTo(545, y - 5).stroke();
            };

            const drawWatermark = () => {
                if (logoExists) {
                    doc.opacity(0.05);
                    doc.image(LOGO_PATH, 150, 300, { width: 300 });
                    doc.opacity(1);
                }
            };

            // Status badge colors
            const statusColors = {
                'DRAFT': '#666',
                'CALCULATED': '#0066cc',
                'APPROVED': '#28a745',
                'POSTED': '#17a2b8',
                'REJECTED': '#dc3545'
            };

            // PAGE 1: Executive Summary
            drawHeader();
            drawWatermark();

            let y = 95;

            // Run Info and Status Badge
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#333')
                .text(`Run Number: ${run.run_number || 'DIV-' + runId}`, 50, y);

            // Status badge
            const statusColor = statusColors[run.status] || '#666';
            doc.rect(450, y - 3, 90, 18).fill(statusColor);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff')
                .text(run.status || 'DRAFT', 455, y + 2);

            y += 20;
            doc.fontSize(9).font('Helvetica').fillColor('#666')
                .text(`Report Date: ${new Date().toLocaleDateString('en-GB')}`, 50, y)
                .text(`Financial Year: ${run.financial_year || new Date().getFullYear()}`, 250, y);

            // Income Statement Box
            y += 30;
            doc.rect(50, y, 495, 80).fillAndStroke('#f8f9fa', '#dee2e6');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('📊 INCOME STATEMENT', 60, y + 10);

            const income = run.total_income || 0;
            const expenses = run.total_expenses || 0;
            const grossProfit = income - expenses;
            const adminCosts = run.admin_costs || 0;

            doc.fontSize(9).font('Helvetica').fillColor('#333')
                .text('Total Income:', 60, y + 30)
                .text(`KES ${income.toLocaleString()}`, 200, y + 30)
                .text('Total Expenses:', 60, y + 45)
                .text(`KES ${expenses.toLocaleString()}`, 200, y + 45)
                .text('Administrative Costs:', 60, y + 60)
                .text(`KES ${adminCosts.toLocaleString()}`, 200, y + 60);

            doc.font('Helvetica-Bold').fillColor('#28a745')
                .text('GROSS PROFIT:', 330, y + 45)
                .text(`KES ${grossProfit.toLocaleString()}`, 430, y + 45);

            // TRF Deductions Box
            y += 95;
            doc.rect(50, y, 495, 70).fillAndStroke('#fff8e5', '#ffc107');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#856404')
                .text('🛡️ TOTAL REGULATORY FUND (TRF) - 15% Policy', 60, y + 10);

            const trfTotal = grossProfit * 0.15;
            const mandatoryReserves = grossProfit * 0.10;
            const riskBuffer = grossProfit * 0.05;

            doc.fontSize(9).font('Helvetica').fillColor('#333')
                .text('Mandatory Reserves (10%):', 60, y + 30)
                .text(`KES ${mandatoryReserves.toLocaleString()}`, 200, y + 30)
                .text('Risk Buffer (5%):', 60, y + 45)
                .text(`KES ${riskBuffer.toLocaleString()}`, 200, y + 45);

            doc.font('Helvetica-Bold').fillColor('#dc3545')
                .text('TOTAL TRF DEDUCTIONS:', 330, y + 45)
                .text(`KES ${trfTotal.toLocaleString()}`, 450, y + 45);

            // Dividend Calculation Box
            y += 85;
            doc.rect(50, y, 495, 100).fillAndStroke('#e8f5e9', '#28a745');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('💰 DIVIDEND CALCULATION', 60, y + 10);

            const netProfit = grossProfit - trfTotal - adminCosts;
            const shareOutPolicy = run.share_out_policy || 70;
            const distributableAmount = netProfit * (shareOutPolicy / 100);
            const totalAvgShares = allocations.reduce((sum, a) => sum + (a.average_shares || 0), 0);
            const dividendRate = totalAvgShares > 0 ? (distributableAmount / totalAvgShares * 100) : 0;

            doc.fontSize(9).font('Helvetica').fillColor('#333')
                .text('Net Profit (After TRF & Admin):', 60, y + 30)
                .text(`KES ${netProfit.toLocaleString()}`, 220, y + 30)
                .text(`Share-Out Policy:`, 60, y + 45)
                .text(`${shareOutPolicy}%`, 220, y + 45)
                .text('Distributable Amount:', 60, y + 60)
                .text(`KES ${distributableAmount.toLocaleString()}`, 220, y + 60)
                .text('Total Average Shares:', 60, y + 75)
                .text(`KES ${totalAvgShares.toLocaleString()}`, 220, y + 75);

            doc.fontSize(12).font('Helvetica-Bold').fillColor('#28a745')
                .text('DIVIDEND RATE:', 330, y + 55)
                .text(`${dividendRate.toFixed(2)}%`, 450, y + 55);

            // Payout Summary Box
            y += 115;
            const grossPayout = allocations.reduce((sum, a) => sum + (a.gross_dividend || 0), 0);
            const arrearsOffset = allocations.reduce((sum, a) => sum + (a.arrears_offset || 0), 0);
            const netPayout = allocations.reduce((sum, a) => sum + (a.net_dividend || 0), 0);

            doc.rect(50, y, 495, 50).fillAndStroke('#e3f2fd', '#2196f3');
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1565c0')
                .text('PAYOUT SUMMARY', 60, y + 8);

            const boxWidth = 110;
            const boxes = [
                { label: 'Eligible Members', value: allocations.length.toString() },
                { label: 'Gross Payout', value: `KES ${grossPayout.toLocaleString()}` },
                { label: 'Arrears Offset', value: `KES ${arrearsOffset.toLocaleString()}` },
                { label: 'Net Payout', value: `KES ${netPayout.toLocaleString()}` }
            ];

            let bx = 60;
            boxes.forEach((box) => {
                doc.fontSize(7).font('Helvetica').fillColor('#666')
                    .text(box.label, bx, y + 25);
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#333')
                    .text(box.value, bx, y + 36);
                bx += boxWidth;
            });

            // Formula Box
            y += 65;
            doc.rect(50, y, 495, 70).fillAndStroke('#f5f5f5', '#ccc');
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#333')
                .text('📐 INSTITUTIONAL FORMULA BREAKDOWN', 60, y + 10);

            doc.fontSize(8).font('Helvetica').fillColor('#666')
                .text('1. TRF Deductions = Gross Profit × 15%', 60, y + 28)
                .text('2. Net Profit = Income - Expenses - Admin - TRF', 60, y + 40)
                .text('3. Dividend Rate = (Net Profit × Share-Out %) ÷ Total Avg Shares', 60, y + 52)
                .text('4. Member Dividend = (Avg Shares × Rate) - Arrears', 300, y + 28);

            // PAGE 2: Member Allocations
            doc.addPage();
            drawHeader();
            drawWatermark();

            y = 95;
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('MEMBER DIVIDEND ALLOCATIONS', 50, y, { align: 'center' });

            y += 25;
            const colWidths = [25, 130, 80, 80, 70, 70, 40];
            const headers = ['#', 'Member Name', 'Avg Shares', 'Gross', 'Arrears', 'Net Payout', 'Posted'];

            doc.rect(50, y, 495, 20).fillAndStroke('#1a5f2a', '#1a5f2a');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff');

            let x = 55;
            headers.forEach((header, i) => {
                doc.text(header, x, y + 6);
                x += colWidths[i];
            });

            y += 20;

            allocations.forEach((a, index) => {
                if (y > 720) {
                    doc.addPage();
                    drawHeader();
                    drawWatermark();
                    y = 95;
                }

                if (index % 2 === 0) {
                    doc.rect(50, y, 495, 18).fill('#f9f9f9');
                }

                doc.fontSize(7).font('Helvetica').fillColor('#333');

                x = 55;
                doc.text((index + 1).toString(), x, y + 5);
                x += colWidths[0];
                doc.text(a.member_name || `Member ${a.member_id}`, x, y + 5);
                x += colWidths[1];
                doc.text(`KES ${(a.average_shares || 0).toLocaleString()}`, x, y + 5);
                x += colWidths[2];
                doc.fillColor('#28a745').text(`KES ${(a.gross_dividend || 0).toLocaleString()}`, x, y + 5);
                x += colWidths[3];
                doc.fillColor('#ff9800').text(`KES ${(a.arrears_offset || 0).toLocaleString()}`, x, y + 5);
                x += colWidths[4];
                doc.font('Helvetica-Bold').fillColor('#17a2b8')
                    .text(`KES ${(a.net_dividend || 0).toLocaleString()}`, x, y + 5);
                x += colWidths[5];
                doc.font('Helvetica').fillColor('#28a745')
                    .text(a.posted ? '✓' : '', x + 10, y + 5);

                y += 18;
            });

            // Totals row
            y += 5;
            doc.rect(50, y, 495, 22).fillAndStroke('#e9ecef', '#ccc');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#333');

            x = 55;
            doc.text('TOTALS', x, y + 7);
            x += colWidths[0] + colWidths[1];
            doc.text(`KES ${totalAvgShares.toLocaleString()}`, x, y + 7);
            x += colWidths[2];
            doc.fillColor('#28a745').text(`KES ${grossPayout.toLocaleString()}`, x, y + 7);
            x += colWidths[3];
            doc.fillColor('#ff9800').text(`KES ${arrearsOffset.toLocaleString()}`, x, y + 7);
            x += colWidths[4];
            doc.fillColor('#17a2b8').text(`KES ${netPayout.toLocaleString()}`, x, y + 7);

            // PAGE 3: Audit & Signatures
            doc.addPage();
            drawHeader();
            drawWatermark();

            y = 95;
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('AUDIT, COMPLIANCE & SIGNATURES', 50, y, { align: 'center' });

            // Compliance Box
            y += 30;
            doc.rect(50, y, 495, 100).fillAndStroke('#e8f5e9', '#28a745');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f2a')
                .text('🔒 AUDIT & COMPLIANCE', 60, y + 10);

            const complianceItems = [
                '✓ All calculations performed by system-generated columns',
                '✓ TRF policy (15%) enforced at database level',
                '✓ Dividend rate calculated from profit and policy',
                '✓ Loan arrears automatically deducted - fair & transparent',
                '✓ Run is immutable after POSTED - no retroactive changes',
                '✓ Complete transaction log in database audit trail'
            ];

            let cy = y + 28;
            complianceItems.forEach(item => {
                doc.fontSize(9).font('Helvetica').fillColor('#333')
                    .text(item, 60, cy);
                cy += 12;
            });

            // Approval Workflow Box
            y += 115;
            doc.rect(50, y, 495, 70).fillAndStroke('#e3f2fd', '#2196f3');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1565c0')
                .text('APPROVAL WORKFLOW', 60, y + 10);

            doc.fontSize(9).font('Helvetica').fillColor('#333')
                .text('Calculated By:', 60, y + 30)
                .text(run.calculated_by || 'System', 160, y + 30)
                .text(run.calculated_at || '-', 320, y + 30)
                .text('Approved By:', 60, y + 45)
                .text(run.approved_by || '_______________', 160, y + 45)
                .text(run.approved_at || '_______________', 320, y + 45)
                .text('Posted By:', 60, y + 60)
                .text(run.posted_by || '_______________', 160, y + 60)
                .text(run.posted_at || '_______________', 320, y + 60);

            // Signature Blocks
            y += 90;

            // Director Signature
            doc.rect(50, y, 220, 80).stroke('#333');
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#333')
                .text('DIRECTOR SIGNATURE:', 60, y + 10);
            doc.fontSize(9).font('Helvetica').fillColor('#666')
                .text('Name: _________________________', 60, y + 45)
                .text('Date: _________________________', 60, y + 60);

            // Treasurer Signature
            doc.rect(290, y, 220, 80).stroke('#333');
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#333')
                .text('TREASURER SIGNATURE:', 300, y + 10);
            doc.fontSize(9).font('Helvetica').fillColor('#666')
                .text('Name: _________________________', 300, y + 45)
                .text('Date: _________________________', 300, y + 60);

            // Official Stamp
            y += 100;
            doc.rect(200, y, 150, 70).stroke('#333');
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#333')
                .text('OFFICIAL STAMP', 245, y + 30);

            // Add footers to all pages
            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                drawFooter(i + 1, pages.count);
            }

            doc.end();
        });
    });
});

// ============================================================================
// ⚖️ RECONCILIATION ENGINE - Cash vs Ledger Verification
// ============================================================================

// POST /api/reconciliation/session - Create reconciliation for a session
app.post('/api/reconciliation/session', authenticateToken, async (req, res) => {
    const { sessionId, expectedCash, actualCash, officerId, notes } = req.body;

    if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });
    if (actualCash === undefined) return res.status(400).json({ error: 'Actual cash count is required' });

    try {
        // Get session with calculated totals
        const session = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM meeting_sessions WHERE id = ?`, [sessionId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Calculate ledger totals from transactions
        const ledgerTotals = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COALESCE(SUM(savings), 0) as total_savings,
                    COALESCE(SUM(welfare), 0) as total_welfare,
                    COALESCE(SUM(project), 0) as total_project,
                    COALESCE(SUM(loan_principal), 0) as total_loan_principal,
                    COALESCE(SUM(loan_interest), 0) as total_loan_interest,
                    COALESCE(SUM(loan_disbursed), 0) as total_loan_disbursed,
                    COUNT(*) as transaction_count
                FROM transactions
                WHERE sessionId = ? AND status = 'POSTED'
            `, [sessionId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Calculate expected cash (cash in - cash out)
        const cashIn = (ledgerTotals.total_savings || 0) +
            (ledgerTotals.total_welfare || 0) +
            (ledgerTotals.total_project || 0) +
            (ledgerTotals.total_loan_principal || 0) +
            (ledgerTotals.total_loan_interest || 0);
        const cashOut = ledgerTotals.total_loan_disbursed || 0;
        const calculatedCash = cashIn - cashOut + (session.opening_balance || 0);

        const variance = actualCash - calculatedCash;
        const isBalanced = Math.abs(variance) < 1; // Allow KES 1 rounding tolerance

        const status = isBalanced ? 'BALANCED' : (variance > 0 ? 'SURPLUS' : 'SHORTAGE');

        // Insert reconciliation record
        const reconciliationRef = `REC-${sessionId}-${Date.now()}`;

        db.run(`
            INSERT INTO reconciliations (
                session_id, group_id, reconciliation_ref,
                ledger_balance, physical_cash, variance,
                status, reconciled_by, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            sessionId, session.group_id || session.groupId, reconciliationRef,
            calculatedCash, actualCash, variance,
            status, officerId || 1, notes || null, new Date().toISOString()
        ], function (err) {
            if (err) {
                // Table might not exist, create it
                if (err.message.includes('no such table')) {
                    db.run(`
                        CREATE TABLE IF NOT EXISTS reconciliations (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            session_id INTEGER NOT NULL,
                            group_id INTEGER,
                            reconciliation_ref TEXT UNIQUE,
                            ledger_balance REAL NOT NULL,
                            physical_cash REAL NOT NULL,
                            variance REAL NOT NULL,
                            status TEXT DEFAULT 'PENDING',
                            reconciled_by INTEGER,
                            notes TEXT,
                            resolved_at TEXT,
                            resolved_by INTEGER,
                            resolution_notes TEXT,
                            created_at TEXT DEFAULT CURRENT_TIMESTAMP
                        )
                    `, () => {
                        // Retry insert
                        db.run(`
                            INSERT INTO reconciliations (
                                session_id, group_id, reconciliation_ref,
                                ledger_balance, physical_cash, variance,
                                status, reconciled_by, notes, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            sessionId, session.group_id || session.groupId, reconciliationRef,
                            calculatedCash, actualCash, variance,
                            status, officerId || 1, notes || null, new Date().toISOString()
                        ], function (err) {
                            if (err) return res.status(500).json({ error: err.message });
                            returnReconciliation(this.lastID);
                        });
                    });
                    return;
                }
                return res.status(500).json({ error: err.message });
            }

            returnReconciliation(this.lastID);
        });

        function returnReconciliation(recId) {
            logAudit(`Reconciliation: ${status}`, 'reconciliation', {
                sessionId, ledger: calculatedCash, actual: actualCash, variance
            });

            res.json({
                id: recId,
                reconciliation_ref: reconciliationRef,
                session_id: sessionId,
                ledger_balance: calculatedCash,
                physical_cash: actualCash,
                variance,
                status,
                is_balanced: isBalanced,
                breakdown: {
                    opening_balance: session.opening_balance || 0,
                    cash_in: cashIn,
                    cash_out: cashOut,
                    calculated_closing: calculatedCash,
                    transaction_count: ledgerTotals.transaction_count
                },
                message: isBalanced
                    ? '✅ Cash reconciled successfully - No discrepancy'
                    : `⚠️ ${status}: Variance of KES ${Math.abs(variance).toLocaleString()}`
            });
        }

    } catch (error) {
        console.error('Reconciliation error:', error);
        res.status(500).json({ error: 'Failed to perform reconciliation' });
    }
});

// GET /api/reconciliation/session/:id - Get reconciliation for a session
app.get('/api/reconciliation/session/:id', authenticateToken, (req, res) => {
    const sessionId = req.params.id;

    db.get(`
        SELECT r.*, ms.session_number, g.name as group_name, o.name as reconciled_by_name
        FROM reconciliations r
        LEFT JOIN meeting_sessions ms ON r.session_id = ms.id
        LEFT JOIN groups g ON r.group_id = g.id
        LEFT JOIN officers o ON r.reconciled_by = o.id
        WHERE r.session_id = ?
        ORDER BY r.created_at DESC
        LIMIT 1
    `, [sessionId], (err, reconciliation) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!reconciliation) {
            return res.status(404).json({
                error: 'No reconciliation found for this session',
                needs_reconciliation: true
            });
        }

        res.json(reconciliation);
    });
});

// GET /api/reconciliation/discrepancies - List all unresolved discrepancies
app.get('/api/reconciliation/discrepancies', authenticateToken, (req, res) => {
    const { status, groupId } = req.query;

    let query = `
        SELECT r.*, ms.session_number, ms.meeting_date, g.name as group_name
        FROM reconciliations r
        LEFT JOIN meeting_sessions ms ON r.session_id = ms.id
        LEFT JOIN groups g ON r.group_id = g.id
        WHERE r.status != 'BALANCED'
    `;
    const params = [];

    if (status) {
        query += ` AND r.status = ?`;
        params.push(status);
    }
    if (groupId) {
        query += ` AND r.group_id = ?`;
        params.push(groupId);
    }

    query += ` ORDER BY ABS(r.variance) DESC`;

    db.all(query, params, (err, discrepancies) => {
        if (err) return res.status(500).json({ error: err.message });

        const totalVariance = discrepancies.reduce((sum, d) => sum + d.variance, 0);
        const shortages = discrepancies.filter(d => d.status === 'SHORTAGE');
        const surpluses = discrepancies.filter(d => d.status === 'SURPLUS');

        res.json({
            discrepancies,
            summary: {
                total_discrepancies: discrepancies.length,
                total_variance: totalVariance,
                shortages: {
                    count: shortages.length,
                    total: shortages.reduce((sum, d) => sum + Math.abs(d.variance), 0)
                },
                surpluses: {
                    count: surpluses.length,
                    total: surpluses.reduce((sum, d) => sum + d.variance, 0)
                }
            }
        });
    });
});

// POST /api/reconciliation/:id/resolve - Resolve a discrepancy
app.post('/api/reconciliation/:id/resolve', authenticateToken, (req, res) => {
    const recId = req.params.id;
    const { resolutionNotes, resolvedBy, adjustment } = req.body;

    if (!resolutionNotes) {
        return res.status(400).json({ error: 'Resolution notes are required' });
    }

    db.run(`
        UPDATE reconciliations
        SET status = 'RESOLVED',
            resolved_at = ?,
            resolved_by = ?,
            resolution_notes = ?
        WHERE id = ?
    `, [new Date().toISOString(), resolvedBy || 1, resolutionNotes, recId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Reconciliation not found' });
        }

        logAudit(`Resolved discrepancy: ${recId}`, 'reconciliation', { recId, resolutionNotes });

        res.json({
            success: true,
            id: recId,
            status: 'RESOLVED',
            message: 'Discrepancy resolved successfully'
        });
    });
});

// GET /api/reconciliation/dashboard - Director reconciliation dashboard
app.get('/api/reconciliation/dashboard', authenticateToken, (req, res) => {
    // Get all groups with their latest reconciliation status
    db.all(`
        SELECT 
            g.id, g.name, g.location,
            (SELECT COUNT(*) FROM meeting_sessions WHERE group_id = g.id) as total_sessions,
            (SELECT status FROM reconciliations WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_rec_status,
            (SELECT variance FROM reconciliations WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_variance,
            (SELECT created_at FROM reconciliations WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_rec_date,
            (SELECT SUM(COALESCE(m.current_savings, 0)) FROM members m WHERE m.group_id = g.id) as total_savings,
            (SELECT SUM(COALESCE(m.active_loan_balance, 0)) FROM members m WHERE m.group_id = g.id) as total_loans
        FROM groups g
        ORDER BY g.name
    `, [], (err, groups) => {
        if (err) return res.status(500).json({ error: err.message });

        const needsAttention = groups.filter(g =>
            g.last_rec_status === 'SHORTAGE' || g.last_rec_status === 'SURPLUS'
        ).length;

        const totalSavings = groups.reduce((sum, g) => sum + (g.total_savings || 0), 0);
        const totalLoans = groups.reduce((sum, g) => sum + (g.total_loans || 0), 0);

        res.json({
            groups: groups.map(g => ({
                ...g,
                has_discrepancy: g.last_rec_status === 'SHORTAGE' || g.last_rec_status === 'SURPLUS',
                net_position: (g.total_savings || 0) - (g.total_loans || 0)
            })),
            summary: {
                total_groups: groups.length,
                needs_attention: needsAttention,
                total_savings: totalSavings,
                total_loans: totalLoans,
                net_position: totalSavings - totalLoans
            }
        });
    });
});

// Start Server
const HOST = '127.0.0.1'; // 🔒 DEPLOYMENT LOCKDOWN: Restrict to localhost

app.listen(PORT, HOST, () => {
    console.log(`\n\x1b[32m[SERVER]\x1b[0m Ukombozi TBMS Backend Live`);
    console.log(`\x1b[36m[URL]\x1b[0m http://${HOST}:${PORT}`);
    console.log(`\x1b[33m[SECURITY]\x1b[0m Localhost Lockdown Active\n`);
});

