-- ============================================
-- UKOMBOZI TBMS - DATABASE RESET SCRIPT
-- ============================================
-- WARNING: This will DELETE ALL DATA!
-- Only run if you want a completely fresh start
-- ============================================

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS reversals CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS officer_groups CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop any views that might exist
DROP VIEW IF EXISTS member_net_position_view CASCADE;
DROP VIEW IF EXISTS member_savings_view CASCADE;
DROP VIEW IF EXISTS member_loan_balance_view CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_dividend_report(BIGINT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS post_dividend_run(BIGINT, INTEGER, JSONB, JSONB, UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_loan_eligibility(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS generate_stl_reducing_balance_schedule(UUID, NUMERIC, NUMERIC, INTEGER, DATE) CASCADE;

-- Drop additional tables from other migrations
DROP TABLE IF EXISTS dividend_payouts CASCADE;
DROP TABLE IF EXISTS dividend_runs CASCADE;
DROP TABLE IF EXISTS loan_guarantors CASCADE;
DROP TABLE IF EXISTS loan_applications CASCADE;
DROP TABLE IF EXISTS loan_products CASCADE;
DROP TABLE IF EXISTS meeting_attendance CASCADE;
DROP TABLE IF EXISTS meeting_sessions CASCADE;
DROP TABLE IF EXISTS reconciliation_variance_history CASCADE;
DROP TABLE IF EXISTS daily_cash_reconciliation CASCADE;
DROP TABLE IF EXISTS sms_retry_queue CASCADE;
DROP TABLE IF EXISTS sms_notifications CASCADE;
DROP TABLE IF EXISTS sms_templates CASCADE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🗑️  All tables dropped successfully';
    RAISE NOTICE '✅ Database is clean - ready for fresh migrations';
    RAISE NOTICE '📋 Next step: Run migrations 001 through 013 in order';
END $$;
