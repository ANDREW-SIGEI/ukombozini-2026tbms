-- ============================================
-- UKOMBOZI TBMS - CALCULATION VIEWS
-- ============================================

-- ============================================
-- 1. MEMBER NET POSITION VIEW (Optimized)
-- ============================================
DROP VIEW IF EXISTS member_net_position_view CASCADE;
CREATE OR REPLACE VIEW member_net_position_view AS
SELECT 
    m.id AS member_id,
    m.full_name,
    m.phone,
    m.group_id,
    g.group_name,
    m.status,
    
    -- Reading from cached columns for speed
    COALESCE(m.current_savings, 0) AS savings,
    COALESCE(m.active_loan_balance, 0) AS active_loans,
    COALESCE(m.arrears_balance, 0) AS arrears,
    
    (COALESCE(m.current_savings, 0) - COALESCE(m.active_loan_balance, 0)) AS net_position,
    
    m.last_sms_sent_at,
    m.updated_at AS last_sync_date
FROM members m
LEFT JOIN groups g ON g.id = m.group_id;

-- ============================================
-- 2. GROUP SUMMARY VIEW
-- ============================================
DROP VIEW IF EXISTS group_summary_view CASCADE;
CREATE OR REPLACE VIEW group_summary_view AS
SELECT 
    g.id AS group_id,
    g.group_name,
    COALESCE(g.status, 'active') AS status,
    
    COUNT(DISTINCT m.id) AS total_members,
    COALESCE(SUM(m.current_savings), 0) AS total_savings,
    COALESCE(SUM(m.active_loan_balance), 0) AS total_active_loans,
    COALESCE(SUM(m.arrears_balance), 0) AS total_arrears
FROM groups g
LEFT JOIN members m ON m.group_id = g.id
GROUP BY g.id, g.group_name, g.status;

-- ============================================
-- 3. MEETING SUMMARY VIEW
-- ============================================
DROP VIEW IF EXISTS meeting_summary_view CASCADE;
CREATE OR REPLACE VIEW meeting_summary_view AS
SELECT 
    ms.id AS meeting_id,
    ms.session_number,
    ms.group_id,
    g.group_name,
    ms.meeting_date,
    ms.status,
    
    -- Financials from the session record
    ms.total_collected,
    ms.total_loans_disbursed,
    ms.total_withdrawals,
    
    -- Net Cash Position for the day (Cash in Hand)
    (ms.total_collected - ms.total_loans_disbursed - ms.total_withdrawals) AS net_cash_balance,
    
    ms.members_present,
    ms.members_absent,
    
    ms.opened_by,
    p.full_name AS opened_by_name
FROM meeting_sessions ms
JOIN groups g ON ms.group_id = g.id
JOIN profiles p ON ms.opened_by = p.id;

DO $$
BEGIN
    RAISE NOTICE '📊 Calculation Views Created Successfully';
END $$;
