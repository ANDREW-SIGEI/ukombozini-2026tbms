-- ============================================
-- STEP 10: UPDATE SMS TYPE CONSTRAINT (ALLOW BROADCAST)
-- ============================================

-- Drop the old internal check constraint
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_type_check;

-- Add new constraint allowing BROADCAST
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_type_check 
CHECK (type IN ('REGISTRATION', 'MEETING', 'LOAN', 'OTHER', 'BROADCAST'));

-- Success Message
DO $$
BEGIN
    RAISE NOTICE '✅ SMS Logs updated to allow BROADCAST messages';
END $$;
