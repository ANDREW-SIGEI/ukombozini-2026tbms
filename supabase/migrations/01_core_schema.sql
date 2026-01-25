-- ============================================
-- UKOMBOZI TBMS - CENTRALIZED DATABASE SCHEMA
-- ============================================
-- Purpose: Single source of truth for multi-officer table banking
-- Architecture: Transaction-based (no stored balances)
-- Security: Row Level Security + Audit Trail
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (Auth + Business Roles)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('director', 'admin', 'field_officer', 'member')),
    active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Links Supabase Auth users to business roles';
COMMENT ON COLUMN profiles.role IS 'director: full access | admin: system management | field_officer: data capture only | member: read-only own data';

-- ============================================
-- 2. GROUPS (Table Banking Groups)
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
    id BIGSERIAL PRIMARY KEY,
    group_name TEXT NOT NULL UNIQUE,
    meeting_day TEXT CHECK (meeting_day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    meeting_frequency TEXT CHECK (meeting_frequency IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    location TEXT,
    chairperson TEXT,
    secretary TEXT,
    treasurer TEXT,
    registration_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'CLOSED')),
    opening_balance NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE groups IS 'Table banking groups with meeting schedule information';

-- ============================================
-- 3. OFFICER ASSIGNMENTS (Access Control)
-- ============================================
CREATE TABLE IF NOT EXISTS officer_groups (
    id BIGSERIAL PRIMARY KEY,
    officer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES profiles(id),
    UNIQUE(officer_id, group_id)
);

COMMENT ON TABLE officer_groups IS 'Controls which groups a field officer can access - CRITICAL for RLS';

-- ============================================
-- 4. MEMBERS (Identity Only - NO Balances)
-- ============================================
CREATE TABLE IF NOT EXISTS members (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'exited')),
    
    -- Opening balances (SET ONCE, LOCKED)
    opening_balance_savings NUMERIC(15, 2) DEFAULT 0,
    opening_balance_ltl NUMERIC(15, 2) DEFAULT 0, -- Long Term Loan
    opening_balance_stl NUMERIC(15, 2) DEFAULT 0, -- Short Term Loan
    opening_balance_reason TEXT,
    opening_balance_set_by UUID REFERENCES profiles(id),
    opening_balance_set_at TIMESTAMPTZ,
    opening_balance_locked BOOLEAN DEFAULT FALSE,
    
    -- Cached Balances (Updated via Triggers)
    current_savings NUMERIC(15, 2) DEFAULT 0,
    active_loan_balance NUMERIC(15, 2) DEFAULT 0,
    arrears_balance NUMERIC(15, 2) DEFAULT 0,

    -- Communications
    sms_notifications_enabled BOOLEAN DEFAULT TRUE,
    last_sms_sent_at TIMESTAMPTZ,

    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure cached balance columns exist if table pre-existed
DO $$
BEGIN
    ALTER TABLE members ADD COLUMN IF NOT EXISTS current_savings NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS active_loan_balance NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS arrears_balance NUMERIC(15, 2) DEFAULT 0;
    
    -- Communications columns
    ALTER TABLE members ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS last_sms_sent_at TIMESTAMPTZ;
END $$;

COMMENT ON TABLE members IS 'Member identity - balances calculated from transactions table';
COMMENT ON COLUMN members.opening_balance_locked IS 'Once TRUE, opening balances cannot be changed - audit protection';

