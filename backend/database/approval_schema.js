/**
 * UKOMBOZINI TBMS - Supervisor Approval Schema
 * Manages the lifecycle of high-variance session approvals.
 */

const initApprovalSchema = (db) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS session_approval_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL UNIQUE,
                requester_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
                approver_id INTEGER,
                comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES meeting_sessions(id),
                FOREIGN KEY(requester_id) REFERENCES officers(id),
                FOREIGN KEY(approver_id) REFERENCES officers(id)
            )`, (err) => {
                if (err) return reject(err);

                // Index for faster lookups
                db.run(`CREATE INDEX IF NOT EXISTS idx_approval_session ON session_approval_requests(session_id)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_approval_status ON session_approval_requests(status)`);

                console.log("[SCHEMA] Supervisor Approval System Ready.");
                resolve();
            });
        });
    });
};

module.exports = { initApprovalSchema };
