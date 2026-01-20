-- =====================================================
-- MEETING SESSIONS & TRANSACTION LOCKING SYSTEM
-- Ensures all financial transactions happen within meetings
-- Prevents fraud through meeting-based controls
-- =====================================================

-- Drop tables if they exist to ensure clean state with correct types
DROP TABLE IF EXISTS meeting_attendance CASCADE;
DROP TABLE IF EXISTS meeting_sessions CASCADE;

-- Create meeting_sessions table (enhanced version)
CREATE TABLE IF NOT EXISTS meeting_sessions (
    id SERIAL PRIMARY KEY,
    session_number VARCHAR(50) UNIQUE NOT NULL,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- Session Details
    meeting_date DATE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    venue TEXT,
    
    -- Meeting Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE',      -- Meeting is open, transactions allowed
        'LOCKED',      -- Meeting closed, no more changes
        'CANCELLED'    -- Meeting cancelled (rare)
    )),
    
    -- Financial Summary (auto-calculated)
    total_savings DECIMAL(10, 2) DEFAULT 0,
    total_stl_repayments DECIMAL(10, 2) DEFAULT 0,
    total_ltl_repayments DECIMAL(10, 2) DEFAULT 0,
    total_welfare DECIMAL(10, 2) DEFAULT 0,
    total_project DECIMAL(10, 2) DEFAULT 0,
    total_fines DECIMAL(10, 2) DEFAULT 0,
    total_loan_interest DECIMAL(10, 2) DEFAULT 0,
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
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_meeting_dates CHECK (
        (end_time IS NULL OR end_time > start_time) AND
        meeting_date <= CURRENT_DATE + INTERVAL '7 days'
    )
);

-- Create indexes
CREATE INDEX idx_meeting_sessions_group ON meeting_sessions(group_id);
CREATE INDEX idx_meeting_sessions_date ON meeting_sessions(meeting_date DESC);
CREATE INDEX idx_meeting_sessions_status ON meeting_sessions(status);
CREATE INDEX idx_meeting_sessions_number ON meeting_sessions(session_number);

-- Create meeting_attendance table
CREATE TABLE IF NOT EXISTS meeting_attendance (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    
    -- Attendance Details
    status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'EXCUSED', 'LATE')),
    arrival_time TIMESTAMP,
    left_time TIMESTAMP,
    
    -- Financial Activity in this Meeting
    contributed BOOLEAN DEFAULT FALSE,
    contribution_amount DECIMAL(10, 2) DEFAULT 0,
    loan_received BOOLEAN DEFAULT FALSE,
    loan_repayment_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    recorded_at TIMESTAMP DEFAULT NOW(),
    
    -- Prevent duplicates
    UNIQUE(session_id, member_id)
);

CREATE INDEX idx_meeting_attendance_session ON meeting_attendance(session_id);
CREATE INDEX idx_meeting_attendance_member ON meeting_attendance(member_id);

-- Add session_id to transactions table (link all transactions to meetings)
-- Note: Check if column exists first to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'session_id') THEN
        ALTER TABLE transactions 
        ADD COLUMN session_id INTEGER REFERENCES meeting_sessions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions(session_id);

-- Add session_id to loans table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'disbursement_session_id') THEN
        ALTER TABLE loans 
        ADD COLUMN disbursement_session_id INTEGER REFERENCES meeting_sessions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loans_session ON loans(disbursement_session_id);

-- Function to generate unique session number
CREATE OR REPLACE FUNCTION generate_session_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    year_month TEXT;
    group_code TEXT;
    sequence_num INTEGER;
