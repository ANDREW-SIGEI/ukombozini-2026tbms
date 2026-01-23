-- =====================================================
-- DAILY CASH RECONCILIATION & VARIANCE DETECTION
-- Ensures every shilling is accounted for
-- "What was collected = what was recorded = what was banked"
-- =====================================================

-- Drop tables if they exist to ensure clean state with correct types
DROP TABLE IF EXISTS reconciliation_variance_history CASCADE;
DROP TABLE IF EXISTS daily_cash_reconciliation CASCADE;

-- Create daily_cash_reconciliation table
CREATE TABLE IF NOT EXISTS daily_cash_reconciliation (
    id SERIAL PRIMARY KEY,
    reconciliation_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Date & Officer
    reconciliation_date DATE NOT NULL,
    officer_id UUID NOT NULL REFERENCES profiles(id),
    
    -- System Calculations (Auto from Meeting Sessions)
    expected_cash DECIMAL(10, 2) NOT NULL DEFAULT 0,
    expected_mobile_money DECIMAL(10, 2) DEFAULT 0,
    
    -- Officer Declarations (Manual Entry)
    declared_physical_cash DECIMAL(10, 2) NOT NULL DEFAULT 0,
    declared_mobile_money DECIMAL(10, 2) NOT NULL DEFAULT 0,
    banked_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Total Declared
    total_declared DECIMAL(10, 2) GENERATED ALWAYS AS (
        declared_physical_cash + declared_mobile_money + banked_amount
    ) STORED,
    
    -- Variance Detection (calculated from base columns, not total_declared)
    variance DECIMAL(10, 2) GENERATED ALWAYS AS (
        declared_physical_cash + declared_mobile_money + banked_amount - expected_cash
    ) STORED,
    
    variance_type VARCHAR(20) GENERATED ALWAYS AS (
        CASE 
            WHEN (declared_physical_cash + declared_mobile_money + banked_amount - expected_cash) = 0 THEN 'BALANCED'
            WHEN (declared_physical_cash + declared_mobile_money + banked_amount - expected_cash) > 0 THEN 'SURPLUS'
            ELSE 'SHORTAGE'
        END
    ) STORED,
    
    -- Variance Explanation (Required if variance ≠ 0)
    variance_explanation TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',          -- Just submitted, awaiting review
        'BALANCED',         -- No variance, auto-approved
        'VARIANCE_FLAGGED', -- Has variance, needs approval
        'APPROVED',         -- Admin/Director approved variance
        'REJECTED',         -- Variance explanation rejected
        'LOCKED'            -- Final locked state
    )),
    
    -- Breakdown by Meeting (JSONB for flexibility)
    meetings_breakdown JSONB DEFAULT '[]'::jsonb,
    
    -- Notes
    officer_notes TEXT,
    
    -- Approval Workflow
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP,
    reviewer_comments TEXT,
    
    -- Audit Trail
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    locked_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_amounts CHECK (
        declared_physical_cash >= 0 AND 
        declared_mobile_money >= 0 AND 
        banked_amount >= 0 AND
        expected_cash >= 0
    ),
    CONSTRAINT variance_explanation_required CHECK (
        (variance = 0) OR (variance_explanation IS NOT NULL AND LENGTH(variance_explanation) > 10)
    )
);

-- Create indexes
CREATE INDEX idx_reconciliation_date ON daily_cash_reconciliation(reconciliation_date DESC);
CREATE INDEX idx_reconciliation_officer ON daily_cash_reconciliation(officer_id);
CREATE INDEX idx_reconciliation_status ON daily_cash_reconciliation(status);
CREATE INDEX idx_reconciliation_variance_type ON daily_cash_reconciliation(variance_type);

