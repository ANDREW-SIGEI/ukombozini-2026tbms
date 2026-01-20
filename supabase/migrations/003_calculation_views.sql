-- ============================================
-- UKOMBOZI TBMS - CALCULATION VIEWS & FUNCTIONS
-- ============================================
-- Purpose: Auto-calculate all balances from transactions
-- NO manual balance editing - fraud-resistant
-- ============================================

-- ============================================
-- 1. MEMBER SAVINGS VIEW
-- ============================================
CREATE OR REPLACE VIEW member_savings_view AS
SELECT 
    m.id AS member_id,
    m.full_name,
    m.group_id,
    m.opening_balance_savings,
    COALESCE(SUM(
        CASE 
            WHEN t.type IN ('savings', 'dividend') AND t.reversed = FALSE 
            THEN t.amount 
            ELSE 0 
        END
    ), 0) AS total_savings_transactions,
    (m.opening_balance_savings + COALESCE(SUM(
        CASE 
            WHEN t.type IN ('savings', 'dividend') AND t.reversed = FALSE 
            THEN t.amount 
            ELSE 0 
        END
    ), 0)) AS current_savings
FROM members m
LEFT JOIN transactions t ON t.member_id = m.id
GROUP BY m.id, m.full_name, m.group_id, m.opening_balance_savings;

COMMENT ON VIEW member_savings_view IS 'Auto-calculated member savings = opening balance + all savings transactions';

-- ============================================
-- 2. LOAN OUTSTANDING VIEW
-- ============================================
CREATE OR REPLACE VIEW loan_outstanding_view AS
SELECT 
    l.id AS loan_id,
    l.member_id,
    l.group_id,
    l.loan_type,
    l.principal_amount,
    l.interest_rate,
    l.issued_date,
    l.due_date,
    l.status,
    
    -- Disbursed amount
    COALESCE(SUM(
        CASE 
            WHEN t.type = 'loan_disbursement' AND t.reversed = FALSE 
            THEN ABS(t.amount)
            ELSE 0 
        END
    ), 0) AS total_disbursed,
    
    -- Repaid amount
    COALESCE(SUM(
        CASE 
            WHEN t.type = 'loan_repayment' AND t.reversed = FALSE 
            THEN t.amount 
            ELSE 0 
        END
    ), 0) AS total_repaid,
    
    -- Outstanding balance
    (COALESCE(SUM(
        CASE 
            WHEN t.type = 'loan_disbursement' AND t.reversed = FALSE 
            THEN ABS(t.amount)
            ELSE 0 
        END
    ), 0) - COALESCE(SUM(
        CASE 
            WHEN t.type = 'loan_repayment' AND t.reversed = FALSE 
            THEN t.amount 
            ELSE 0 
        END
    ), 0)) AS outstanding_balance
    
FROM loans l
LEFT JOIN transactions t ON t.loan_id = l.id
GROUP BY l.id, l.member_id, l.group_id, l.loan_type, l.principal_amount, 
         l.interest_rate, l.issued_date, l.due_date, l.status;

COMMENT ON VIEW loan_outstanding_view IS 'Auto-calculated loan balances = disbursed - repaid';

-- ============================================
-- 3. MEMBER ARREARS VIEW
-- ============================================
CREATE OR REPLACE VIEW member_arrears_view AS
SELECT 
    l.member_id,
    l.group_id,
    SUM(
        CASE 
            WHEN l.due_date < CURRENT_DATE 
                 AND lo.outstanding_balance > 0 
            THEN lo.outstanding_balance 
            ELSE 0 
        END
    ) AS total_arrears,
    COUNT(
        CASE 
            WHEN l.due_date < CURRENT_DATE 
                 AND lo.outstanding_balance > 0 
            THEN 1 
        END
    ) AS overdue_loans_count
FROM loans l
INNER JOIN loan_outstanding_view lo ON lo.loan_id = l.id
GROUP BY l.member_id, l.group_id;

COMMENT ON VIEW member_arrears_view IS 'Auto-calculated arrears = overdue loan balances';

-- ============================================
-- 4. MEMBER NET POSITION VIEW (COMPREHENSIVE)
-- ============================================
CREATE OR REPLACE VIEW member_net_position_view AS
SELECT 
    m.id AS member_id,
    m.full_name,
    m.phone,
    m.group_id,
    g.name AS group_name,
    m.status,
    
    -- Savings
    COALESCE(ms.current_savings, 0) AS savings,
    
    -- Active loans
    COALESCE(SUM(lo.outstanding_balance), 0) AS active_loans,
    
    -- Arrears
    COALESCE(ma.total_arrears, 0) AS arrears,
    
    -- Net position
    (COALESCE(ms.current_savings, 0) - 
     COALESCE(SUM(lo.outstanding_balance), 0) - 
     COALESCE(ma.total_arrears, 0)) AS net_position,
    
    -- Last activity
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
GROUP BY m.id, m.full_name, m.phone, m.group_id, g.name, m.status, 
         ms.current_savings, ma.total_arrears;

COMMENT ON VIEW member_net_position_view IS 'Complete member financial snapshot - used by frontend';

-- ============================================
-- 5. GROUP SUMMARY VIEW
-- ============================================
CREATE OR REPLACE VIEW group_summary_view AS
SELECT 
    g.id AS group_id,
    g.name AS group_name,
    g.status,
    
    -- Member counts
    COUNT(DISTINCT m.id) AS total_members,
    COUNT(DISTINCT CASE WHEN m.status = 'active' THEN m.id END) AS active_members,
    
    -- Financial totals
    COALESCE(SUM(mnp.savings), 0) AS total_savings,
    COALESCE(SUM(mnp.active_loans), 0) AS total_active_loans,
    COALESCE(SUM(mnp.arrears), 0) AS total_arrears,
    COALESCE(SUM(mnp.net_position), 0) AS group_net_position,
    
    -- Risk indicators
    COUNT(CASE WHEN mnp.net_position < 0 THEN 1 END) AS members_at_risk,
    COUNT(CASE WHEN mnp.net_position > 0 THEN 1 END) AS healthy_members,
    
    -- Activity
    MAX(mnp.last_activity_date) AS last_group_activity
    
