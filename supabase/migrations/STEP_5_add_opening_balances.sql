-- ============================================
-- STEP 5: ADD OPENING BALANCE COLUMNS
-- ============================================

-- Add opening balance columns to members table
DO $$
BEGIN
    -- Add opening_balance_savings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_savings') THEN
        ALTER TABLE members ADD COLUMN opening_balance_savings NUMERIC(15, 2) DEFAULT 0;
        RAISE NOTICE '✅ Added opening_balance_savings column';
    END IF;
    
    -- Add opening_balance_ltl
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_ltl') THEN
        ALTER TABLE members ADD COLUMN opening_balance_ltl NUMERIC(15, 2) DEFAULT 0;
        RAISE NOTICE '✅ Added opening_balance_ltl column';
    END IF;
    
    -- Add opening_balance_stl
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_stl') THEN
        ALTER TABLE members ADD COLUMN opening_balance_stl NUMERIC(15, 2) DEFAULT 0;
        RAISE NOTICE '✅ Added opening_balance_stl column';
    END IF;
    
    -- Add opening_balance_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_reason') THEN
        ALTER TABLE members ADD COLUMN opening_balance_reason TEXT;
        RAISE NOTICE '✅ Added opening_balance_reason column';
    END IF;
    
    -- Add opening_balance_set_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_set_by') THEN
        ALTER TABLE members ADD COLUMN opening_balance_set_by UUID REFERENCES profiles(id);
        RAISE NOTICE '✅ Added opening_balance_set_by column';
    END IF;
    
    -- Add opening_balance_set_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_set_at') THEN
        ALTER TABLE members ADD COLUMN opening_balance_set_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Added opening_balance_set_at column';
    END IF;
    
    -- Add opening_balance_locked
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_locked') THEN
        ALTER TABLE members ADD COLUMN opening_balance_locked BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Added opening_balance_locked column';
    END IF;
    
    -- Add updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'updated_at') THEN
        ALTER TABLE members ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE '✅ Added updated_at column';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ STEP 5 COMPLETE: Opening balance columns added to members';
END $$;