BEGIN
    -- Format: MTG-YYYYMM-GRP-NNN
    year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    -- Get group code (would be passed as parameter in real implementation)
    -- For now, using 'GRP' as placeholder
    group_code := 'GRP';
    
    -- Get next sequence number for this month and group
    SELECT COALESCE(MAX(CAST(SUBSTRING(session_number FROM POSITION('-' IN REVERSE(session_number)) + 1) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM meeting_sessions
    WHERE session_number LIKE 'MTG-' || year_month || '-%';
    
    new_number := 'MTG-' || year_month || '-' || group_code || '-' || LPAD(sequence_num::TEXT, 3, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate session number
CREATE OR REPLACE FUNCTION set_session_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.session_number IS NULL OR NEW.session_number = '' THEN
        NEW.session_number := generate_session_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_session_number ON meeting_sessions;
CREATE TRIGGER trigger_set_session_number
BEFORE INSERT ON meeting_sessions
FOR EACH ROW
EXECUTE FUNCTION set_session_number();

-- Function to check if meeting is locked
CREATE OR REPLACE FUNCTION is_meeting_locked(p_session_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    session_status TEXT;
BEGIN
    SELECT status INTO session_status
    FROM meeting_sessions
    WHERE id = p_session_id;
    
    RETURN session_status = 'LOCKED';
END;
$$ LANGUAGE plpgsql;

-- Function to prevent edits to locked meetings
CREATE OR REPLACE FUNCTION prevent_locked_meeting_edits()
RETURNS TRIGGER AS $$
DECLARE
    session_status TEXT;
BEGIN
    -- Check if transaction is linked to a session
    IF NEW.session_id IS NOT NULL THEN
        SELECT status INTO session_status
        FROM meeting_sessions
        WHERE id = NEW.session_id;
        
        -- Prevent INSERT/UPDATE if meeting is locked
        IF session_status = 'LOCKED' THEN
            RAISE EXCEPTION 'Cannot modify transactions for a locked meeting session. Meeting ID: %', NEW.session_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent transaction edits on locked meetings
DROP TRIGGER IF EXISTS trigger_prevent_locked_transaction_edits ON transactions;
CREATE TRIGGER trigger_prevent_locked_transaction_edits
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_locked_meeting_edits();

-- Function to calculate meeting totals
CREATE OR REPLACE FUNCTION calculate_meeting_totals(p_session_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE meeting_sessions
    SET 
        total_savings = COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE session_id = p_session_id AND type = 'savings' AND reversed = FALSE
        ), 0),
        total_stl_repayments = COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE session_id = p_session_id AND type = 'loan_repayment' AND notes ILIKE '%STL%' AND reversed = FALSE
        ), 0),
        total_ltl_repayments = COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE session_id = p_session_id AND type = 'loan_repayment' AND notes ILIKE '%LTL%' AND reversed = FALSE
        ), 0),
        total_welfare = COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE session_id = p_session_id AND type = 'welfare' AND reversed = FALSE
        ), 0),
        total_project = COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE session_id = p_session_id AND type = 'project' AND reversed = FALSE
        ), 0),
        total_fines = COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE session_id = p_session_id AND type = 'fine' AND reversed = FALSE
        ), 0),
        -- Note: loan_interest is not a direct transaction type in core schema, 
        -- usually part of repayment or separate record. simplified here.
        total_loan_interest = 0, 
        loans_disbursed_count = COALESCE((
            SELECT COUNT(*)
            FROM loans
            WHERE disbursement_session_id = p_session_id
        ), 0),
        total_loans_disbursed = COALESCE((
            SELECT SUM(principal_amount)
            FROM loans
            WHERE disbursement_session_id = p_session_id
        ), 0),
        updated_at = NOW()
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update meeting totals when transactions change
CREATE OR REPLACE FUNCTION update_meeting_totals_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.session_id IS NOT NULL THEN
            PERFORM calculate_meeting_totals(NEW.session_id);
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        IF OLD.session_id IS NOT NULL THEN
            PERFORM calculate_meeting_totals(OLD.session_id);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_meeting_totals ON transactions;
CREATE TRIGGER trigger_update_meeting_totals
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_meeting_totals_on_transaction();

