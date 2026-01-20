-- =====================================================
-- LOAN APPROVAL WORKFLOW SYSTEM
-- Bank-grade multi-level authorization for loans
-- =====================================================

-- Drop tables if they exist to ensure clean state
DROP TABLE IF EXISTS loan_approval_history CASCADE;
DROP TABLE IF EXISTS loan_applications CASCADE;

-- Create loan_applications table
CREATE TABLE IF NOT EXISTS loan_applications (
    id SERIAL PRIMARY KEY,
    application_number VARCHAR(50) UNIQUE NOT NULL,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- Loan Details
    loan_type VARCHAR(20) NOT NULL CHECK (loan_type IN ('LTL', 'STL')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    interest_rate DECIMAL(5, 2) NOT NULL CHECK (interest_rate >= 0),
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    monthly_installment DECIMAL(10, 2) NOT NULL,
    total_repayable DECIMAL(10, 2) NOT NULL,
    
    -- Application Info
    purpose TEXT NOT NULL,
    guarantors JSONB DEFAULT '[]'::jsonb,
    
    -- Approval Workflow Status
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',           -- Just submitted by officer
        'ADMIN_REVIEW',      -- Under admin review
        'ADMIN_APPROVED',    -- Admin approved, awaiting director
        'ADMIN_REJECTED',    -- Admin rejected
        'DIRECTOR_REVIEW',   -- Under director review
        'APPROVED',          -- Final approval, ready for disbursement
        'REJECTED',          -- Final rejection
        'DISBURSED',         -- Loan has been disbursed
        'CANCELLED'          -- Application cancelled
    )),
    
    -- Audit Trail
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    admin_reviewed_by UUID REFERENCES profiles(id),
    admin_reviewed_at TIMESTAMP,
    admin_comments TEXT,
    
    director_reviewed_by UUID REFERENCES profiles(id),
    director_reviewed_at TIMESTAMP,
    director_comments TEXT,
    
    disbursed_by UUID REFERENCES profiles(id),
    disbursed_at TIMESTAMP,
    
    cancelled_by UUID REFERENCES profiles(id),
    cancelled_at TIMESTAMP,
    cancelled_reason TEXT,
    
    -- Metadata
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_loan_applications_member ON loan_applications(member_id);
CREATE INDEX idx_loan_applications_group ON loan_applications(group_id);
CREATE INDEX idx_loan_applications_status ON loan_applications(status);
CREATE INDEX idx_loan_applications_created_at ON loan_applications(created_at DESC);
CREATE INDEX idx_loan_applications_number ON loan_applications(application_number);

