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
    role TEXT NOT NULL CHECK (role IN ('director', 'admin', 'field_officer')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Links Supabase Auth users to business roles';
COMMENT ON COLUMN profiles.role IS 'director: full access | admin: system management | field_officer: data capture only';

-- ============================================
-- 2. GROUPS (Table Banking Groups)
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
    id BIGSERIAL PRIMARY KEY,
    group_name TEXT NOT NULL UNIQUE,
    meeting_day TEXT CHECK (meeting_day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    meeting_frequency TEXT CHECK (meeting_frequency IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    location TEXT,
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
    opening_balance_ltl NUMERIC(15, 2) DEFAULT 0,
    opening_balance_stl NUMERIC(15, 2) DEFAULT 0,
    opening_balance_reason TEXT,
    opening_balance_set_by UUID REFERENCES profiles(id),
    opening_balance_set_at TIMESTAMPTZ,
    opening_balance_locked BOOLEAN DEFAULT FALSE,
    
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE members IS 'Member identity - balances calculated from transactions table';
COMMENT ON COLUMN members.opening_balance_locked IS 'Once TRUE, opening balances cannot be changed - audit protection';

-- ============================================
-- 5. MEETINGS (Table Banking Sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS meetings (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    meeting_date DATE NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'closed')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    posted_by UUID REFERENCES profiles(id),
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, meeting_date)
);

COMMENT ON TABLE meetings IS 'Meetings are containers for transactions - enforces temporal integrity';

-- ============================================
-- 6. LOANS (Contract Definition - NOT Balance)
-- ============================================
CREATE TABLE IF NOT EXISTS loans (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    loan_type TEXT NOT NULL CHECK (loan_type IN ('STL', 'LTL')),
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
-- 7. TRANSACTIONS (SINGLE SOURCE OF TRUTH)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    meeting_id BIGINT REFERENCES meetings(id) ON DELETE RESTRICT,
    loan_id BIGINT REFERENCES loans(id) ON DELETE RESTRICT,
    
    type TEXT NOT NULL CHECK (type IN (
        'savings',
        'loan_disbursement',
        'loan_repayment',
        'fine',
        'welfare',
        'project',
        'dividend',
        'reversal'
    )),
    
    amount NUMERIC(15, 2) NOT NULL CHECK (amount != 0),
    reference TEXT,
    notes TEXT,
    
    -- Audit trail (CRITICAL)
    posted_by UUID NOT NULL REFERENCES profiles(id),
    reversed BOOLEAN DEFAULT FALSE,
    reversal_id BIGINT REFERENCES transactions(id),
    reversal_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE transactions IS 'HEART OF THE SYSTEM - All balances calculated from here';
COMMENT ON COLUMN transactions.amount IS 'Positive = credit (money in), Negative = debit (money out)';
COMMENT ON COLUMN transactions.reversed IS 'If TRUE, this transaction has been reversed (do not count in calculations)';

-- Create index for fast queries
CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(member_id) WHERE reversed = FALSE;
CREATE INDEX IF NOT EXISTS idx_transactions_group ON transactions(group_id) WHERE reversed = FALSE;
CREATE INDEX IF NOT EXISTS idx_transactions_meeting ON transactions(meeting_id) WHERE reversed = FALSE;
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type) WHERE reversed = FALSE;

-- ============================================
-- 8. REVERSALS (Audit-Safe Corrections)
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
-- 9. SYSTEM SETTINGS (Configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE system_settings IS 'System-wide configuration (interest rates, limits, etc.)';

-- ============================================
-- 10. AUDIT LOG (Full System Activity)
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

COMMENT ON TABLE audit_log IS 'Complete audit trail for compliance and dispute resolution';

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loans_updated_at ON loans;
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (Bootstrap)
-- ============================================

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
    ('stl_interest_rate', '10', 'Short-term loan interest rate (%)'),
    ('ltl_interest_rate', '15', 'Long-term loan interest rate (%)'),
    ('max_loan_multiplier', '3', 'Maximum loan = savings × this value'),
    ('min_savings_balance', '1000', 'Minimum savings balance required')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ UKOMBOZI TBMS Core Schema Created Successfully';
    RAISE NOTICE '📊 Transaction-based architecture implemented';
    RAISE NOTICE '🔒 Ready for RLS policies (next step)';
END $$;

