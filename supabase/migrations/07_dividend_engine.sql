-- =====================================================
-- UKOMBOZI DIVIDEND ENGINE
-- =====================================================

-- 1. DIVIDEND SNAPSHOTS
CREATE TABLE IF NOT EXISTS dividend_snapshots (
    id BIGSERIAL PRIMARY KEY,
    financial_year INTEGER NOT NULL,
    snapshot_month VARCHAR(10) NOT NULL,
    snapshot_date DATE NOT NULL,
    member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES groups(id),
    savings_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    locked_by UUID REFERENCES profiles(id),
    is_locked BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_member_snapshot UNIQUE(financial_year, snapshot_month, member_id)
);

-- 2. DIVIDEND RUNS
CREATE TABLE IF NOT EXISTS dividend_runs (
    id BIGSERIAL PRIMARY KEY,
    run_number VARCHAR(20) UNIQUE NOT NULL,
    financial_year INTEGER NOT NULL,
    group_id BIGINT REFERENCES groups(id),
    
    total_revenue_forecasted DECIMAL(12,2) DEFAULT 0,
    total_deductions DECIMAL(12,2) DEFAULT 0,
    allocable_profit DECIMAL(12,2) DEFAULT 0,
    
    profit_share_percentage DECIMAL(5,2) DEFAULT 75.00,
    total_average_shares DECIMAL(12,2) DEFAULT 0,
    dividend_rate DECIMAL(10,6) DEFAULT 0,
    total_payout DECIMAL(12,2) DEFAULT 0,
    
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'APPROVED', 'POSTED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DIVIDEND ALLOCATIONS
CREATE TABLE IF NOT EXISTS dividend_allocations (
    id BIGSERIAL PRIMARY KEY,
    dividend_run_id BIGINT REFERENCES dividend_runs(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES members(id) ON DELETE CASCADE,
    
    average_shares DECIMAL(12,2) DEFAULT 0,
    net_dividend DECIMAL(12,2) DEFAULT 0,
    
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    paid_at TIMESTAMPTZ,
    
    CONSTRAINT unique_member_dividend UNIQUE(dividend_run_id, member_id)
);

-- RLS
ALTER TABLE dividend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read All Dividends" ON dividend_runs FOR SELECT USING (TRUE);
CREATE POLICY "Admins Manage Dividends" ON dividend_runs FOR ALL USING (is_director_or_admin());
-- Add other policies as needed

DO $$
BEGIN
    RAISE NOTICE '✅ Dividend Engine Standardized';
END $$;
