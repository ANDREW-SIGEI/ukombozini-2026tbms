-- ============================================
-- UKOMBOZI TBMS - INSTITUTIONAL BALANCE TRIGGERS
-- ============================================
-- Purpose: Maintain materialized balances in members table
-- Why: Instant dashboard performance with transaction-level integrity
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_member_balances()
RETURNS TRIGGER AS $$
DECLARE
    v_member_id BIGINT;
    v_old_member_id BIGINT;
BEGIN
    -- Handle INSERT and UPDATE
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        v_member_id := NEW.member_id;
    END IF;

    -- Handle DELETE and UPDATE (if member id was changed)
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        v_old_member_id := OLD.member_id;
    END IF;

    -- Update NEW or CURRENT member totals
    IF v_member_id IS NOT NULL THEN
        UPDATE members
        SET 
            current_savings = (
                SELECT COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE member_id = v_member_id 
                  AND type IN ('savings', 'dividend', 'share_transfer') 
                  AND reversed = FALSE
            ) + COALESCE(opening_balance_savings, 0),
            
            active_loan_balance = (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN type = 'loan_disbursement' THEN ABS(amount)
                        WHEN type = 'loan_repayment' THEN -amount
                        ELSE 0 
                    END
                ), 0)
                FROM transactions
                WHERE member_id = v_member_id 
                  AND reversed = FALSE
            ) + COALESCE(opening_balance_stl, 0) + COALESCE(opening_balance_ltl, 0),
            
            arrears_balance = (
                SELECT COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE member_id = v_member_id 
                  AND type = 'fine' 
                  AND reversed = FALSE
            )
        WHERE id = v_member_id;
    END IF;

    -- If business logic allowed changing a member on a transaction, update the old member too
    IF v_old_member_id IS NOT NULL AND v_old_member_id != COALESCE(v_member_id, -1) THEN
        UPDATE members
        SET 
            current_savings = (
                SELECT COALESCE(SUM(amount), 0)
                FROM transactions
                WHERE member_id = v_old_member_id 
                  AND type IN ('savings', 'dividend', 'share_transfer') 
                  AND reversed = FALSE
            ) + COALESCE(opening_balance_savings, 0),
            
            active_loan_balance = (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN type = 'loan_disbursement' THEN ABS(amount)
                        WHEN type = 'loan_repayment' THEN -amount
                        ELSE 0 
                    END
                ), 0)
                FROM transactions
                WHERE member_id = v_old_member_id 
                  AND reversed = FALSE
            ) + COALESCE(opening_balance_stl, 0) + COALESCE(opening_balance_ltl, 0)
        WHERE id = v_old_member_id;
    END IF;

    RETURN NULL; -- For AFTER triggers, return value is ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to transactions table
DROP TRIGGER IF EXISTS trigger_sync_member_balances ON transactions;
CREATE TRIGGER trigger_sync_member_balances
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_member_balances();

-- ============================================
-- MEETING TOTALS AUTO-CALCULATION
-- ============================================
CREATE OR REPLACE FUNCTION calculate_meeting_totals(p_session_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE meeting_sessions
    SET 
        total_savings = COALESCE((SELECT SUM(amount) FROM transactions WHERE session_id = p_session_id AND type = 'savings' AND reversed = FALSE), 0),
        total_stl_repayments = COALESCE((SELECT SUM(amount) FROM transactions WHERE session_id = p_session_id AND type = 'loan_repayment' AND notes ILIKE '%STL%' AND reversed = FALSE), 0),
        total_ltl_repayments = COALESCE((SELECT SUM(amount) FROM transactions WHERE session_id = p_session_id AND type = 'loan_repayment' AND notes ILIKE '%LTL%' AND reversed = FALSE), 0),
        total_welfare = COALESCE((SELECT SUM(amount) FROM transactions WHERE session_id = p_session_id AND type = 'welfare' AND reversed = FALSE), 0),
        total_project = COALESCE((SELECT SUM(amount) FROM transactions WHERE session_id = p_session_id AND type = 'project' AND reversed = FALSE), 0),
        total_fines = COALESCE((SELECT SUM(amount) FROM transactions WHERE session_id = p_session_id AND type = 'fine' AND reversed = FALSE), 0),
        total_withdrawals = COALESCE((SELECT SUM(ABS(amount)) FROM transactions WHERE session_id = p_session_id AND type = 'withdrawal' AND reversed = FALSE), 0),
        total_dividends_distributed = COALESCE((SELECT SUM(amount) FROM transactions WHERE session_id = p_session_id AND type = 'dividend' AND reversed = FALSE), 0),
        
        loans_disbursed_count = COALESCE((SELECT COUNT(*) FROM loans WHERE disbursement_session_id = p_session_id), 0),
        total_loans_disbursed = COALESCE((SELECT SUM(principal_amount) FROM loans WHERE disbursement_session_id = p_session_id), 0),
        
        updated_at = NOW()
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_meeting_totals_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.session_id IS NOT NULL THEN
        PERFORM calculate_meeting_totals(NEW.session_id);
    END IF;
    
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.session_id IS NOT NULL THEN
        PERFORM calculate_meeting_totals(OLD.session_id);
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_meeting_totals ON transactions;
CREATE TRIGGER trigger_update_meeting_totals
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_meeting_totals_on_transaction();

DO $$
BEGIN
    RAISE NOTICE '⚡ Auto-Sync Triggers Implemented';
END $$;
