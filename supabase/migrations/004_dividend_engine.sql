-- ============================================
-- UKOMBOZI TBMS - DIVIDEND ENGINE LOGIC
-- ============================================

-- Function to generate the complete dividend dataset for a group/year
CREATE OR REPLACE FUNCTION generate_dividend_report(
    p_group_id UUID,
    p_year INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_financials JSONB;
    v_members JSONB;
    v_start_date DATE := (p_year || '-01-01')::DATE;
    v_end_date DATE := (p_year || '-12-31')::DATE;
BEGIN
    -- 1. CALCULATE FINANCIALS (TRF)
    -- We sum up all INCOME transaction types for the given year
    SELECT jsonb_build_object(
        'bankInterest', COALESCE(SUM(CASE WHEN type = 'bank_interest' THEN amount ELSE 0 END), 0),
        'stlInterest', COALESCE(SUM(CASE WHEN type = 'loan_interest' AND loan_id IN (SELECT id FROM loans WHERE loan_type = 'STL') THEN amount ELSE 0 END), 0),
        'ltlInterest', COALESCE(SUM(CASE WHEN type = 'loan_interest' AND loan_id IN (SELECT id FROM loans WHERE loan_type = 'LTL') THEN amount ELSE 0 END), 0),
        'penalties', COALESCE(SUM(CASE WHEN type = 'penalty' THEN amount ELSE 0 END), 0),
        'otherIncome', COALESCE(SUM(CASE WHEN type = 'other_income' THEN amount ELSE 0 END), 0),
        'expenses', COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0), -- Expenses are negative usually
        'reinvestedLoans', 0 -- This is usually a manual decision / input, defaulting to 0
    ) INTO v_financials
    FROM transactions
    WHERE group_id = p_group_id 
      AND created_at >= v_start_date 
      AND created_at <= v_end_date
      AND reversed = FALSE;

    -- 2. CALC MEMBER BALANCES (Bi-Monthly Snapshots)
    -- We need balances at: Jan 31, Mar 31, May 31, Jul 31, Sep 30, Nov 30
    -- This query sums transactions up to each date
    
    WITH member_balances AS (
        SELECT 
            m.id,
            m.full_name,
            -- Jan 31
            COALESCE((
                SELECT SUM(t.amount) 
                FROM transactions t 
                WHERE t.member_id = m.id 
                  AND t.type IN ('savings', 'item_contribution', 'share_transfer')
                  AND t.reversed = FALSE
                  AND t.created_at <= (p_year || '-01-31 23:59:59')::TIMESTAMPTZ
            ), 0) + m.opening_balance_savings AS jan_bal,
            
            -- Mar 31
            COALESCE((
                SELECT SUM(t.amount) 
                FROM transactions t 
                WHERE t.member_id = m.id 
                  AND t.type IN ('savings', 'item_contribution', 'share_transfer')
                  AND t.reversed = FALSE
                  AND t.created_at <= (p_year || '-03-31 23:59:59')::TIMESTAMPTZ
            ), 0) + m.opening_balance_savings AS mar_bal,
            
            -- May 31
            COALESCE((
                SELECT SUM(t.amount) 
                FROM transactions t 
                WHERE t.member_id = m.id 
                  AND t.type IN ('savings', 'item_contribution', 'share_transfer')
                  AND t.reversed = FALSE
                  AND t.created_at <= (p_year || '-05-31 23:59:59')::TIMESTAMPTZ
            ), 0) + m.opening_balance_savings AS may_bal,
            
            -- Jul 31
            COALESCE((
                SELECT SUM(t.amount) 
                FROM transactions t 
                WHERE t.member_id = m.id 
                  AND t.type IN ('savings', 'item_contribution', 'share_transfer')
                  AND t.reversed = FALSE
                  AND t.created_at <= (p_year || '-07-31 23:59:59')::TIMESTAMPTZ
            ), 0) + m.opening_balance_savings AS jul_bal,
            
            -- Sep 30
            COALESCE((
                SELECT SUM(t.amount) 
                FROM transactions t 
                WHERE t.member_id = m.id 
                  AND t.type IN ('savings', 'item_contribution', 'share_transfer')
                  AND t.reversed = FALSE
                  AND t.created_at <= (p_year || '-09-30 23:59:59')::TIMESTAMPTZ
            ), 0) + m.opening_balance_savings AS sep_bal,
            
            -- Nov 30
            COALESCE((
                SELECT SUM(t.amount) 
                FROM transactions t 
                WHERE t.member_id = m.id 
                  AND t.type IN ('savings', 'item_contribution', 'share_transfer')
                  AND t.reversed = FALSE
                  AND t.created_at <= (p_year || '-11-30 23:59:59')::TIMESTAMPTZ
            ), 0) + m.opening_balance_savings AS nov_bal

        FROM members m
        WHERE m.group_id = p_group_id
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', full_name,
            'balances', jsonb_build_object(
                'jan', jan_bal,
                'mar', mar_bal,
                'may', may_bal,
                'jul', jul_bal,
                'sep', sep_bal,
                'nov', nov_bal
            )
        )
    ) INTO v_members
    FROM member_balances;

    -- 3. RETURN FINAL JSON
    RETURN jsonb_build_object(
        'financials', v_financials,
        'members', COALESCE(v_members, '[]'::jsonb),
        'group_id', p_group_id,
        'year', p_year
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_dividend_report IS 'Queries the entire system to generate precise dividend datasets (Financials + Member Historical Balances)';
