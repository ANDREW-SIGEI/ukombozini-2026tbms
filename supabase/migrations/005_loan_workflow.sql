-- ============================================
-- UKOMBOZI TBMS - LOAN WORKFLOW SCHEMA
-- ============================================

-- 1. LOAN APPLICATIONS TABLE
-- Stores the lifecycle of a loan request before it becomes an active loan
CREATE TABLE loan_applications (
    id BIGSERIAL PRIMARY KEY,
    application_number TEXT NOT NULL UNIQUE, -- e.g., APP-202601-0001
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    
    loan_type TEXT NOT NULL CHECK (loan_type IN ('STL', 'LTL', 'EMERGENCY')),
    amount_requested NUMERIC(15, 2) NOT NULL CHECK (amount_requested > 0),
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    purpose TEXT,
    
    -- Financials at time of application (Snapshot for risk assessment)
    applicant_savings_snapshot NUMERIC(15, 2) DEFAULT 0,
    
    status TEXT DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',              -- Draft / Just started
        'OFFICER_SUBMITTED',    -- Submitted by field officer
        'GUARANTORS_PENDING',   -- Waiting for guarantors
        'ADMIN_REVIEW',         -- Waiting for Admin approval
        'APPROVED',             -- Fully approved, ready for disbursement
        'REJECTED',             -- Denied
        'DISBURSED',            -- Money sent (converted to active loan)
        'CANCELLED'             -- Withdrawn by member
    )),
    
    -- Approval Trail
    officer_id UUID REFERENCES profiles(id),
    officer_notes TEXT,
    officer_submitted_at TIMESTAMPTZ,
    
    admin_id UUID REFERENCES profiles(id),
    admin_notes TEXT,
    admin_reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE loan_applications IS 'Tracks the full approval lifecycle of a loan request';

-- 2. LOAN GUARANTORS TABLE
-- Links members who guarantee a specific application
CREATE TABLE loan_guarantors (
    id BIGSERIAL PRIMARY KEY,
    loan_application_id BIGINT NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    guarantor_member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    
    guaranteed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Amount they are covering
    
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(loan_application_id, guarantor_member_id)
);

-- 3. TRIGGER TO AUTO-UPDATE UPDATED_AT
CREATE TRIGGER update_loan_applications_updated_at BEFORE UPDATE ON loan_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loan_guarantors_updated_at BEFORE UPDATE ON loan_guarantors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. FUNCTION TO CALCULATE MAX LOAN ELIGIBILITY
-- Returns 3x savings - outstanding loans
CREATE OR REPLACE FUNCTION calculate_loan_eligibility(p_member_id BIGINT)
RETURNS JSONB AS $$
DECLARE
    v_total_savings NUMERIC;
    v_outstanding_loans NUMERIC;
    v_max_multiplier NUMERIC;
    v_eligible_amount NUMERIC;
BEGIN
    -- Get Savings
    SELECT COALESCE(SUM(amount), 0) + (SELECT opening_balance_savings FROM members WHERE id = p_member_id)
    INTO v_total_savings
    FROM transactions 
    WHERE member_id = p_member_id AND type IN ('savings', 'share_transfer') AND reversed = FALSE;
    
    -- Get Outstanding Loans (Principal Only for simplicity of this check, or total exposure)
    -- Actually, usually checks Principal Balance.
    -- To do this accurately, we need sum(disbursements) - sum(repayments_principal).
    -- For now, approximating from loan contracts that are active.
    -- Refinement: Use transactions for accurate balance.
    
    SELECT COALESCE(SUM(
        (SELECT ABS(SUM(t.amount)) FROM transactions t WHERE t.loan_id = l.id AND t.type = 'loan_disbursement') - 
        (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.loan_id = l.id AND t.type = 'loan_repayment')
    ), 0)
    INTO v_outstanding_loans
    FROM loans l
    WHERE l.member_id = p_member_id AND l.status = 'active';

    -- Get System Setting (Multiplier)
    SELECT (value->>'max_loan_multiplier')::NUMERIC INTO v_max_multiplier
    FROM system_settings 
    WHERE key = 'max_loan_multiplier';
    
    IF v_max_multiplier IS NULL THEN
        v_max_multiplier := 3; -- Default
    END IF;

    v_eligible_amount := (v_total_savings * v_max_multiplier) - v_outstanding_loans;

    RETURN jsonb_build_object(
        'total_savings', v_total_savings,
        'outstanding_loans', v_outstanding_loans,
        'multiplier', v_max_multiplier,
        'max_eligible', GREATEST(0, v_eligible_amount)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
