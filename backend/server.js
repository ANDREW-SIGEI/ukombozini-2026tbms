const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const reportService = require('./services/reportService');

const JWT_SECRET = process.env.JWT_SECRET || 'ukombozi-secret-key-2026';

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

/**
 * Helper to Log and Mock Send SMS
 */
const logAndSendSMS = (memberId, message, type, transactionId = null) => {
    db.get("SELECT phone FROM members WHERE id = ?", [memberId], (err, row) => {
        if (err || !row || !row.phone) return; // No phone found
        const phone = row.phone;

        // Log to DB (Simulating API Send)
        db.run(`INSERT INTO sms_logs (member_id, phone, message, type, status, transaction_id, cost) 
                VALUES (?, ?, ?, ?, 'SENT', ?, 1.50)`,
            [memberId, phone, message, type, transactionId], (logErr) => {
                if (logErr) console.error("SMS Log Error:", logErr);
            }
        );
    });
};

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role) {
        const role = req.user.role.toLowerCase();
        if (role === 'admin' || role === 'director') {
            return next();
        }
    }
    res.status(403).json({ error: 'Access denied: Admin or Director privileges required' });
};

// ==========================================
// SERVER HEALTH DASHBOARD (Visual)
// ==========================================
app.get('/', (req, res) => {
    const stats = { groups: 0, members: 0, officers: 0 };

    db.get("SELECT COUNT(*) as count FROM groups", (err, row) => {
        if (!err) stats.groups = row.count;
        db.get("SELECT COUNT(*) as count FROM members", (err, row) => {
            if (!err) stats.members = row.count;
            db.get("SELECT COUNT(*) as count FROM officers", (err, row) => {
                if (!err) stats.officers = row.count;

                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Ukombozi Backend | Status</title>
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                            .card { background: white; padding: 2.5rem; border-radius: 20px; shadow: 0 10px 25px rgba(0,0,0,0.1); width: 400px; text-align: center; border: 1px solid #e1e4e8; }
                            .status-badge { background: #28a745; color: white; padding: 5px 15px; border-radius: 50px; font-weight: bold; font-size: 0.8rem; display: inline-block; margin-bottom: 1rem; }
                            h1 { color: #1a1d21; margin: 0 0 0.5rem 0; font-size: 1.5rem; letter-spacing: -0.5px; }
                            p { color: #6a737d; margin-bottom: 2rem; font-size: 0.9rem; }
                            .stats-container { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; text-align: left; }
                            .stat-box { background: #f8f9fa; padding: 1rem; border-radius: 12px; border: 1px solid #eee; }
                            .stat-val { display: block; font-size: 1.25rem; font-weight: 800; color: #1a1d21; }
                            .stat-label { font-size: 0.7rem; color: #6a737d; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
                            .footer { margin-top: 2rem; font-size: 0.75rem; color: #959da5; }
                            .pulse { display: inline-block; width: 10px; height: 10px; background: #28a745; border-radius: 50%; margin-right: 5px; animation: pulse 2s infinite; }
                            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div class="status-badge"><span class="pulse"></span>SYSTEM ONLINE</div>
                            <h1>Ukombozi Backend</h1>
                            <p>Local SQLite API Terminal</p>
                            
                            <div class="stats-container">
                                <div class="stat-box">
                                    <span class="stat-label">Groups</span>
                                    <span class="stat-val">${stats.groups}</span>
                                </div>
                                <div class="stat-box">
                                    <span class="stat-label">Members</span>
                                    <span class="stat-val">${stats.members}</span>
                                </div>
                                <div class="stat-box">
                                    <span class="stat-label">Staff</span>
                                    <span class="stat-val">${stats.officers}</span>
                                </div>
                            </div>
                            
                            <div class="footer">
                                API Version 1.0.0 &bull; Port ${PORT}<br>
                                Initialized: ${new Date().toLocaleDateString()}
                            </div>
                        </div>
                    </body>
                    </html>
                `);
            });
        });
    });
});

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
            res.json({ success: true, id: this.lastID });
        });
        stmt.finalize();
    }
});

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
        db.get("SELECT id, name, email, role FROM officers WHERE id = ?", [verified.id], (err, officer) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!officer) return res.status(404).json({ error: 'User not found' });
            res.json({
                ...officer,
                role: officer.role.toLowerCase()
            });
        });
    } catch (err) {
        res.status(400).json({ error: 'Invalid token' });
    }
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
    const query = `
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
        ORDER BY g.name
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new group
app.post('/api/groups', (req, res) => {
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
app.put('/api/groups/:id', (req, res) => {
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
            status = COALESCE(?, status)
        WHERE id = ?
    `;

    db.run(query, [
        finalName, location, meeting_day, meeting_frequency,
        chairperson, secretary, treasurer,
        chairperson_id, secretary_id, treasurer_id,
        minMonthlySaving, loanMultiplier, stlInterestRate, ltlInterestRate,
        financial_year, status, id
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

// Get Single Member Profile
app.get('/api/members/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { role, id: officerId } = req.user;

    const query = `
        SELECT m.*, g.name as group_name,
        (SELECT COALESCE(SUM(principal_amount), 0) FROM loans WHERE (guarantor1_id = m.id OR guarantor2_id = m.id) AND status = 'active') as total_guaranteed_amount,
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
app.post('/api/members', authenticateToken, (req, res) => {
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
app.put('/api/members/:id', (req, res) => {
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

// ==========================================
// UNIFIED TRANSACTION API
// ==========================================

// Create/Record a Transaction (Generic Hub)
app.post('/api/transactions', (req, res) => {
    const {
        type, transaction_type,
        memberId, sessionId,
        amount, description,
        // For Loans
        loanId, loanType, breakdown,
        // For others
        paymentMethod
    } = req.body;

    const finalType = type || transaction_type;

    if (!memberId || !amount) {
        return res.status(400).json({ error: "Member ID and Amount are required." });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        if (finalType === 'loan_repayment') {
            // Handle Loan Repayment
            if (!loanId) {
                db.run("ROLLBACK");
                return res.status(400).json({ error: "Loan ID is required for repayment." });
            }

            const desc = description || `Repayment for Loan #${loanId}`;
            const stmt = db.prepare(`
                INSERT INTO transactions (
                    sessionId, memberId, stl_repayment, ltl_repayment, loan_interest, fines, description, transaction_type, uploaded, attended
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'LoanRepayment', 1, 1)
            `);

            // Safe breakdown access
            const stl_amt = (loanType === 'STL' || !loanType) ? (breakdown?.principal || amount) : 0;
            const ltl_amt = (loanType === 'LTL') ? (breakdown?.principal || amount) : 0;
            const interest = breakdown?.interest || 0;
            const penalty = breakdown?.penalty || 0;

            stmt.run(sessionId || null, memberId, stl_amt, ltl_amt, interest, penalty, desc, function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                // Decrease Loan Balance
                db.run("UPDATE members SET active_loan_balance = MAX(0, active_loan_balance - ?) WHERE id = ?", [amount, memberId], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    db.run("COMMIT");
                    logAudit(`Repayment Recieved: ${amount}`, 'transaction', { memberId, amount });

                    // SMS Trigger
                    const smsMsg = `UKOMBOZI: Loan Repayment received KES ${Number(amount).toLocaleString()}. Bal: KES ... Ref: ${Date.now()}.`;
                    logAndSendSMS(memberId, smsMsg, 'LOAN_REPAYMENT');

                    res.json({ success: true, message: "Repayment recorded successfully." });
                });
            });
            stmt.finalize();

        } else if (finalType === 'Savings' || finalType === 'savings') {
            // Handle Savings
            const stmt = db.prepare(`
                INSERT INTO transactions (
                    sessionId, memberId, savings_amount, transaction_type, description, uploaded, attended
                ) VALUES (?, ?, ?, 'Contribution', ?, 1, 1)
            `);

            stmt.run(sessionId || null, memberId, amount, description || 'Savings Deposit', function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                // Increase Savings
                db.run("UPDATE members SET current_savings = current_savings + ? WHERE id = ?", [amount, memberId], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    db.run("COMMIT");

                    // SMS Trigger
                    const smsMsg = `UKOMBOZI: Savings Deposit Received KES ${Number(amount).toLocaleString()}. Thank you. Ref: ${Date.now()}.`;
                    logAndSendSMS(memberId, smsMsg, 'CONTRIBUTION');

                    res.json({ success: true, message: "Savings recorded successfully." });
                });
            });
            stmt.finalize();

        } else if (finalType === 'withdrawal' || finalType === 'Withdrawal') {
            // Handle Withdrawal
            const stmt = db.prepare(`
                INSERT INTO transactions (
                    sessionId, memberId, withdrawals, transaction_type, description, uploaded, attended
                ) VALUES (?, ?, ?, 'Withdrawal', ?, 1, 1)
            `);

            stmt.run(sessionId || null, memberId, amount, description || 'Cash Withdrawal', function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                // Decrease Savings
                db.run("UPDATE members SET current_savings = MAX(0, current_savings - ?) WHERE id = ?", [amount, memberId], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    db.run("COMMIT");
                    res.json({ success: true, message: "Withdrawal recorded successfully." });
                });
            });
            stmt.finalize();

        } else {
            // Generic Fallback
            db.run("ROLLBACK");
            return res.status(400).json({ error: "Invalid or unsupported transaction type." });
        }
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
        logAudit(`Start Meeting Session`, 'transaction', { id: this.lastID, groupId, officerId });
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
// EMAIL SERVICE API
// ==========================================
const emailService = require('./services/emailService');

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
                sessionId, memberId, stl_repayment, ltl_repayment, loan_interest, fines, description, transaction_type, uploaded, attended
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
                logAudit(`Loan Repayment: ${amount}`, 'transaction', { memberId, loanId, amount, loanType });
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
    const {
        memberId, groupId, sessionId, loanType, amount, interestRate, duration, officerId,
        guarantor1_id, guarantor2_id
    } = req.body;

    const issuedDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + (duration || 1));
    const dueDateStr = dueDate.toISOString().split('T')[0];

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

                    // 1. Update member active loan balance
                    db.run("UPDATE members SET active_loan_balance = IFNULL(active_loan_balance, 0) + ? WHERE id = ?", [amount, memberId], (err) => {
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
                            sessionId, memberId, loans_issued, transaction_type, description, attended
                        ) VALUES (?, ?, ?, 'LoanIssued', ?, 1)
                    `);
                        txStmt.run(sessionId, memberId, amount, `${loanType} Loan Issued | Loan ID: ${loanId}`);
                        txStmt.finalize();

                        db.run("COMMIT");
                        logAudit(`Issue Loan: ${amount}`, 'transaction', { memberId, loanId, amount, loanType });
                        res.json({ id: loanId, status: 'active', message: 'Loan issued successfully' });
                    });
                });
            stmt.finalize();
        });
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
app.post('/api/loan-applications', (req, res) => {
    const {
        memberId, groupId, loanType, amount, duration, purpose,
        monthly_installment, principal_portion, interest_portion, shares_contribution, officerId,
        guarantor1_id, guarantor2_id
    } = req.body;

    const appNumber = `APP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const stmt = db.prepare(`
        INSERT INTO loan_applications (
            application_number, member_id, group_id, loan_type, amount_requested, 
            duration_months, purpose, monthly_installment, interest_portion, 
            principal_portion, shares_contribution, officer_id, guarantor1_id, guarantor2_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `);

    stmt.run(
        appNumber, memberId, groupId, loanType, amount,
        duration, purpose, monthly_installment, interest_portion,
        principal_portion, shares_contribution, officerId, guarantor1_id || null, guarantor2_id || null,
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Submit Loan App: ${appNumber}`, 'transaction', { id: this.lastID, memberId, amount });
            res.json({ id: this.lastID, application_number: appNumber, success: true });
        }
    );
    stmt.finalize();
});

// Update loan application status
app.patch('/api/loan-applications/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, comments, officerId } = req.body;

    db.get("SELECT * FROM loan_applications WHERE id = ?", [id], (err, app) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!app) return res.status(404).json({ error: "Application not found" });

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
app.post('/api/dividends/preview', async (req, res) => {
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
app.post('/api/dividends/post', (req, res) => {
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
// Contributions Endpoint (Local) - STRICT SESSION ENFORCEMENT
app.post('/api/contributions', authenticateToken, (req, res) => {
    const { memberId, amount, type, sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: "Session Integrity Violation: Contribution must be linked to an active Session." });
    }

    // Optional: Verify session is actually open (can be added if strictness needs to prevent late posting to closed sessions)

    const stmt = db.prepare(`
        INSERT INTO transactions (
            sessionId, memberId, savings_amount, transaction_type, description, created_at, uploaded
        ) VALUES (?, ?, ?, 'Contribution', ?, ?, 1)
    `);

    stmt.run(sessionId, memberId, amount, `${type} Contribution`, new Date().toISOString(), function (err) {
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

app.get('/api/reports/loan-repayment-pdf', async (req, res) => {
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
app.get('/api/reports/meeting/:sessionId', async (req, res) => {
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

// Member Statement PDF
app.get('/api/reports/member/:memberId', async (req, res) => {
    try {
        const { memberId } = req.params;
        const { startDate, endDate } = req.query;
        const pdfBuffer = await reportService.generateMemberStatement(memberId, startDate, endDate);

        res.setHeader('Content-Disposition', `attachment; filename=member_statement_${memberId}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Dividend Report PDF
app.get('/api/reports/dividends/:runId', async (req, res) => {
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

app.get('/api/reports/compliance', async (req, res) => {
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

app.get('/api/reports/loan-repayments', async (req, res) => {
    try {
        const { month, groupId, type } = req.query;
        const pdfBuffer = await reportService.generateLoanRepaymentReport(month, groupId, type);

        res.setHeader('Content-Disposition', `attachment; filename=loan_repayment_report_${month}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Loan Repayment PDF Error:', error);
        res.status(500).json({ error: 'Failed to generate loan repayment PDF' });
    }
});

// ==========================================
// FINANCIAL REPORTS API
// ==========================================

// 1. Balance Sheet (Snapshot)
app.get('/api/reports/financial/balance-sheet', (req, res) => {
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
app.get('/api/reports/financial/income-statement', (req, res) => {
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
app.post('/api/partnership/top-up', (req, res) => {
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
app.post('/api/partnership/commitment-deposit', (req, res) => {
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
app.post('/api/partnership/issue-product', (req, res) => {
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
app.post('/api/partnership/apply-offset', (req, res) => {
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
app.post('/api/projects/register', authenticateToken, (req, res) => {
    const { member_id, project_type } = req.body;
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentYear = new Date().getFullYear();

    if (currentMonth > 3) {
        return res.status(403).json({ error: 'Registration period closed (Jan-Mar only)' });
    }

    if (!member_id || !project_type) {
        return res.status(400).json({ error: 'Member ID and project type are required' });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Check if already registered
        db.get("SELECT id FROM project_registrations WHERE member_id = ? AND project_type = ? AND year = ?", [member_id, project_type, currentYear], (err, row) => {
            if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
            if (row) { db.run("ROLLBACK"); return res.status(400).json({ error: 'Member already registered for this project this year' }); }

            // 2. Record Registration
            const regStmt = db.prepare("INSERT INTO project_registrations (member_id, project_type, year) VALUES (?, ?, ?)");
            regStmt.run(member_id, project_type, currentYear, function (err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                const regId = this.lastID;

                // 3. Record Company Revenue (The fee)
                const revStmt = db.prepare("INSERT INTO company_revenue (source, amount, member_id, description) VALUES (?, ?, ?, ?)");
                revStmt.run('PROJECT_REGISTRATION_FEE', 200, member_id, `Fee for ${project_type} project registration`, (err) => {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }

                    // 4. Record as Table CASH OUT
                    db.get("SELECT group_id FROM members WHERE id = ?", [member_id], (err, mRow) => {
                        if (err || !mRow) { db.run("ROLLBACK"); return res.status(500).json({ error: 'Member group not found' }); }

                        // We record a transaction of type 'OUT' for the fee
                        const transStmt = db.prepare("INSERT INTO transactions (memberId, transaction_type, description, withdrawals) VALUES (?, 'OUT', ?, 200)");
                        transStmt.run(member_id, `PROJECT_REG_FEE: ${project_type}`, (err) => {
                            if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }

                            db.run("COMMIT");
                            logAudit(`Register Project: ${project_type}`, 'member', { member_id, regId });
                            res.json({ success: true, registration_id: regId, message: 'Registration successful. 200 KES fee recorded.' });
                        });
                        transStmt.finalize();
                    });
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
app.post('/api/projects/save', authenticateToken, (req, res) => {
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
                    const stmt = db.prepare("INSERT INTO project_savings (registration_id, amount, date) VALUES (?, ?, ?)");
                    stmt.run(registration_id, amount, formattedDate, function (err) {
                        if (err) return res.status(500).json({ error: err.message });
                        logAudit(`Project Savings`, 'member', { member_id, amount, project: reg.project_type });
                        res.json({ success: true, id: this.lastID });
                    });
                    stmt.finalize();
                });
            });
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

/**
 * Get Project Matrix for all members in a Group
 */
app.get('/api/projects/group-matrix/:groupId', authenticateToken, (req, res) => {
    const { groupId } = req.params;
    const query = `
        SELECT 
            m.id, 
            m.name,
            m.current_savings as normal_savings,
            COALESCE(SUM(CASE WHEN pr.project_type = 'EDUCATION' THEN ps.amount ELSE 0 END), 0) as edu_saved,
            COALESCE(SUM(CASE WHEN pr.project_type = 'AGRICULTURE' THEN ps.amount ELSE 0 END), 0) as agri_saved,
            COUNT(DISTINCT pr.id) as registered_projects
        FROM members m
        LEFT JOIN project_registrations pr ON m.id = pr.member_id
        LEFT JOIN project_savings ps ON pr.id = ps.registration_id
        WHERE m.group_id = ?
        GROUP BY m.id
    `;
    db.all(query, [groupId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * Get Project Status for a specific Member
 */
app.get('/api/projects/member-status/:memberId', authenticateToken, (req, res) => {
    const { memberId } = req.params;

    const query = `
        SELECT 
            pr.id as registration_id,
            pr.project_type,
            COALESCE(SUM(ps.amount), 0) as total_saved,
            (COALESCE(SUM(ps.amount), 0) * 1.5) as projected_payout
        FROM project_registrations pr
        LEFT JOIN project_savings ps ON pr.id = ps.registration_id
        WHERE pr.member_id = ?
        GROUP BY pr.id
    `;

    db.all(query, [memberId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * Get Member Day Limit (Relationship Alignment)
 * Returns how much table savings the member made on a specific date
 * and how much project savings they have already consumed.
 */
app.get('/api/projects/member-day-limit/:memberId/:date', authenticateToken, (req, res) => {
    const { memberId, date: reqDate } = req.params;
    const targetDate = reqDate || new Date().toISOString().split('T')[0];

    const query = `
        SELECT 
            (SELECT COALESCE(SUM(savings_amount), 0) FROM transactions WHERE memberId = ? AND date(created_at) = date(?)) as daily_limit,
            (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = ? AND date(ps.date) = date(?)) as already_saved
    `;

    db.get(query, [memberId, targetDate, memberId, targetDate], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const limit = row.daily_limit || 0;
        const saved = row.already_saved || 0;

        res.json({
            daily_limit: limit,
            already_saved: saved,
            remaining_limit: Math.max(0, limit - saved)
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`[SERVER] Node.js Backend running on http://localhost:${PORT}`);
});

const { networkInterfaces } = require('os');
const nets = networkInterfaces();
for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
            console.log(`\x1b[36m[NETWORK]\x1b[0m Accessible at http://${net.address}:${PORT}`);
        }
    }
}

