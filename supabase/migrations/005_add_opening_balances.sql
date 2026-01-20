-- ============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add opening balance columns to members table
DO $$
BEGIN
    -- Add opening_balance_savings if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_savings') THEN
        ALTER TABLE members ADD COLUMN opening_balance_savings NUMERIC(15, 2) DEFAULT 0;
    END IF;
    
    -- Add opening_balance_ltl if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_ltl') THEN
        ALTER TABLE members ADD COLUMN opening_balance_ltl NUMERIC(15, 2) DEFAULT 0;
    END IF;
    
    -- Add opening_balance_stl if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_stl') THEN
        ALTER TABLE members ADD COLUMN opening_balance_stl NUMERIC(15, 2) DEFAULT 0;
    END IF;
    
    -- Add opening_balance_reason if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_reason') THEN
        ALTER TABLE members ADD COLUMN opening_balance_reason TEXT;
    END IF;
    
    -- Add opening_balance_set_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_set_by') THEN
        ALTER TABLE members ADD COLUMN opening_balance_set_by UUID REFERENCES profiles(id);
    END IF;
    
    -- Add opening_balance_set_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_set_at') THEN
        ALTER TABLE members ADD COLUMN opening_balance_set_at TIMESTAMPTZ;
    END IF;
    
    -- Add opening_balance_locked if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'opening_balance_locked') THEN
        ALTER TABLE members ADD COLUMN opening_balance_locked BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add updated_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'members' AND column_name = 'updated_at') THEN
        ALTER TABLE members ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Opening balance columns added to members table';
    RAISE NOTICE '📊 Members table now supports migration from old system';
END $$;