-- ============================================
-- 5. MEETING SESSIONS (Table Banking Sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_sessions (
    id SERIAL PRIMARY KEY,
    session_number VARCHAR(50) UNIQUE NOT NULL,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- Session Details
    meeting_date DATE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    venue TEXT,
    
    -- Meeting Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'CANCELLED')),
    
    -- Financial Summary (auto-calculated)
    total_savings DECIMAL(10, 2) DEFAULT 0,
    total_stl_repayments DECIMAL(10, 2) DEFAULT 0,
    total_ltl_repayments DECIMAL(10, 2) DEFAULT 0,
    total_welfare DECIMAL(10, 2) DEFAULT 0,
    total_project DECIMAL(10, 2) DEFAULT 0,
    total_fines DECIMAL(10, 2) DEFAULT 0,
    total_loan_interest DECIMAL(10, 2) DEFAULT 0,
    
    -- New: Income Tracking
    total_withdrawals DECIMAL(12,2) DEFAULT 0,
    total_dividends_distributed DECIMAL(12,2) DEFAULT 0,

    total_collected DECIMAL(10, 2) GENERATED ALWAYS AS (
        total_savings + total_stl_repayments + total_ltl_repayments + 
        total_welfare + total_project + total_fines + total_loan_interest
    ) STORED,
    
    -- Loan Activity
    loans_disbursed_count INTEGER DEFAULT 0,
    total_loans_disbursed DECIMAL(10, 2) DEFAULT 0,
    
    -- Attendance
    members_present INTEGER DEFAULT 0,
    members_absent INTEGER DEFAULT 0,
    attendance_percentage DECIMAL(5, 2),
    
    -- Control Fields
    opened_by UUID NOT NULL REFERENCES profiles(id),
    opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    closed_by UUID REFERENCES profiles(id),
    closed_at TIMESTAMP,
    closing_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_meeting_dates CHECK (
        (end_time IS NULL OR end_time > start_time)
    )
);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_group ON meeting_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_date ON meeting_sessions(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_status ON meeting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_number ON meeting_sessions(session_number);

COMMENT ON TABLE meeting_sessions IS 'Official group meeting sessions with transaction locking';

-- ============================================
-- 6. MEETING ATTENDANCE
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_attendance (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    
    status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'EXCUSED', 'LATE')),
    arrival_time TIMESTAMP,
    
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    recorded_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(session_id, member_id)
);

-- ============================================
-- 7. LOAN PRODUCTS (Standardized Terms)
-- ============================================
CREATE TABLE IF NOT EXISTS loan_products (
    id BIGSERIAL PRIMARY KEY,
    loan_amount DECIMAL(12,2) NOT NULL UNIQUE,
    monthly_installment DECIMAL(12,2) NOT NULL,
    principal_portion DECIMAL(12,2) NOT NULL,
    interest_portion DECIMAL(12,2) NOT NULL,
    shares_contribution DECIMAL(12,2) NOT NULL,
    repayment_period_months INTEGER NOT NULL,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    CONSTRAINT valid_installment CHECK (monthly_installment > 0),
    CONSTRAINT valid_principal CHECK (principal_portion > 0),
    CONSTRAINT valid_period CHECK (repayment_period_months BETWEEN 1 AND 36)
);

-- ============================================
-- 8. LOANS (Contract Definition)
-- ============================================
CREATE TABLE IF NOT EXISTS loans (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    disbursement_session_id INTEGER REFERENCES meeting_sessions(id) ON DELETE SET NULL,
    
    loan_type TEXT NOT NULL CHECK (loan_type IN ('STL', 'LTL', 'EMERGENCY')),
    principal_amount NUMERIC(15, 2) NOT NULL CHECK (principal_amount > 0),
    interest_rate NUMERIC(5, 2) NOT NULL CHECK (interest_rate >= 0),
    issued_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'written_off')),
    
    -- Audit trail
    issued_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE loans IS 'Loan contracts - outstanding balance calculated from transactions';

-- ============================================
-- 9. REPAYMENT SCHEDULE (For reducing balance loans etc)
-- ============================================
CREATE TABLE IF NOT EXISTS repayment_schedule (
    id BIGSERIAL PRIMARY KEY,
    loan_id BIGINT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    
    expected_installment NUMERIC(15, 2) NOT NULL,
    expected_principal NUMERIC(15, 2) NOT NULL,
    expected_interest NUMERIC(15, 2) NOT NULL,
    expected_shares NUMERIC(15, 2) NOT NULL,
    
    paid_amount NUMERIC(15, 2) DEFAULT 0,
    paid_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    days_overdue INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(loan_id, installment_number)
);

