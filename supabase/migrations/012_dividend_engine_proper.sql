-- =====================================================
-- UKOMBOZI DIVIDEND ENGINE
-- Institutional Standard - Policy-Driven
-- =====================================================
-- Purpose: Automated, fair, auditable dividend calculation
-- Control: System-calculated, Director-approved only
-- No manual rate entry, no manipulation possible

-- =====================================================
-- 1. SHARE SNAPSHOTS (Bi-Monthly Locks)
-- =====================================================

DROP TABLE IF EXISTS dividend_snapshots CASCADE;

CREATE TABLE dividend_snapshots (
    id BIGSERIAL PRIMARY KEY,
    financial_year INTEGER NOT NULL,
    snapshot_month VARCHAR(10) NOT NULL, -- 'JAN', 'MAR', 'MAY', 'JUL', 'SEP', 'NOV'
    snapshot_date DATE NOT NULL,
    member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES groups(id),
    
    -- Locked Balances (As of snapshot date)
    savings_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    share_capital DECIMAL(12,2) NOT NULL DEFAULT 0, -- If using share capital model
    
    -- Metadata
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    locked_by UUID REFERENCES auth.users(id),
    is_locked BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT unique_member_snapshot UNIQUE(financial_year, snapshot_month, member_id),
    CONSTRAINT valid_snapshot_month CHECK (snapshot_month IN ('JAN', 'MAR', 'MAY', 'JUL', 'SEP', 'NOV'))
);

CREATE INDEX idx_dividend_snapshots_year ON dividend_snapshots(financial_year);
CREATE INDEX idx_dividend_snapshots_member ON dividend_snapshots(member_id);
CREATE INDEX idx_dividend_snapshots_locked ON dividend_snapshots(is_locked);

COMMENT ON TABLE dividend_snapshots IS 'Bi-monthly locked member balance snapshots for dividend calculation';

-- =====================================================
-- 2. DIVIDEND RUNS (Annual Calculation Records)
-- =====================================================

DROP TABLE IF EXISTS dividend_runs CASCADE;

CREATE TABLE dividend_runs (
    id BIGSERIAL PRIMARY KEY,
    run_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'DIV-2025-001'
    financial_year INTEGER NOT NULL,
    group_id BIGINT REFERENCES groups(id),
    
    -- Income Sources (Total Revenue Forecasted - TRF)
    banking_interest DECIMAL(12,2) DEFAULT 0,
    stl_interest DECIMAL(12,2) DEFAULT 0,
    ltl_interest DECIMAL(12,2) DEFAULT 0,
    penalties DECIMAL(12,2) DEFAULT 0,
    other_income DECIMAL(12,2) DEFAULT 0,
    total_revenue_forecasted DECIMAL(12,2) GENERATED ALWAYS AS (
        banking_interest + stl_interest + ltl_interest + penalties + other_income
    ) STORED,
    
    -- Deductions (Before Profit)
    operating_expenses DECIMAL(12,2) DEFAULT 0,
    mandatory_reserves DECIMAL(12,2) DEFAULT 0, -- e.g., 10% statutory reserve
    risk_buffer DECIMAL(12,2) DEFAULT 0, -- e.g., 5% bad debt provision
    reinvested_capital DECIMAL(12,2) DEFAULT 0,
    total_deductions DECIMAL(12,2) GENERATED ALWAYS AS (
        operating_expenses + mandatory_reserves + risk_buffer + reinvested_capital
    ) STORED,
    
    -- Profit Calculation
    allocable_profit DECIMAL(12,2) GENERATED ALWAYS AS (
        (banking_interest + stl_interest + ltl_interest + penalties + other_income) -
        (operating_expenses + mandatory_reserves + risk_buffer + reinvested_capital)
    ) STORED,
    
    -- Share-Out Policy
    profit_share_percentage DECIMAL(5,2) DEFAULT 75.00, -- 75% for mature groups, 50% for new
    profit_share_out DECIMAL(12,2) GENERATED ALWAYS AS (
        ((banking_interest + stl_interest + ltl_interest + penalties + other_income) -
        (operating_expenses + mandatory_reserves + risk_buffer + reinvested_capital)) * 
        (profit_share_percentage / 100)
    ) STORED,
    
    -- System-Calculated Totals
    total_average_shares DECIMAL(12,2) DEFAULT 0, -- Sum of all member average shares
    dividend_rate DECIMAL(10,6) GENERATED ALWAYS AS (
        CASE 
            WHEN total_average_shares > 0 THEN 
                (((banking_interest + stl_interest + ltl_interest + penalties + other_income) -
                (operating_expenses + mandatory_reserves + risk_buffer + reinvested_capital)) * 
                (profit_share_percentage / 100)) / total_average_shares
            ELSE 0
        END
    ) STORED,
    
    total_payout DECIMAL(12,2) DEFAULT 0,
    
    -- Workflow Status
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, CALCULATED, DIRECTOR_REVIEW, APPROVED, POSTED, REJECTED
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    calculated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    posted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('DRAFT', 'CALCULATED', 'DIRECTOR_REVIEW', 'APPROVED', 'POSTED', 'REJECTED')),
    CONSTRAINT valid_profit_share CHECK (profit_share_percentage BETWEEN 0 AND 100),
    CONSTRAINT positive_revenue CHECK (total_revenue_forecasted >= 0)
);

