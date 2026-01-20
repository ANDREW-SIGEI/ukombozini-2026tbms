-- ============================================
-- UKOMBOZI TBMS - SHORT TERM LOAN (STL) REDUCING BALANCE
-- ============================================
-- Flexible 1-3 month loans with reducing balance interest
-- Members can pay early without penalty
-- Interest calculated only on remaining balance
-- ============================================

-- ============================================
-- FUNCTION: Generate STL Reducing Balance Schedule
-- ============================================
CREATE OR REPLACE FUNCTION generate_stl_reducing_balance_schedule(
    p_loan_id UUID,
    p_principal NUMERIC,
    p_monthly_interest_rate NUMERIC, -- e.g., 0.10 for 10%
    p_term_months INTEGER, -- 1, 2, or 3
    p_start_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_remaining_balance NUMERIC := p_principal;
    v_monthly_principal NUMERIC;
    v_monthly_interest NUMERIC;
    v_monthly_payment NUMERIC;
    v_current_date DATE;
    v_month INTEGER;
    v_schedule JSONB := '[]'::JSONB;
    v_installment JSONB;
BEGIN
    -- Validate inputs
    IF p_term_months NOT IN (1, 2, 3) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'STL term must be 1, 2, or 3 months'
        );
    END IF;

    IF p_monthly_interest_rate < 0 OR p_monthly_interest_rate > 1 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Interest rate must be between 0 and 1 (e.g., 0.10 for 10%)'
        );
    END IF;

    -- Delete existing schedule
    DELETE FROM repayment_schedule WHERE loan_id = p_loan_id;

    -- Calculate equal principal per month
    v_monthly_principal := p_principal / p_term_months;

    -- Generate schedule for each month
    FOR v_month IN 1..p_term_months LOOP
        -- Calculate interest on REMAINING balance (reducing balance method)
        v_monthly_interest := v_remaining_balance * p_monthly_interest_rate;
        
        -- Total payment = principal portion + interest on remaining balance
        v_monthly_payment := v_monthly_principal + v_monthly_interest;
        
        -- Calculate due date
        v_current_date := p_start_date + (v_month || ' months')::INTERVAL;

        -- Insert into repayment_schedule table
        INSERT INTO repayment_schedule (
            loan_id,
            installment_number,
            due_date,
            expected_installment,
            expected_principal,
            expected_interest,
            expected_shares,
            status
        ) VALUES (
            p_loan_id,
            v_month,
            v_current_date,
            ROUND(v_monthly_payment, 2),
            ROUND(v_monthly_principal, 2),
            ROUND(v_monthly_interest, 2),
            0, -- No shares for STL
            'pending'
        );

        -- Build JSON for response
        v_installment := jsonb_build_object(
            'month', v_month,
            'due_date', v_current_date,
            'principal', ROUND(v_monthly_principal, 2),
            'interest', ROUND(v_monthly_interest, 2),
            'total_payment', ROUND(v_monthly_payment, 2),
            'remaining_balance', ROUND(v_remaining_balance - v_monthly_principal, 2)
        );

        v_schedule := v_schedule || v_installment;

        -- Reduce balance for next iteration
        v_remaining_balance := v_remaining_balance - v_monthly_principal;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'principal', p_principal,
        'term_months', p_term_months,
        'interest_rate', p_monthly_interest_rate,
        'schedule', v_schedule,
        'total_interest', (
            SELECT SUM(expected_interest) 
            FROM repayment_schedule 
            WHERE loan_id = p_loan_id
        ),
        'total_payable', (
            SELECT SUM(expected_installment) 
            FROM repayment_schedule 
            WHERE loan_id = p_loan_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Calculate Early Clearance Amount for STL
-- ============================================
CREATE OR REPLACE FUNCTION calculate_stl_early_clearance(
    p_loan_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_remaining_principal NUMERIC;
    v_total_paid NUMERIC;
    v_loan_principal NUMERIC;
    v_interest_rate NUMERIC;
    v_early_clearance_interest NUMERIC;
    v_total_clearance NUMERIC;
BEGIN
    -- Get loan details
    SELECT 
        l.principal_amount,
        COALESCE(l.total_paid, 0),
        COALESCE(l.interest_rate, 0.10) -- Default 10% if not stored
    INTO v_loan_principal, v_total_paid, v_interest_rate
    FROM loans l
    WHERE l.id = p_loan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Loan not found'
        );
    END IF;

    -- Calculate remaining principal
    v_remaining_principal := v_loan_principal - v_total_paid;

    -- Calculate interest on remaining principal only
    v_early_clearance_interest := v_remaining_principal * v_interest_rate;

    -- Total clearance = remaining principal + interest on that amount
    v_total_clearance := v_remaining_principal + v_early_clearance_interest;

    RETURN jsonb_build_object(
        'success', true,
        'remaining_principal', ROUND(v_remaining_principal, 2),
        'interest_on_balance', ROUND(v_early_clearance_interest, 2),
        'total_clearance_amount', ROUND(v_total_clearance, 2),
        'savings_vs_full_term', 'Early clearance saves future interest!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ STL REDUCING BALANCE FUNCTIONS CREATED';
    RAISE NOTICE '📊 Use: generate_stl_reducing_balance_schedule(loan_id, principal, rate, term, start_date)';
    RAISE NOTICE '💰 Use: calculate_stl_early_clearance(loan_id)';
END $$;
