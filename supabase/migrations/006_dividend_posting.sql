-- ============================================
-- UKOMBOZI TBMS - DIVIDEND POSTING (AUDIT & LEDGER)
-- ============================================

-- 1. DIVIDEND RUNS TABLE (The "Header" for a dividend session)
CREATE TABLE dividend_runs (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    year INTEGER NOT NULL,
    
    total_trf NUMERIC(15, 2) NOT NULL,
    total_expenses NUMERIC(15, 2) NOT NULL,
    total_reinvested NUMERIC(15, 2) NOT NULL,
    total_payout_amount NUMERIC(15, 2) NOT NULL,
    dividend_rate NUMERIC(10, 6) NOT NULL,
    
    status TEXT DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
    posted_by UUID REFERENCES profiles(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(group_id, year) -- Prevent double posting for the same year
);

COMMENT ON TABLE dividend_runs IS 'Master record for a yearly dividend distribution';

-- 2. DIVIDEND PAYOUTS TABLE (The "Lines" / Individual Details)
CREATE TABLE dividend_payouts (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES dividend_runs(id) ON DELETE RESTRICT,
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    
    average_shares NUMERIC(15, 2) NOT NULL,
    dividend_amount NUMERIC(15, 2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. POST DIVIDEND RUN RPC (Transactional)
-- This function handles the entire posting process atomically:
-- A. Checks for duplicates
-- B. Creates the Run record
-- C. Creates Payout records
-- D. Credits Member Savings (Transaction + Balance Update)
CREATE OR REPLACE FUNCTION post_dividend_run(
    p_group_id BIGINT,
    p_year INTEGER,
    p_financials JSONB, -- { trf, expenses, reinvested, total_payout, rate }
    p_payouts JSONB,    -- Array of { member_id, avg_shares, amount }
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_run_id BIGINT;
    v_member_record JSONB;
    v_new_balance NUMERIC;
BEGIN
    -- A. Check if already posted
    IF EXISTS (SELECT 1 FROM dividend_runs WHERE group_id = p_group_id AND year = p_year AND status = 'POSTED') THEN
        RAISE EXCEPTION 'Dividends for this group and year have already been posted.';
    END IF;

    -- B. Insert Header
    INSERT INTO dividend_runs (
        group_id, year, 
        total_trf, total_expenses, total_reinvested, total_payout_amount, dividend_rate,
        status, posted_by
    )
    VALUES (
        p_group_id, p_year,
        (p_financials->>'trf')::NUMERIC,
        (p_financials->>'expenses')::NUMERIC,
        (p_financials->>'reinvested')::NUMERIC,
        (p_financials->>'total_payout')::NUMERIC,
        (p_financials->>'rate')::NUMERIC,
        'POSTED', p_user_id
    )
    RETURNING id INTO v_run_id;

    -- C. Loop Payouts
    FOR v_member_record IN SELECT * FROM jsonb_array_elements(p_payouts)
    LOOP
        -- 1. Insert Payout Record
        INSERT INTO dividend_payouts (run_id, member_id, average_shares, dividend_amount)
        VALUES (
            v_run_id,
            (v_member_record->>'member_id')::BIGINT,
            (v_member_record->>'avg_shares')::NUMERIC,
            (v_member_record->>'amount')::NUMERIC
        );

        -- 2. Create Ledger Transaction (Credit)
        -- Note: We use 'dividend' type as defined in 001_core_schema.sql
        INSERT INTO transactions (
            member_id, group_id, type, amount, reference, notes, posted_by, created_at
        )
        VALUES (
            (v_member_record->>'member_id')::BIGINT,
            p_group_id,
            'dividend',
            (v_member_record->>'amount')::NUMERIC,
            'DIV-' || p_year || '-' || v_run_id,
            'Annual Dividend Payout ' || p_year,
            p_user_id,
            NOW()
        );

        -- 3. Update Member Balance (Auto-Reinvest / Credit Savings)
        -- Assuming dividends go to Savings Account by default
        UPDATE members
        SET 
            -- We don't store balance directly usually, but if we do (optimization cache):
            -- We assume opening_balance or calculated view handles it. 
            -- But wait, `members` table has `current_savings` cache column?
            -- 001_core_schema.sql line 68 says members has `opening_balance_savings`.
            -- It does NOT have `current_savings` column. Balances are derived.
            -- HOWEVER, in api.js `updateMemberSavings`, it attempts to update `current_savings`.
            -- This contradicts 001_core_schema.sql which says "Members (Identity Only - NO Balances)".
            
            -- Let's check 001_core_schema.sql again.
            -- Line 68: `opening_balance_savings NUMERIC`.
            -- Line 81: "Member identity - balances calculated from transactions table".
            
            -- So we DO NOT update `members` table balance column because it doesn't exist (or shouldn't).
            -- The Transaction we inserted in Step 2 is enough to update the balance in Views.
            
            updated_at = NOW() -- Just touch the record
        WHERE id = (v_member_record->>'member_id')::BIGINT;
        
    END LOOP;

    RETURN jsonb_build_object('success', true, 'run_id', v_run_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
