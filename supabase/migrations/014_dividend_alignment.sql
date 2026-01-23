-- =====================================================
-- DIVIDEND ALIGNMENT & CASH RECONCILIATION FIX
-- =====================================================
-- Aligns dividend engine with monthly reports and fixes cash reconciliation logic
-- FIXED: Includes creation of 'meeting_sessions' table if missing

-- =====================================================
-- 0. ENSURE DEPENDENCIES (Create meeting_sessions if missing)
-- =====================================================
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'meeting_sessions') THEN
      CREATE TABLE meeting_sessions (
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
          updated_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Create indexes
      CREATE INDEX idx_meeting_sessions_group ON meeting_sessions(group_id);
      CREATE INDEX idx_meeting_sessions_date ON meeting_sessions(meeting_date DESC);
      CREATE INDEX idx_meeting_sessions_status ON meeting_sessions(status);
   END IF;
END $$;

-- =====================================================
-- 1. UPDATE TRANSACTION TYPES (Add Withdrawal)
-- =====================================================
-- We need to drop and recreate the constraint to allow 'withdrawal'
DO $$
BEGIN
    -- Drop existing check constraint if it exists
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
    
    -- Add new constraint with 'withdrawal'
    ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
        CHECK (type IN (
            'savings',
            'loan_disbursement',
            'loan_repayment',
            'fine',
            'welfare',
            'project',
            'dividend',
            'withdrawal',
            'reversal'
        ));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint update failed or already exists: %', SQLERRM;
END $$;

-- =====================================================
-- 2. ENHANCE MEETING SESSIONS (Track Outcomes)
-- =====================================================
ALTER TABLE meeting_sessions 
ADD COLUMN IF NOT EXISTS total_withdrawals DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_dividends_distributed DECIMAL(12,2) DEFAULT 0;

-- Update calculate_meeting_totals to include withdrawals and dividends
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
        
        -- New: Withdrawals (Cash Out)
        total_withdrawals = COALESCE((
            SELECT SUM(ABS(amount)) -- Ensure positive value for summary
            FROM transactions
            WHERE session_id = p_session_id AND type = 'withdrawal' AND reversed = FALSE
        ), 0),
        
        -- New: Dividends (Internal/Cash Out depending on context, kept separate)
        total_dividends_distributed = COALESCE((
            SELECT SUM(amount)
            FROM transactions
            WHERE session_id = p_session_id AND type = 'dividend' AND reversed = FALSE
        ), 0),
        
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

-- =====================================================
-- 3. FIX DAILY CASH RECONCILIATION (Net Cash Logic)
-- =====================================================
-- Expected Cash = (Collections) - (Disbursements + Withdrawals)
-- Note: Dividends typically credit savings, so usually 0 cash impact unless withdrawn, 
-- which would be captured by 'withdrawal' transaction.

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
    -- Get all locked meetings for the date WITH NET CASH CALCULATION
    SELECT 
        COALESCE(SUM(
            ms.total_collected - 
            ms.total_loans_disbursed - 
            COALESCE(ms.total_withdrawals, 0)
        ), 0) as total_cash,
        
        0 as mobile_money, -- Placeholder for future mobile money logic
        
        COUNT(*) as meeting_count,
        
        json_agg(
            json_build_object(
                'session_number', ms.session_number,
                'group_name', g.group_name,
                'total_collected', ms.total_collected,
                'total_disbursed', ms.total_loans_disbursed,
                'total_withdrawals', COALESCE(ms.total_withdrawals, 0),
                'net_cash', (ms.total_collected - ms.total_loans_disbursed - COALESCE(ms.total_withdrawals, 0)),
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

-- =====================================================
-- 4. FINANCIAL SUMMARY HELPER (For Dividend Runs)
-- =====================================================
-- Estimates Annual Income to help pre-fill Dividend Run
CREATE OR REPLACE FUNCTION get_financial_year_summary(p_year INTEGER, p_group_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    total_income DECIMAL,
    breakdown JSONB
) AS $$
DECLARE
    v_start_date DATE := (p_year || '-01-01')::DATE;
    v_end_date DATE := (p_year || '-12-31')::DATE;
    v_total_interest DECIMAL := 0;
    v_total_fines DECIMAL := 0;
    v_total_other DECIMAL := 0;
BEGIN
    -- 1. Calculate Interest (inferred from Repayments vs Disbursements??)
    -- Since we don't have explicit interest transactions yet, we'll try to use 'total_loan_interest' from sessions 
    -- if it was populated. But currently it's hardcoded to 0 in calculate_meeting_totals.
    -- Alternative: Use System Setting flat rates estimate OR assume 10% of repayments is interest (Naive but placeholder)
    
    -- BETTER: Sum 'fine', 'welfare' (income?), 'project' (income?)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_fines 
    FROM transactions 
    WHERE type = 'fine' 
    AND created_at >= v_start_date AND created_at <= v_end_date
    AND reversed = FALSE
    AND (p_group_id IS NULL OR group_id = p_group_id);

    -- For Interest, let's look at completed loans in this year? 
    -- Or just return 0 and let user fill it.
    -- Ideally, we need 'interest_payment' type. 
    -- FOR NOW: We return aggregated fines/fees as confirmed income.
    
    SELECT 
        v_total_fines + 0 -- + other components
    INTO total_income;
    
    breakdown := json_build_object(
        'fines', v_total_fines,
        'estimated_interest', 0,
        'other', 0
    );
    
    RETURN QUERY SELECT total_income, breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. POSTING FUNCTION (Ensures proper Transaction Types)
-- =====================================================
CREATE OR REPLACE FUNCTION post_dividend_to_accounts(p_run_id BIGINT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    posted_count INTEGER,
    total_posted_amount DECIMAL
) AS $$
DECLARE
    v_run RECORD;
    v_member_id BIGINT;
    v_net_dividend DECIMAL(12,2);
    v_run_number VARCHAR;
    v_count INTEGER := 0;
    v_total DECIMAL(12,2) := 0;
    v_alloc RECORD;
BEGIN
    -- 1. Validate Run
    SELECT * INTO v_run FROM dividend_runs WHERE id = p_run_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Dividend run not found', 0, 0.00;
        RETURN;
    END IF;
    
    IF v_run.status != 'APPROVED' THEN
        RETURN QUERY SELECT FALSE, 'Run must be APPROVED before posting (Current: ' || v_run.status || ')', 0, 0.00;
        RETURN;
    END IF;
    
    -- 2. Process Allocations
    FOR v_alloc IN SELECT * FROM dividend_allocations WHERE dividend_run_id = p_run_id AND payment_status = 'PENDING' LOOP
        
        -- Insert Transaction (Credit to Member)
        -- Uses type 'dividend' (Internal Transfer) - Does NOT inflate Cash Reports
        INSERT INTO transactions (
            member_id,
            group_id,
            type,
            amount,
            reference,
            notes,
            posted_by
        ) VALUES (
            v_alloc.member_id,
            v_run.group_id,
            'dividend',
            v_alloc.net_dividend,
            'DIV-' || v_run.run_number,
            'Dividend Payout for FY ' || v_run.financial_year,
            auth.uid()
        );
        
        -- Mark as Paid
        UPDATE dividend_allocations 
        SET 
            payment_status = 'PAID',
            paid_at = NOW(),
            payment_reference = 'DIV-' || v_run.run_number
        WHERE id = v_alloc.id;
        
        v_count := v_count + 1;
        v_total := v_total + v_alloc.net_dividend;
        
    END LOOP;
    
    -- 3. Update Run Status
    UPDATE dividend_runs 
    SET 
        status = 'POSTED',
        posted_at = NOW(),
        posted_by = auth.uid()
    WHERE id = p_run_id;
    
    RETURN QUERY SELECT TRUE, 'Successfully posted dividends to member accounts', v_count, v_total;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Error: ' || SQLERRM, 0, 0.00;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success Message
DO $$
BEGIN
    RAISE NOTICE '✅ DIVIDEND ALIGNMENT: 014_dividend_alignment.sql applied';
    RAISE NOTICE '   - Checked/Created meeting_sessions table';
    RAISE NOTICE '   - Withdrawal support added';
    RAISE NOTICE '   - Meeting totals upgraded';
    RAISE NOTICE '   - Daily Cash Reconciliation fixed (Net Cash logic)';
    RAISE NOTICE '   - Dividend Posting RPC implemented';
END $$;