CREATE INDEX idx_dividend_runs_year ON dividend_runs(financial_year);
CREATE INDEX idx_dividend_runs_status ON dividend_runs(status);

COMMENT ON TABLE dividend_runs IS 'Annual dividend calculation runs - ONE per financial year per group';
COMMENT ON COLUMN dividend_runs.dividend_rate IS 'System-calculated ONLY - never manual input';

-- =====================================================
-- 3. MEMBER DIVIDEND ALLOCATIONS
-- =====================================================

DROP TABLE IF EXISTS dividend_allocations CASCADE;

CREATE TABLE dividend_allocations (
    id BIGSERIAL PRIMARY KEY,
    dividend_run_id BIGINT REFERENCES dividend_runs(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
    
    -- Snapshot Balances (6 periods)
    jan_balance DECIMAL(12,2) DEFAULT 0,
    mar_balance DECIMAL(12,2) DEFAULT 0,
    may_balance DECIMAL(12,2) DEFAULT 0,
    jul_balance DECIMAL(12,2) DEFAULT 0,
    sep_balance DECIMAL(12,2) DEFAULT 0,
    nov_balance DECIMAL(12,2) DEFAULT 0,
    
    -- Calculated Average
    average_shares DECIMAL(12,2) GENERATED ALWAYS AS (
        (jan_balance + mar_balance + may_balance + jul_balance + sep_balance + nov_balance) / 6.0
    ) STORED,
    
    -- Dividend Calculation (System-Controlled)
    dividend_rate DECIMAL(10,6) NOT NULL, -- Copied from dividend_run
    gross_dividend DECIMAL(12,2) GENERATED ALWAYS AS (
        ((jan_balance + mar_balance + may_balance + jul_balance + sep_balance + nov_balance) / 6.0) * dividend_rate
    ) STORED,
    
    -- Deductions (if any)
    withholding_tax DECIMAL(12,2) DEFAULT 0,
    outstanding_arrears DECIMAL(12,2) DEFAULT 0,
    other_deductions DECIMAL(12,2) DEFAULT 0,
    
    net_dividend DECIMAL(12,2) GENERATED ALWAYS AS (
        (((jan_balance + mar_balance + may_balance + jul_balance + sep_balance + nov_balance) / 6.0) * dividend_rate) -
        (withholding_tax + outstanding_arrears + other_deductions)
    ) STORED,
    
    -- Payment Status
    payment_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, DEFERRED
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(50),
    
    -- Constraints
    CONSTRAINT unique_member_dividend UNIQUE(dividend_run_id, member_id),
    CONSTRAINT valid_payment_status CHECK (payment_status IN ('PENDING', 'PAID', 'DEFERRED'))
);

CREATE INDEX idx_dividend_allocations_run ON dividend_allocations(dividend_run_id);
CREATE INDEX idx_dividend_allocations_member ON dividend_allocations(member_id);

COMMENT ON TABLE dividend_allocations IS 'Individual member dividend calculations - auto-computed from snapshots and rate';

-- =====================================================
-- 4. HELPER FUNCTIONS
-- =====================================================

-- Function: Auto-Lock Snapshot for Current Period
CREATE OR REPLACE FUNCTION create_dividend_snapshot(
    p_financial_year INTEGER,
    p_snapshot_month VARCHAR(10),
    p_snapshot_date DATE
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Insert snapshots for all active members
    INSERT INTO dividend_snapshots (
        financial_year,
        snapshot_month,
        snapshot_date,
        member_id,
        group_id,
        savings_balance,
        locked_by
    )
    SELECT 
        p_financial_year,
        p_snapshot_month,
        p_snapshot_date,
        m.id,
        m.group_id,
        m.current_savings_balance, -- Assuming this column exists in members table
        auth.uid()
    FROM members m
    WHERE m.status = 'ACTIVE'
    ON CONFLICT (financial_year, snapshot_month, member_id) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate Dividend Run (Full Automation)
CREATE OR REPLACE FUNCTION calculate_dividend_run(p_run_id BIGINT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    total_members INTEGER,
    total_payout DECIMAL
) AS $$
DECLARE
    v_run RECORD;
    v_year INTEGER;
    v_rate DECIMAL(10,6);
    v_total_avg_shares DECIMAL(12,2);
    v_total_payout DECIMAL(12,2);
    v_member_count INTEGER;
BEGIN
    -- Get run details
    SELECT * INTO v_run FROM dividend_runs WHERE id = p_run_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Dividend run not found', 0, 0.00;
        RETURN;
    END IF;
    
    v_year := v_run.financial_year;
    
    -- Populate member allocations from snapshots
    DELETE FROM dividend_allocations WHERE dividend_run_id = p_run_id;
    
    INSERT INTO dividend_allocations (
        dividend_run_id,
        member_id,
        jan_balance,
        mar_balance,
        may_balance,
        jul_balance,
        sep_balance,
        nov_balance,
        dividend_rate
    )
    SELECT 
        p_run_id,
        m.id,
        COALESCE((SELECT savings_balance FROM dividend_snapshots WHERE member_id = m.id AND financial_year = v_year AND snapshot_month = 'JAN'), 0),
        COALESCE((SELECT savings_balance FROM dividend_snapshots WHERE member_id = m.id AND financial_year = v_year AND snapshot_month = 'MAR'), 0),
        COALESCE((SELECT savings_balance FROM dividend_snapshots WHERE member_id = m.id AND financial_year = v_year AND snapshot_month = 'MAY'), 0),
        COALESCE((SELECT savings_balance FROM dividend_snapshots WHERE member_id = m.id AND financial_year = v_year AND snapshot_month = 'JUL'), 0),
        COALESCE((SELECT savings_balance FROM dividend_snapshots WHERE member_id = m.id AND financial_year = v_year AND snapshot_month = 'SEP'), 0),
        COALESCE((SELECT savings_balance FROM dividend_snapshots WHERE member_id = m.id AND financial_year = v_year AND snapshot_month = 'NOV'), 0),
        v_run.dividend_rate
    FROM members m
    WHERE m.status = 'ACTIVE';
    
    -- Calculate totals
    SELECT 
        SUM(average_shares),
        SUM(net_dividend),
        COUNT(*)
    INTO v_total_avg_shares, v_total_payout, v_member_count
    FROM dividend_allocations
    WHERE dividend_run_id = p_run_id;
    
    -- Update dividend run
    UPDATE dividend_runs 
    SET 
        total_average_shares = v_total_avg_shares,
        total_payout = v_total_payout,
        calculated_at = NOW(),
        status = 'CALCULATED'
    WHERE id = p_run_id;
    
    RETURN QUERY SELECT TRUE, 'Dividend calculated successfully', v_member_count, v_total_payout;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE dividend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_allocations ENABLE ROW LEVEL SECURITY;

-- Read: All authenticated users
CREATE POLICY "snapshots_read_all" ON dividend_snapshots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "runs_read_all" ON dividend_runs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "allocations_read_all" ON dividend_allocations FOR SELECT USING (auth.uid() IS NOT NULL);

-- Modify: Director only
CREATE POLICY "runs_director_only" ON dividend_runs FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'director'
    )
);

CREATE POLICY "snapshots_admin_only" ON dividend_snapshots FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'director')
    )
);

COMMENT ON TABLE dividend_runs IS 'CRITICAL: dividend_rate is GENERATED column - NEVER accept manual input';
