-- Contribution Engine Schema Migration
-- Run this script to add the necessary tables for the contribution posting engine

-- Create contribution_ledger table for double-entry accounting
CREATE TABLE IF NOT EXISTS contribution_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_ref TEXT UNIQUE NOT NULL,
    member_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    session_id INTEGER,
    contribution_type TEXT NOT NULL CHECK(contribution_type IN ('savings', 'welfare', 'project', 'registration', 'appreciation')),
    amount REAL NOT NULL CHECK(amount > 0),
    ledger_entries TEXT, -- JSON array of debit/credit entries
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'POSTED', 'REVERSED', 'FAILED')),
    officer_id INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    posted_at DATETIME,
    audit_metadata TEXT, -- JSON with device, IP, etc.
    reversal_reason TEXT,
    reversed_by INTEGER,
    reversed_at DATETIME,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id),
    FOREIGN KEY (officer_id) REFERENCES officers(id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_contribution_member ON contribution_ledger(member_id);
CREATE INDEX IF NOT EXISTS idx_contribution_group ON contribution_ledger(group_id);
CREATE INDEX IF NOT EXISTS idx_contribution_session ON contribution_ledger(session_id);
CREATE INDEX IF NOT EXISTS idx_contribution_status ON contribution_ledger(status);
CREATE INDEX IF NOT EXISTS idx_contribution_type ON contribution_ledger(contribution_type);

-- Add balance columns to members table if not exists
-- These will be updated atomically when contributions are posted
-- Note: Run these only if columns don't exist
-- ALTER TABLE members ADD COLUMN savings_balance REAL DEFAULT 0;
-- ALTER TABLE members ADD COLUMN welfare_balance REAL DEFAULT 0;
-- ALTER TABLE members ADD COLUMN project_balance REAL DEFAULT 0;