-- ============================================
-- 10. TRANSACTIONS (SINGLE SOURCE OF TRUTH)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    session_id INTEGER REFERENCES meeting_sessions(id) ON DELETE SET NULL, -- Link to meeting
    
    -- Optional links
    loan_id BIGINT REFERENCES loans(id) ON DELETE RESTRICT,
    
    type TEXT NOT NULL CHECK (type IN (
        'savings',
        'loan_disbursement',
        'loan_repayment',
        'fine',
        'welfare',
        'project',
        'dividend',
        'withdrawal',
        'reversal',
        'application_fee',
        'appreciation_fee',
        'share_transfer'
    )),
    
    amount NUMERIC(15, 2) NOT NULL CHECK (amount != 0),
    
    -- Detailed Breakdown (for repayments)
    principal_paid NUMERIC(15, 2) DEFAULT 0,
    interest_paid NUMERIC(15, 2) DEFAULT 0,
    penalty_paid NUMERIC(15, 2) DEFAULT 0,
    new_balance NUMERIC(15, 2), -- Snapshot after tx

    reference TEXT,
    notes TEXT,
    
    -- Audit trail (CRITICAL)
    posted_by UUID NOT NULL REFERENCES profiles(id),
    reversed BOOLEAN DEFAULT FALSE,
    reversal_id BIGINT, -- Self-reference added later via ALTER
    reversal_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_reversal'
    ) THEN
        ALTER TABLE transactions ADD CONSTRAINT fk_reversal FOREIGN KEY (reversal_id) REFERENCES transactions(id);
    END IF;
END $$;

COMMENT ON TABLE transactions IS 'HEART OF THE SYSTEM - All balances calculated from here';
COMMENT ON COLUMN transactions.amount IS 'Positive = credit (money in), Negative = debit (money out)';

-- ============================================
-- SCHEMA ALIGNMENT (Ensure columns exist if tables pre-existed)
-- ============================================
DO $$
BEGIN
    -- Ensure transactions has session_id
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES meeting_sessions(id) ON DELETE SET NULL;
    
    -- Ensure meeting_attendance has session_id
    ALTER TABLE meeting_attendance ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES meeting_sessions(id) ON DELETE CASCADE;

    -- Ensure loans has disbursement_session_id
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS disbursement_session_id INTEGER REFERENCES meeting_sessions(id) ON DELETE SET NULL;
END $$;

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(member_id) WHERE reversed = FALSE;
CREATE INDEX IF NOT EXISTS idx_transactions_group ON transactions(group_id) WHERE reversed = FALSE;
CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions(session_id) WHERE reversed = FALSE;
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type) WHERE reversed = FALSE;

-- ============================================
-- 11. REVERSALS (Audit-Safe Corrections)
-- ============================================
CREATE TABLE IF NOT EXISTS reversals (
    id BIGSERIAL PRIMARY KEY,
    original_transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    reversal_transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    approved_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reversals IS 'Audit trail for corrections - NO HARD DELETES allowed';


-- ============================================
-- 12. SYSTEM SETTINGS (Configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. AUDIT LOG (Full System Activity)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id BIGINT,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_sessions_updated_at ON meeting_sessions;
CREATE TRIGGER update_meeting_sessions_updated_at BEFORE UPDATE ON meeting_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loans_updated_at ON loans;
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_repayment_schedule_updated_at ON repayment_schedule;
CREATE TRIGGER update_repayment_schedule_updated_at BEFORE UPDATE ON repayment_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 15. AUTH TRIGGER (New User -> Profile)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    new.raw_user_meta_data->>'phone', 
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'member')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger onto auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SUCCESS MESSAGE
DO $$
BEGIN
    RAISE NOTICE '✅ UKOMBOZI TBMS Core Schema Created Successfully';
END $$;