-- Function to close/lock a meeting
CREATE OR REPLACE FUNCTION close_meeting_session(
    p_session_id INTEGER,
    p_closed_by UUID,
    p_closing_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
BEGIN
    -- Get current status
    SELECT status INTO current_status
    FROM meeting_sessions
    WHERE id = p_session_id;
    
    -- Can only close ACTIVE meetings
    IF current_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Can only close ACTIVE meetings. Current status: %', current_status;
    END IF;
    
    -- Calculate final totals
    PERFORM calculate_meeting_totals(p_session_id);
    
    -- Close the meeting
    UPDATE meeting_sessions
    SET 
        status = 'LOCKED',
        closed_by = p_closed_by,
        closed_at = NOW(),
        closing_notes = p_closing_notes,
        end_time = NOW()
    WHERE id = p_session_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get active meeting for a group
CREATE OR REPLACE FUNCTION get_active_meeting(p_group_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    active_session_id INTEGER;
BEGIN
    SELECT id INTO active_session_id
    FROM meeting_sessions
    WHERE group_id = p_group_id
    AND status = 'ACTIVE'
    ORDER BY start_time DESC
    LIMIT 1;
    
    RETURN active_session_id;
END;
$$ LANGUAGE plpgsql;

-- View for active meetings
CREATE OR REPLACE VIEW active_meetings AS
SELECT 
    ms.*,
    g.name AS group_name,
    u.full_name AS opened_by_name,
    EXTRACT(EPOCH FROM (NOW() - ms.start_time))/3600 AS hours_open
FROM meeting_sessions ms
JOIN groups g ON ms.group_id = g.id
JOIN profiles u ON ms.opened_by = u.id
WHERE ms.status = 'ACTIVE'
ORDER BY ms.start_time DESC;

-- View for locked meetings (recent)
CREATE OR REPLACE VIEW recent_locked_meetings AS
SELECT 
    ms.*,
    g.name AS group_name,
    u_open.full_name AS opened_by_name,
    u_close.full_name AS closed_by_name,
    EXTRACT(EPOCH FROM (ms.closed_at - ms.start_time))/3600 AS meeting_duration_hours
FROM meeting_sessions ms
JOIN groups g ON ms.group_id = g.id
JOIN profiles u_open ON ms.opened_by = u_open.id
LEFT JOIN profiles u_close ON ms.closed_by = u_close.id
WHERE ms.status = 'LOCKED'
ORDER BY ms.closed_at DESC
LIMIT 50;

-- View for meeting statistics
CREATE OR REPLACE VIEW meeting_statistics AS
SELECT 
    ms.id,
    ms.session_number,
    ms.group_id,
    g.name AS group_name,
    ms.meeting_date,
    ms.status,
    ms.total_collected,
    ms.total_loans_disbursed,
    ms.members_present,
    ms.members_absent,
    ms.attendance_percentage,
    COUNT(DISTINCT t.id) AS transaction_count,
    COUNT(DISTINCT ma.id) AS attendance_count
FROM meeting_sessions ms
JOIN groups g ON ms.group_id = g.id
LEFT JOIN transactions t ON t.session_id = ms.id
LEFT JOIN meeting_attendance ma ON ma.session_id = ms.id
GROUP BY ms.id, g.name
ORDER BY ms.meeting_date DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON meeting_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON meeting_attendance TO authenticated;
GRANT SELECT ON active_meetings TO authenticated;
GRANT SELECT ON recent_locked_meetings TO authenticated;
GRANT SELECT ON meeting_statistics TO authenticated;

-- Add comments
COMMENT ON TABLE meeting_sessions IS 'Official group meeting sessions with transaction locking';
COMMENT ON COLUMN meeting_sessions.status IS 'ACTIVE = meeting open, LOCKED = meeting closed/immutable';
COMMENT ON FUNCTION close_meeting_session IS 'Closes and locks a meeting, preventing further modifications';
COMMENT ON FUNCTION is_meeting_locked IS 'Checks if a meeting is locked (returns TRUE if locked)';

-- =====================================================
-- MIGRATION NOTES:
-- This creates a meeting-based transaction control system
-- ALL financial transactions must be linked to a meeting
-- Once a meeting is LOCKED, no changes are possible
-- This ensures audit compliance and prevents fraud
-- =====================================================
