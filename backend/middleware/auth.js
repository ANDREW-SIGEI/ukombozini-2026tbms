const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'ukombozi-secret-key-2026';

/**
 * 🔐 AUDITOR MODE: Mutation Blocker
 */
const enforceAuditorLimits = (req, res, next) => {
    if (req.user && req.user.role && req.user.role.toLowerCase() === 'auditor') {
        if (req.method !== 'GET') {
            return res.status(403).json({
                error: 'AUDITOR MODE ACTIVE',
                message: 'Your account is restricted to Read-Only access. Financial and administrative changes are blocked.'
            });
        }
    }
    next();
};

/**
 * 🕵️ AUDITOR MODE: Read Logging
 */
const logReadView = (req, res, next) => {
    if (req.method === 'GET' && req.user && req.user.role && req.user.role.toLowerCase() === 'auditor') {
        const endpoint = req.originalUrl || req.url;
        const userId = req.user.id;
        const officerName = req.user.name || 'Auditor';

        const parts = endpoint.split('/');
        const module = parts[2] || 'general';

        db.run(`INSERT INTO audit_read_logs (user_id, officer_name, module, endpoint, details) 
                VALUES (?, ?, ?, ?, ?)`,
            [userId, officerName, module.toUpperCase(), endpoint, JSON.stringify(req.query)],
            (err) => {
                if (err) console.error("Read Audit Log Error:", err);
            }
        );
    }
    next();
};

/**
 * 🛡️ Token Authentication Middleware
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;

        enforceAuditorLimits(req, res, () => {
            logReadView(req, res, next);
        });
    });
};

/**
 * 👑 Admin/Director Role Guard
 */
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role) {
        const role = req.user.role.toLowerCase();
        if (role === 'admin' || role === 'director') {
            return next();
        }
    }
    res.status(403).json({ error: 'Access denied: Admin or Director privileges required' });
};

module.exports = { authenticateToken, isAdmin };
