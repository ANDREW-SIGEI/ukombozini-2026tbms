-- ============================================
-- STEP 6: CREATE SEED DATA (Test Groups & Officers)
-- ============================================

-- Insert test groups (only if they don't exist)
INSERT INTO groups (group_name, registration_date, status, meeting_day, meeting_frequency)
VALUES 
    ('Ukombozi Group A', '2025-01-01', 'ACTIVE', 'Monday', 'WEEKLY'),
    ('Ukombozi Group B', '2025-01-15', 'ACTIVE', 'Wednesday', 'WEEKLY'),
    ('Victory Women Group', '2025-02-01', 'ACTIVE', 'Friday', 'MONTHLY')
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ STEP 6 COMPLETE: Seed data created';
    RAISE NOTICE '📊 Created 3 test groups';
    RAISE NOTICE '👉 Next: Assign officers to groups in Admin Panel';
END $$;