FROM groups g
LEFT JOIN members m ON m.group_id = g.id
LEFT JOIN member_net_position_view mnp ON mnp.member_id = m.id
GROUP BY g.id, g.name, g.status;

COMMENT ON VIEW group_summary_view IS 'Group-level financial overview for management dashboard';

-- ============================================
-- 6. MEETING SUMMARY VIEW
-- ============================================
CREATE OR REPLACE VIEW meeting_summary_view AS
SELECT 
    mt.id AS meeting_id,
    mt.group_id,
    g.name AS group_name,
    mt.meeting_date,
    mt.status,
    
    -- Transaction counts
    COUNT(DISTINCT t.id) AS total_transactions,
    COUNT(DISTINCT t.member_id) AS members_participated,
    
    -- Cash flow
    COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS total_cash_in,
    COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS total_cash_out,
    
    -- By type
    COALESCE(SUM(CASE WHEN t.type = 'savings' THEN t.amount ELSE 0 END), 0) AS savings_collected,
    COALESCE(SUM(CASE WHEN t.type = 'loan_disbursement' THEN ABS(t.amount) ELSE 0 END), 0) AS loans_disbursed,
    COALESCE(SUM(CASE WHEN t.type = 'loan_repayment' THEN t.amount ELSE 0 END), 0) AS repayments_collected,
    
    mt.created_by,
    mt.posted_by,
    mt.posted_at
    
FROM meetings mt
LEFT JOIN groups g ON g.id = mt.group_id
LEFT JOIN transactions t ON t.meeting_id = mt.id AND t.reversed = FALSE
GROUP BY mt.id, mt.group_id, g.name, mt.meeting_date, mt.status, 
         mt.created_by, mt.posted_by, mt.posted_at;

COMMENT ON VIEW meeting_summary_view IS 'Meeting-level financial summary for daily reports';

-- ============================================
-- 7. TRANSACTION REVERSAL FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION reverse_transaction(
    p_transaction_id UUID,
    p_reason TEXT,
    p_approved_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_original_transaction transactions%ROWTYPE;
    v_reversal_transaction_id UUID;
BEGIN
    -- Get original transaction
    SELECT * INTO v_original_transaction 
    FROM transactions 
    WHERE id = p_transaction_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
    END IF;
    
    IF v_original_transaction.reversed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction already reversed');
    END IF;
    
    -- Create reversal transaction (opposite amount)
    INSERT INTO transactions (
        member_id, group_id, meeting_id, loan_id, type, amount, 
        reference, notes, posted_by
    ) VALUES (
        v_original_transaction.member_id,
        v_original_transaction.group_id,
        v_original_transaction.meeting_id,
        v_original_transaction.loan_id,
        'reversal',
        -v_original_transaction.amount,  -- Opposite amount
        'REV-' || v_original_transaction.reference,
        'Reversal of transaction #' || p_transaction_id || ': ' || p_reason,
        p_approved_by
    ) RETURNING id INTO v_reversal_transaction_id;
    
    -- Mark original as reversed
    UPDATE transactions 
    SET reversed = TRUE, 
        reversal_id = v_reversal_transaction_id,
        reversal_reason = p_reason
    WHERE id = p_transaction_id;
    
    -- Log reversal
    INSERT INTO reversals (
        original_transaction_id, 
        reversal_transaction_id, 
        reason, 
        approved_by
    ) VALUES (
        p_transaction_id,
        v_reversal_transaction_id,
        p_reason,
        p_approved_by
    );
    
    RETURN jsonb_build_object(
        'success', true, 
        'reversal_transaction_id', v_reversal_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reverse_transaction IS 'Audit-safe transaction reversal - creates opposite transaction';

-- ============================================
-- 8. MEMBER STATEMENT FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_member_statement(
    p_member_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    transaction_date TIMESTAMPTZ,
    transaction_type TEXT,
    reference TEXT,
    debit NUMERIC,
    credit NUMERIC,
    balance NUMERIC,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH running_balance AS (
        SELECT 
            t.created_at,
            t.type,
            t.reference,
            CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END AS debit,
            CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END AS credit,
            t.notes,
            SUM(t.amount) OVER (ORDER BY t.created_at) AS running_balance
        FROM transactions t
        WHERE t.member_id = p_member_id
          AND t.reversed = FALSE
          AND (p_start_date IS NULL OR t.created_at::DATE >= p_start_date)
          AND (p_end_date IS NULL OR t.created_at::DATE <= p_end_date)
        ORDER BY t.created_at
    )
    SELECT 
        rb.created_at,
        rb.type,
        rb.reference,
        rb.debit,
        rb.credit,
        rb.running_balance,
        rb.notes
    FROM running_balance rb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_member_statement IS 'Generate member statement with running balance';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '📊 Calculation Views Created Successfully';
    RAISE NOTICE '✅ member_net_position_view: Complete financial snapshot';
    RAISE NOTICE '✅ group_summary_view: Management dashboard';
    RAISE NOTICE '✅ meeting_summary_view: Daily reports';
    RAISE NOTICE '✅ reverse_transaction(): Audit-safe corrections';
    RAISE NOTICE '✅ get_member_statement(): PDF-ready statements';
    RAISE NOTICE '🔒 All balances auto-calculated - NO manual editing';
END $$;
