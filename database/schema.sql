-- ============================================
-- UKOMBOZINI TBMS - INSTITUTIONAL DATABASE SCHEMA
-- Version: 2.1 (MTE v2 + Supervisor Workflow)
-- ============================================

-- 1. GROUPS & GOVERNANCE
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    location TEXT,
    meetingDay TEXT,
    chairperson TEXT,
    secretary TEXT,
    treasurer TEXT,
    chairperson_id TEXT,
    secretary_id TEXT,
    treasurer_id TEXT,
    registrationDate TEXT,
    meetingFrequency TEXT,
    dividendPolicy TEXT,
    minMonthlySaving REAL DEFAULT 0,
    loanMultiplier REAL DEFAULT 3,
    stlInterestRate REAL DEFAULT 1,
    ltlInterestRate REAL DEFAULT 1,
    financial_year INTEGER,
    freeze_status TEXT DEFAULT 'unfrozen',
    freeze_reason TEXT,
    status TEXT DEFAULT 'active' CHECK( status IN ('active', 'suspended', 'inactive') ),
    is_frozen INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'officer',
    password_hash TEXT,
    status TEXT DEFAULT 'active',
    phone TEXT,
    freeze_status TEXT DEFAULT 'unfrozen',
    freeze_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_officials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    term_start TEXT NOT NULL,
    term_end TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 2. MEMBERS & FINANCIALS
CREATE TABLE members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    group_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
    opening_balance_savings REAL DEFAULT 0,
    opening_balance_ltl REAL DEFAULT 0,
    opening_balance_stl REAL DEFAULT 0,
    opening_balance_set_by INTEGER,
    opening_balance_set_at TEXT,
    opening_balance_reason TEXT,
    opening_balance_locked INTEGER DEFAULT 0,
    current_savings REAL DEFAULT 0,
    active_loan_balance REAL DEFAULT 0,
    welfare_balance REAL DEFAULT 0,
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_relationship TEXT,
    next_of_kin_member_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id)
);

-- 3. MEETING SESSIONS & TRANSACTION LOGS
CREATE TABLE meeting_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    groupId INTEGER NOT NULL,
    officerId INTEGER NOT NULL,
    date TEXT NOT NULL,
    startTime TEXT,
    endTime TEXT,
    location TEXT,
    status TEXT DEFAULT 'draft' CHECK( status IN ('draft', 'ACTIVE', 'PENDING_APPROVAL', 'POSTED', 'REVERSED') ),
    notes TEXT,
    meeting_type TEXT DEFAULT 'Regular',
    attendance_summary TEXT, -- JSON
    venue TEXT,
    agenda TEXT,
    expected_attendance INTEGER,
    ukombozini_repayment REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (groupId) REFERENCES groups(id)
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId INTEGER,
    memberId INTEGER NOT NULL,
    memberName TEXT,
    attended INTEGER DEFAULT 1,
    savings_amount REAL DEFAULT 0,
    stl_repayment REAL DEFAULT 0,
    ltl_repayment REAL DEFAULT 0,
    loan_interest REAL DEFAULT 0,
    loan_principal REAL DEFAULT 0,
    welfare REAL DEFAULT 0,
    project REAL DEFAULT 0,
    fines REAL DEFAULT 0,
    withdrawals REAL DEFAULT 0,
    loans_issued REAL DEFAULT 0,
    transaction_type TEXT,
    description TEXT,
    reference TEXT,
    uploaded INTEGER DEFAULT 0,
    group_id INTEGER,
    status TEXT DEFAULT 'COMPLETED',
    amount REAL DEFAULT 0,
    type TEXT,
    loan_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sessionId) REFERENCES meeting_sessions(id),
    FOREIGN KEY(memberId) REFERENCES members(id)
);

-- 4. TRIPLE-ENTRY LEDGER (MTE v2)
CREATE TABLE account_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT UNIQUE NOT NULL,
    account_category TEXT NOT NULL, -- 'MEMBER', 'GROUP', 'SYSTEM'
    balance REAL DEFAULT 0,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_ref TEXT NOT NULL,
    account_name TEXT NOT NULL,
    entity_type TEXT CHECK(entity_type IN ('MEMBER', 'GROUP', 'SYSTEM')),
    entity_id INTEGER,
    direction TEXT CHECK(direction IN ('CREDIT', 'DEBIT')),
    amount REAL NOT NULL,
    session_id INTEGER,
    officer_id INTEGER,
    notes TEXT,
    status TEXT DEFAULT 'POSTED',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id)
);

-- 5. LOANS & REPAYMENT
CREATE TABLE loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    loan_type TEXT NOT NULL,
    principal_amount REAL NOT NULL,
    interest_rate REAL NOT NULL,
    issued_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    issued_by INTEGER,
    guarantor1_id INTEGER,
    guarantor2_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (group_id) REFERENCES groups(id)
);

CREATE TABLE loan_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    session_id INTEGER,
    amount_paid REAL NOT NULL,
    principal_paid REAL DEFAULT 0,
    interest_paid REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    payment_ref TEXT UNIQUE,
    payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
    posted_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id)
);

CREATE TABLE repayment_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    expected_installment REAL NOT NULL,
    expected_principal REAL NOT NULL,
    expected_interest REAL NOT NULL,
    expected_shares REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    actual_payment REAL DEFAULT 0,
    payment_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id)
);

-- 6. SUPERVISOR WORKFLOW
CREATE TABLE session_approval_requests (
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
);

-- 7. AUDIT & RISK
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    category TEXT,
    target_type TEXT,
    target_id INTEGER,
    details TEXT,
    officer_id INTEGER,
    officer_name TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE risk_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT CHECK(scope IN ('GROUP', 'MEMBER', 'OFFICER')),
    target_id INTEGER NOT NULL,
    score REAL DEFAULT 0,
    metrics_snapshot TEXT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE risk_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT CHECK(scope IN ('GROUP', 'MEMBER', 'OFFICER')),
    target_id INTEGER NOT NULL,
    alert_type TEXT,
    severity TEXT,
    message TEXT,
    is_resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. SYSTEM & UTILITIES
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT
);

CREATE TABLE sms_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER,
    phone TEXT,
    message TEXT,
    type TEXT,
    status TEXT DEFAULT 'SENT',
    transaction_id INTEGER,
    cost REAL DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. SEED DATA (CORE SETTINGS)
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES ('SYSTEM_LOCKDOWN', 'false', 'Emergency Global Freeze');
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES ('ALLOW_OVERDRAFTS', 'false', 'Allow negative operational balances');