-- Create variance_history table for tracking
CREATE TABLE IF NOT EXISTS reconciliation_variance_history (
    id SERIAL PRIMARY KEY,
    reconciliation_id INTEGER NOT NULL REFERENCES daily_cash_reconciliation(id) ON DELETE CASCADE,
    
    -- Variance Details
    variance_amount DECIMAL(10, 2) NOT NULL,
    variance_type VARCHAR(20) NOT NULL,
    explanation TEXT NOT NULL,
    
    -- Resolution
    resolution_status VARCHAR(20) CHECK (resolution_status IN (
        'PENDING',
        'EXPLAINED',
        'RECOVERED',
        'WRITTEN_OFF',
        'UNDER_INVESTIGATION'
    )),
    resolution_details TEXT,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMP,
    
    -- Flags
    is_repeat_offender BOOLEAN DEFAULT FALSE,
    flagged_for_review BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variance_history_reconciliation ON reconciliation_variance_history(reconciliation_id);
CREATE INDEX idx_variance_history_status ON reconciliation_variance_history(resolution_status);

-- Function to generate reconciliation number
CREATE OR REPLACE FUNCTION generate_reconciliation_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    date_part TEXT;
    sequence_num INTEGER;
BEGIN
    -- Format: REC-YYYYMMDD-NNN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Get next sequence number for this date
    SELECT COALESCE(MAX(CAST(SUBSTRING(reconciliation_number FROM POSITION('-' IN REVERSE(reconciliation_number)) + 1) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM daily_cash_reconciliation
    WHERE reconciliation_number LIKE 'REC-' || date_part || '-%';
    
    new_number := 'REC-' || date_part || '-' || LPAD(sequence_num::TEXT, 3, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate reconciliation number
CREATE OR REPLACE FUNCTION set_reconciliation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reconciliation_number IS NULL OR NEW.reconciliation_number = '' THEN
        NEW.reconciliation_number := generate_reconciliation_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_reconciliation_number ON daily_cash_reconciliation;
CREATE TRIGGER trigger_set_reconciliation_number
BEFORE INSERT ON daily_cash_reconciliation
FOR EACH ROW
EXECUTE FUNCTION set_reconciliation_number();

-- Function to calculate expected cash from meetings
CREATE OR REPLACE FUNCTION calculate_expected_daily_cash(
    p_date DATE,
    p_officer_id UUID DEFAULT NULL
)
RETURNS TABLE(
    expected_cash DECIMAL(10, 2),
    expected_mobile_money DECIMAL(10, 2),
    meeting_count INTEGER,
    meetings_breakdown JSONB
) AS $$
DECLARE
    v_meetings JSONB := '[]'::jsonb;
BEGIN
    -- Get all locked meetings for the date
    SELECT 
        COALESCE(SUM(ms.total_collected), 0) as total_cash,
        0 as mobile_money,
        COUNT(*) as meeting_count,
        json_agg(
            json_build_object(
                'session_number', ms.session_number,
                'group_name', g.group_name,
                'total_collected', ms.total_collected,
                'members_present', ms.members_present
            )
        ) as meetings
    INTO expected_cash, expected_mobile_money, meeting_count, meetings_breakdown
    FROM meeting_sessions ms
    JOIN groups g ON ms.group_id = g.id
    WHERE ms.meeting_date = p_date
    AND ms.status = 'LOCKED'
    AND (p_officer_id IS NULL OR ms.opened_by = p_officer_id);
    
    RETURN QUERY SELECT 
        COALESCE(expected_cash, 0),
        COALESCE(expected_mobile_money, 0),
        COALESCE(meeting_count, 0),
        COALESCE(meetings_breakdown, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update status based on variance
CREATE OR REPLACE FUNCTION update_reconciliation_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-set status based on variance
    IF NEW.variance = 0 AND NEW.status = 'PENDING' THEN
        NEW.status := 'BALANCED';
    ELSIF NEW.variance != 0 AND NEW.status = 'PENDING' THEN
        NEW.status := 'VARIANCE_FLAGGED';
        
        -- Create variance history record
        INSERT INTO reconciliation_variance_history (
            reconciliation_id,
            variance_amount,
            variance_type,
            explanation,
            resolution_status
        ) VALUES (
            NEW.id,
            NEW.variance,
            NEW.variance_type,
            NEW.variance_explanation,
            'PENDING'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reconciliation_status ON daily_cash_reconciliation;
CREATE TRIGGER trigger_update_reconciliation_status
BEFORE INSERT OR UPDATE ON daily_cash_reconciliation
FOR EACH ROW
EXECUTE FUNCTION update_reconciliation_status();

-- Function to check for repeat variance offenders
CREATE OR REPLACE FUNCTION check_repeat_variance_offender(p_officer_id UUID)
RETURNS TABLE(
    is_repeat_offender BOOLEAN,
    variance_count INTEGER,
    total_variance DECIMAL(10, 2),
    last_variance_date DATE
) AS $$
DECLARE
    v_variance_count INTEGER;
    v_total_variance DECIMAL(10, 2);
    v_last_date DATE;
BEGIN
    -- Check last 30 days for variances
    SELECT 
        COUNT(*),
        SUM(ABS(variance)),
        MAX(reconciliation_date)
    INTO v_variance_count, v_total_variance, v_last_date
    FROM daily_cash_reconciliation
    WHERE officer_id = p_officer_id
    AND variance != 0
    AND reconciliation_date >= CURRENT_DATE - INTERVAL '30 days';
    
    RETURN QUERY SELECT 
        v_variance_count >= 3 as is_repeat,
        v_variance_count as count,
        COALESCE(v_total_variance, 0) as total,
        v_last_date as last_date;
END;
$$ LANGUAGE plpgsql;

-- Function to approve/reject reconciliation
CREATE OR REPLACE FUNCTION review_reconciliation(
    p_reconciliation_id INTEGER,
    p_reviewer_id UUID,
    p_action VARCHAR(20), -- 'APPROVE' or 'REJECT'
    p_comments TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
BEGIN
    -- Get current status
    SELECT status INTO current_status
    FROM daily_cash_reconciliation
    WHERE id = p_reconciliation_id;
    
    -- Can only review VARIANCE_FLAGGED reconciliations
    IF current_status != 'VARIANCE_FLAGGED' THEN
        RAISE EXCEPTION 'Can only review reconciliations with variance. Current status: %', current_status;
    END IF;
    
    -- Update reconciliation
    IF p_action = 'APPROVE' THEN
        UPDATE daily_cash_reconciliation
        SET 
            status = 'APPROVED',
            reviewed_by = p_reviewer_id,
            reviewed_at = NOW(),
            reviewer_comments = p_comments
        WHERE id = p_reconciliation_id;
        
        -- Update variance history
        UPDATE reconciliation_variance_history
        SET 
            resolution_status = 'EXPLAINED',
            resolved_by = p_reviewer_id,
            resolved_at = NOW()
        WHERE reconciliation_id = p_reconciliation_id
        AND resolution_status = 'PENDING';
        
    ELSIF p_action = 'REJECT' THEN
        UPDATE daily_cash_reconciliation
        SET 
            status = 'REJECTED',
            reviewed_by = p_reviewer_id,
            reviewed_at = NOW(),
            reviewer_comments = p_comments
        WHERE id = p_reconciliation_id;
        
        -- Update variance history
        UPDATE reconciliation_variance_history
        SET 
            resolution_status = 'UNDER_INVESTIGATION',
            resolved_by = p_reviewer_id,
            resolved_at = NOW(),
            resolution_details = p_comments,
            flagged_for_review = TRUE
        WHERE reconciliation_id = p_reconciliation_id
        AND resolution_status = 'PENDING';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to lock reconciliation (final step)
CREATE OR REPLACE FUNCTION lock_reconciliation(p_reconciliation_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE daily_cash_reconciliation
    SET 
        status = 'LOCKED',
        locked_at = NOW()
    WHERE id = p_reconciliation_id
    AND status IN ('BALANCED', 'APPROVED');
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- View for pending reconciliations
CREATE OR REPLACE VIEW pending_reconciliations AS
SELECT 
    dcr.*,
    u.full_name as officer_name,
    CASE 
        WHEN dcr.variance = 0 THEN 'No issue'
        WHEN dcr.variance > 0 THEN 'Surplus: ' || dcr.variance
        ELSE 'Shortage: ' || ABS(dcr.variance)
    END as variance_summary
FROM daily_cash_reconciliation dcr
JOIN profiles u ON dcr.officer_id = u.id
WHERE dcr.status IN ('PENDING', 'VARIANCE_FLAGGED')
ORDER BY dcr.reconciliation_date DESC;

-- View for variance dashboard
CREATE OR REPLACE VIEW variance_dashboard AS
SELECT 
    dcr.officer_id,
    u.full_name as officer_name,
    COUNT(*) as total_reconciliations,
    SUM(CASE WHEN dcr.variance = 0 THEN 1 ELSE 0 END) as balanced_count,
    SUM(CASE WHEN dcr.variance != 0 THEN 1 ELSE 0 END) as variance_count,
    SUM(CASE WHEN dcr.variance > 0 THEN dcr.variance ELSE 0 END) as total_surplus,
    SUM(CASE WHEN dcr.variance < 0 THEN ABS(dcr.variance) ELSE 0 END) as total_shortage,
    ROUND(
        (SUM(CASE WHEN dcr.variance = 0 THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as accuracy_percentage
FROM daily_cash_reconciliation dcr
JOIN profiles u ON dcr.officer_id = u.id
WHERE dcr.reconciliation_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY dcr.officer_id, u.full_name
ORDER BY variance_count DESC;

-- View for daily summary
CREATE OR REPLACE VIEW daily_cash_summary AS
SELECT 
    reconciliation_date,
    COUNT(*) as total_reconciliations,
    SUM(expected_cash) as total_expected,
    SUM(total_declared) as total_declared,
    SUM(variance) as total_variance,
    SUM(CASE WHEN status = 'BALANCED' THEN 1 ELSE 0 END) as balanced_count,
    SUM(CASE WHEN status = 'VARIANCE_FLAGGED' THEN 1 ELSE 0 END) as variance_flagged_count
FROM daily_cash_reconciliation
GROUP BY reconciliation_date
ORDER BY reconciliation_date DESC;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_reconciliation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reconciliation_timestamp ON daily_cash_reconciliation;
CREATE TRIGGER trigger_update_reconciliation_timestamp
BEFORE UPDATE ON daily_cash_reconciliation
FOR EACH ROW
EXECUTE FUNCTION update_reconciliation_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON daily_cash_reconciliation TO authenticated;
GRANT SELECT, INSERT ON reconciliation_variance_history TO authenticated;
GRANT SELECT ON pending_reconciliations TO authenticated;
GRANT SELECT ON variance_dashboard TO authenticated;
GRANT SELECT ON daily_cash_summary TO authenticated;

-- Add comments
COMMENT ON TABLE daily_cash_reconciliation IS 'Daily cash reconciliation and variance detection';
COMMENT ON COLUMN daily_cash_reconciliation.variance IS 'Auto-calculated: total_declared - expected_cash';
COMMENT ON COLUMN daily_cash_reconciliation.variance_type IS 'BALANCED, SURPLUS, or SHORTAGE';
COMMENT ON FUNCTION calculate_expected_daily_cash IS 'Calculates expected cash from locked meeting sessions';
COMMENT ON FUNCTION check_repeat_variance_offender IS 'Flags officers with repeated variances';

-- =====================================================
-- MIGRATION NOTES:
-- This creates a complete cash reconciliation system
-- Auto-calculates expected cash from meetings
-- Detects and flags variances
-- Requires explanation for any discrepancies
-- Maintains complete audit trail
-- =====================================================


