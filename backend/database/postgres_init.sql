-- UKOMBOZI Institutional Database Schema (PostgreSQL)

-- 1. GROUPS TABLE
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    location TEXT,
    meetingDay TEXT,
    chairperson TEXT,
    secretary TEXT,
    treasurer TEXT,
    chairperson_id TEXT,
    secretary_id TEXT,
    treasurer_id TEXT,
    registrationDate DATE,
    meetingFrequency TEXT,
    dividendPolicy TEXT,
    minMonthlySaving REAL DEFAULT 0,
    loanMultiplier REAL DEFAULT 3,
    stlInterestRate REAL DEFAULT 1,
    ltlInterestRate REAL DEFAULT 1,
    financial_year INTEGER,
    freeze_status TEXT DEFAULT 'unfrozen',
    freeze_reason TEXT,
    status TEXT DEFAULT 'active',
    is_frozen INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. OFFICERS
CREATE TABLE IF NOT EXISTS officers(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE,
    password_hash TEXT,
    status TEXT DEFAULT 'active',
    freeze_status TEXT DEFAULT 'unfrozen',
    freeze_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. MEMBERS TABLE
CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    group_id INTEGER NOT NULL REFERENCES groups(id),
    status TEXT DEFAULT 'active',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opening_balance_savings REAL DEFAULT 0,
    opening_balance_ltl REAL DEFAULT 0,
    opening_balance_stl REAL DEFAULT 0,
    opening_balance_set_by INTEGER,
    opening_balance_set_at TIMESTAMP,
    opening_balance_reason TEXT,
    opening_balance_locked INTEGER DEFAULT 0,
    current_savings REAL DEFAULT 0,
    active_loan_balance REAL DEFAULT 0,
    welfare_balance REAL DEFAULT 0,
    risk_score INTEGER DEFAULT 50,
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_relationship TEXT,
    next_of_kin_member_id INTEGER REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. MEETING SESSIONS
CREATE TABLE IF NOT EXISTS meeting_sessions (
    id SERIAL PRIMARY KEY,
    groupId INTEGER NOT NULL REFERENCES groups(id),
    officerId INTEGER NOT NULL REFERENCES officers(id),
    date DATE NOT NULL,
    startTime TIME,
    endTime TIME,
    location TEXT,
    status TEXT DEFAULT 'ACTIVE',
    notes TEXT,
    meeting_type TEXT DEFAULT 'Regular',
    attendance_summary JSONB,
    venue TEXT,
    agenda TEXT,
    expected_attendance INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions(
    id SERIAL PRIMARY KEY,
    sessionId INTEGER REFERENCES meeting_sessions(id),
    memberId INTEGER NOT NULL REFERENCES members(id),
    memberName TEXT,
    attended INTEGER DEFAULT 1,
    savings_amount REAL DEFAULT 0,
    stl_repayment REAL DEFAULT 0,
    ltl_repayment REAL DEFAULT 0,
    loan_interest REAL DEFAULT 0,
    welfare REAL DEFAULT 0,
    fines REAL DEFAULT 0,
    withdrawals REAL DEFAULT 0,
    loans_issued REAL DEFAULT 0,
    transaction_type TEXT,
    description TEXT,
    status TEXT DEFAULT 'COMPLETED',
    uploaded INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. LOANS TABLE
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    group_id INTEGER NOT NULL REFERENCES groups(id),
    loan_type TEXT NOT NULL,
    principal_amount REAL NOT NULL,
    interest_rate REAL NOT NULL,
    outstanding_interest REAL DEFAULT 0,
    outstanding_penalty REAL DEFAULT 0,
    issued_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'active',
    issued_by INTEGER REFERENCES officers(id),
    guarantor1_id INTEGER REFERENCES members(id),
    guarantor2_id INTEGER REFERENCES members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. LOAN PRODUCTS
CREATE TABLE IF NOT EXISTS loan_products(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    loan_amount REAL NOT NULL,
    monthly_installment REAL NOT NULL,
    principal_portion REAL NOT NULL,
    interest_portion REAL NOT NULL,
    shares_contribution REAL NOT NULL,
    repayment_period_months INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. REPAYMENT SCHEDULE
CREATE TABLE IF NOT EXISTS repayment_schedule (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    expected_installment REAL NOT NULL,
    expected_principal REAL NOT NULL,
    expected_interest REAL NOT NULL,
    expected_shares REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    actual_payment REAL DEFAULT 0,
    payment_date TIMESTAMP,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. CENTRAL LEDGER (Financial Integrity)
CREATE TABLE IF NOT EXISTS account_balances (
    id SERIAL PRIMARY KEY,
    account_name TEXT UNIQUE NOT NULL, -- e.g., 'GROUP_CASH_1', 'SYSTEM_WELFARE'
    account_category TEXT NOT NULL, -- 'GROUP', 'SYSTEM'
    balance REAL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    tx_ref TEXT NOT NULL, -- Not unique: many entries per physical transaction
    account_name TEXT NOT NULL, -- Logical account name (e.g., 'SAVINGS', 'CASH', 'WELFARE')
    entity_type TEXT CHECK(entity_type IN ('MEMBER', 'GROUP', 'SYSTEM')),
    entity_id INTEGER, -- references members(id) or groups(id)
    direction TEXT CHECK(direction IN ('CREDIT', 'DEBIT')),
    amount REAL NOT NULL,
    session_id INTEGER REFERENCES meeting_sessions(id),
    officer_id INTEGER REFERENCES officers(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_tx_ref ON ledger_entries(tx_ref);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_name);

-- 10. SUPERVISOR WORKFLOW
CREATE TABLE IF NOT EXISTS session_approval_requests (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL UNIQUE REFERENCES meeting_sessions(id),
    requester_id INTEGER NOT NULL REFERENCES officers(id),
    reason TEXT NOT NULL,
    status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
    approver_id INTEGER REFERENCES officers(id),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. RISK ENGINE
CREATE TABLE IF NOT EXISTS risk_scores (
    id SERIAL PRIMARY KEY,
    scope TEXT CHECK(scope IN ('GROUP', 'MEMBER', 'OFFICER')),
    target_id INTEGER NOT NULL,
    score REAL DEFAULT 0,
    metrics_snapshot JSONB,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_alerts (
    id SERIAL PRIMARY KEY,
    scope TEXT CHECK(scope IN ('GROUP', 'MEMBER', 'OFFICER')),
    target_id INTEGER NOT NULL,
    alert_type TEXT,
    severity TEXT,
    message TEXT,
    is_resolved INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. ATTENDANCE TRACKING
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES meeting_sessions(id),
    member_id INTEGER NOT NULL REFERENCES members(id),
    status TEXT CHECK(status IN ('PRESENT', 'ABSENT', 'LATE')) DEFAULT 'PRESENT',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, member_id)
);

-- 13. DIVIDEND ENGINE
CREATE TABLE IF NOT EXISTS dividend_runs(
    id SERIAL PRIMARY KEY,
    financial_year INTEGER,
    group_id INTEGER REFERENCES groups(id),
    run_number TEXT UNIQUE,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dividend_allocations(
    id SERIAL PRIMARY KEY,
    dividend_run_id INTEGER REFERENCES dividend_runs(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id),
    average_shares REAL,
    gross_dividend REAL,
    arrears_offset REAL,
    net_dividend REAL,
    posted_to_savings INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. CASHBOOK & RECONCILIATION
CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY,
    cash_session_id TEXT NOT NULL,
    source TEXT,
    reference_id TEXT,
    direction TEXT CHECK(direction IN ('IN','OUT')),
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES officers(id)
);

-- 10. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings(
    key TEXT PRIMARY KEY,
    value TEXT,
    category TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. SMS LOGS
CREATE TABLE IF NOT EXISTS sms_logs(
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    cost REAL DEFAULT 0,
    status TEXT DEFAULT 'SENT',
    error_message TEXT,
    transaction_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. PROJECT SAVINGS
CREATE TABLE IF NOT EXISTS project_registrations(
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    project_type TEXT NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fee_paid REAL DEFAULT 200,
    year INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_savings(
    id SERIAL PRIMARY KEY,
    registration_id INTEGER NOT NULL REFERENCES project_registrations(id),
    amount REAL NOT NULL,
    date DATE NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    payout_status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default system settings
INSERT INTO system_settings (key, value, category, description) 
VALUES ('system_freeze', 'false', 'SECURITY', 'Emergency Global Freeze')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, category, description) 
VALUES ('min_liquidity_threshold', '0', 'FINANCIAL', 'Minimum group liquidity threshold')
ON CONFLICT (key) DO NOTHING;