-- Create loan_approval_history table for complete audit trail
CREATE TABLE IF NOT EXISTS loan_approval_history (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    performed_by UUID NOT NULL REFERENCES profiles(id),
    performed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    comments TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_loan_approval_history_application ON loan_approval_history(application_id);
CREATE INDEX idx_loan_approval_history_performed_at ON loan_approval_history(performed_at DESC);

-- Function to generate unique application number
CREATE OR REPLACE FUNCTION generate_application_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    year_month TEXT;
    sequence_num INTEGER;
BEGIN
    -- Format: APP-YYYYMM-NNNN
    year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    -- Get next sequence number for this month
    SELECT COALESCE(MAX(CAST(SUBSTRING(application_number FROM 12) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM loan_applications
    WHERE application_number LIKE 'APP-' || year_month || '-%';
    
    new_number := 'APP-' || year_month || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate application number
CREATE OR REPLACE FUNCTION set_application_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.application_number IS NULL OR NEW.application_number = '' THEN
        NEW.application_number := generate_application_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_application_number ON loan_applications;
CREATE TRIGGER trigger_set_application_number
BEFORE INSERT ON loan_applications
FOR EACH ROW
EXECUTE FUNCTION set_application_number();

-- Trigger to log all status changes
CREATE OR REPLACE FUNCTION log_loan_approval_action()
RETURNS TRIGGER AS $$
DECLARE
    action_type TEXT;
    performed_by_id UUID;
BEGIN
    -- Determine action and performer
    IF TG_OP = 'INSERT' THEN
        action_type := 'APPLICATION_CREATED';
        performed_by_id := NEW.created_by;
        
        INSERT INTO loan_approval_history (
            application_id, action, from_status, to_status, 
            performed_by, comments
        ) VALUES (
            NEW.id, action_type, NULL, NEW.status, 
            performed_by_id, 'Loan application submitted'
        );
        
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        -- Status changed - determine who made the change
        CASE NEW.status
            WHEN 'ADMIN_REVIEW' THEN
                action_type := 'SENT_TO_ADMIN';
                performed_by_id := NEW.created_by;
            WHEN 'ADMIN_APPROVED' THEN
                action_type := 'ADMIN_APPROVED';
                performed_by_id := NEW.admin_reviewed_by;
            WHEN 'ADMIN_REJECTED' THEN
                action_type := 'ADMIN_REJECTED';
                performed_by_id := NEW.admin_reviewed_by;
            WHEN 'DIRECTOR_REVIEW' THEN
                action_type := 'SENT_TO_DIRECTOR';
                performed_by_id := NEW.admin_reviewed_by;
            WHEN 'APPROVED' THEN
                action_type := 'DIRECTOR_APPROVED';
                performed_by_id := NEW.director_reviewed_by;
            WHEN 'REJECTED' THEN
                action_type := 'DIRECTOR_REJECTED';
                performed_by_id := NEW.director_reviewed_by;
            WHEN 'DISBURSED' THEN
                action_type := 'LOAN_DISBURSED';
                performed_by_id := NEW.disbursed_by;
            WHEN 'CANCELLED' THEN
                action_type := 'APPLICATION_CANCELLED';
                performed_by_id := NEW.cancelled_by;
            ELSE
                action_type := 'STATUS_CHANGED';
                performed_by_id := NEW.created_by;
        END CASE;
        
        INSERT INTO loan_approval_history (
            application_id, action, from_status, to_status, 
            performed_by, comments
        ) VALUES (
            NEW.id, action_type, OLD.status, NEW.status, 
            performed_by_id, 
            COALESCE(NEW.admin_comments, NEW.director_comments, NEW.cancelled_reason)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_loan_approval ON loan_applications;
CREATE TRIGGER trigger_log_loan_approval
AFTER INSERT OR UPDATE ON loan_applications
FOR EACH ROW
EXECUTE FUNCTION log_loan_approval_action();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_loan_application_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_loan_application_timestamp ON loan_applications;
CREATE TRIGGER trigger_update_loan_application_timestamp
BEFORE UPDATE ON loan_applications
FOR EACH ROW
EXECUTE FUNCTION update_loan_application_timestamp();

-- View for pending admin reviews
CREATE OR REPLACE VIEW pending_admin_reviews AS
SELECT 
    la.*,
    m.full_name AS member_name,
    m.phone AS member_phone,
    g.name AS group_name,
    u.full_name AS officer_name
FROM loan_applications la
JOIN members m ON la.member_id = m.id
JOIN groups g ON la.group_id = g.id
JOIN profiles u ON la.created_by = u.id
WHERE la.status IN ('PENDING', 'ADMIN_REVIEW')
ORDER BY la.created_at ASC;

-- View for pending director reviews
CREATE OR REPLACE VIEW pending_director_reviews AS
SELECT 
    la.*,
    m.full_name AS member_name,
    m.phone AS member_phone,
    g.name AS group_name,
    u.full_name AS officer_name,
    admin_user.full_name AS admin_name
FROM loan_applications la
JOIN members m ON la.member_id = m.id
JOIN groups g ON la.group_id = g.id
JOIN profiles u ON la.created_by = u.id
LEFT JOIN profiles admin_user ON la.admin_reviewed_by = admin_user.id
WHERE la.status IN ('ADMIN_APPROVED', 'DIRECTOR_REVIEW')
ORDER BY la.admin_reviewed_at ASC;

-- View for approved loans ready for disbursement
CREATE OR REPLACE VIEW approved_for_disbursement AS
SELECT 
    la.*,
    m.full_name AS member_name,
    m.phone AS member_phone,
    g.name AS group_name,
    u.full_name AS officer_name,
    director_user.full_name AS director_name
FROM loan_applications la
JOIN members m ON la.member_id = m.id
JOIN groups g ON la.group_id = g.id
JOIN profiles u ON la.created_by = u.id
LEFT JOIN profiles director_user ON la.director_reviewed_by = director_user.id
WHERE la.status = 'APPROVED'
ORDER BY la.director_reviewed_at ASC;

-- Function to check if user has permission to approve at their level
CREATE OR REPLACE FUNCTION can_user_approve_loan(
    p_user_id UUID,
    p_application_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    app_status TEXT;
BEGIN
    -- Get user role
    SELECT role INTO user_role FROM profiles WHERE id = p_user_id;
    
    -- Get application status
    SELECT status INTO app_status FROM loan_applications WHERE id = p_application_id;
    
    -- Check permission based on role and current status
    IF user_role = 'admin' AND app_status IN ('PENDING', 'ADMIN_REVIEW') THEN
        RETURN TRUE;
    ELSIF user_role = 'director' AND app_status IN ('ADMIN_APPROVED', 'DIRECTOR_REVIEW') THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE loan_applications IS 'Stores loan applications with multi-level approval workflow';
COMMENT ON TABLE loan_approval_history IS 'Complete audit trail of all loan approval actions';
COMMENT ON COLUMN loan_applications.status IS 'Current status in the approval workflow chain';
COMMENT ON COLUMN loan_applications.application_number IS 'Auto-generated unique application number (APP-YYYYMM-NNNN)';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON loan_applications TO authenticated;
GRANT SELECT, INSERT ON loan_approval_history TO authenticated;
GRANT SELECT ON pending_admin_reviews TO authenticated;
GRANT SELECT ON pending_director_reviews TO authenticated;
GRANT SELECT ON approved_for_disbursement TO authenticated;

-- =====================================================
-- MIGRATION NOTES:
-- This creates a complete loan approval workflow system
-- with multi-level authorization and full audit trail.
-- Status transitions are tracked automatically.
-- Application numbers are auto-generated.
-- =====================================================
