-- ============================================
-- STEP 4: UPDATE VIEWS TO USE CORRECT COLUMNS
-- ============================================

-- Update member_net_position_view to use group_name
CREATE OR REPLACE VIEW member_net_position_view AS
SELECT 
    m.id AS member_id,
    m.full_name,
    m.phone,
    m.group_id,
    g.group_name,
    m.status,
    
    COALESCE(ms.current_savings, 0) AS savings,
    COALESCE(SUM(lo.outstanding_balance), 0) AS active_loans,
    COALESCE(ma.total_arrears, 0) AS arrears,
    
    (COALESCE(ms.current_savings, 0) - 
     COALESCE(SUM(lo.outstanding_balance), 0) - 
     COALESCE(ma.total_arrears, 0)) AS net_position,
    
    (SELECT MAX(t.created_at) 
     FROM transactions t 
     WHERE t.member_id = m.id AND t.reversed = FALSE) AS last_activity_date,
    
    (SELECT t.type 
     FROM transactions t 
     WHERE t.member_id = m.id AND t.reversed = FALSE 
     ORDER BY t.created_at DESC 
     LIMIT 1) AS last_activity_type
    
FROM members m
LEFT JOIN groups g ON g.id = m.group_id
LEFT JOIN member_savings_view ms ON ms.member_id = m.id
LEFT JOIN loan_outstanding_view lo ON lo.member_id = m.id AND lo.outstanding_balance > 0
LEFT JOIN member_arrears_view ma ON ma.member_id = m.id
GROUP BY m.id, m.full_name, m.phone, m.group_id, g.group_name, m.status, 
         ms.current_savings, ma.total_arrears;

-- Update group_summary_view
CREATE OR REPLACE VIEW group_summary_view AS
SELECT 
    g.id AS group_id,
    g.group_name,
    g.status,
    
    COUNT(DISTINCT m.id) AS total_members,
    COUNT(DISTINCT CASE WHEN m.status = 'ACTIVE' THEN m.id END) AS active_members,
    
    COALESCE(SUM(mnp.savings), 0) AS total_savings,
    COALESCE(SUM(mnp.active_loans), 0) AS total_active_loans,
    COALESCE(SUM(mnp.arrears), 0) AS total_arrears,
    COALESCE(SUM(mnp.net_position), 0) AS group_net_position,
    
    COUNT(CASE WHEN mnp.net_position < 0 THEN 1 END) AS members_at_risk,
    COUNT(CASE WHEN mnp.net_position > 0 THEN 1 END) AS healthy_members,
    
    MAX(mnp.last_activity_date) AS last_group_activity
    
FROM groups g
LEFT JOIN members m ON m.group_id = g.id
LEFT JOIN member_net_position_view mnp ON mnp.member_id = m.id
GROUP BY g.id, g.group_name, g.status;

-- Update meeting_summary_view
CREATE OR REPLACE VIEW meeting_summary_view AS
SELECT 
    mt.id AS meeting_id,
    mt.group_id,
    g.group_name,
    mt.meeting_date,
    mt.status,
    
    COUNT(DISTINCT t.id) AS total_transactions,
    COUNT(DISTINCT t.member_id) AS members_participated,
    
    COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS total_cash_in,
    COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS total_cash_out,
    
    COALESCE(SUM(CASE WHEN t.type = 'savings' THEN t.amount ELSE 0 END), 0) AS savings_collected,
    COALESCE(SUM(CASE WHEN t.type = 'loan_disbursement' THEN ABS(t.amount) ELSE 0 END), 0) AS loans_disbursed,
    COALESCE(SUM(CASE WHEN t.type = 'loan_repayment' THEN t.amount ELSE 0 END), 0) AS repayments_collected,
    
    mt.created_at
    
FROM meetings mt
LEFT JOIN groups g ON g.id = mt.group_id
LEFT JOIN transactions t ON t.meeting_id = mt.id AND t.reversed = FALSE
GROUP BY mt.id, mt.group_id, g.group_name, mt.meeting_date, mt.status, mt.created_at;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ STEP 4 COMPLETE: Views updated with correct column names';
END $$;
