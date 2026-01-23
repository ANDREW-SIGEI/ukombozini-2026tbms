-- ============================================
-- UKOMBOZI TBMS - LOAN PRODUCT MATRIX
-- ============================================
-- Official loan products with standardized terms
-- Read-only for field officers, admin-only updates
-- ============================================

-- Create loan_products table
CREATE TABLE IF NOT EXISTS loan_products (
    id BIGSERIAL PRIMARY KEY,
    loan_amount NUMERIC(15, 2) NOT NULL UNIQUE,
    monthly_installment NUMERIC(15, 2) NOT NULL,
    principal_portion NUMERIC(15, 2) NOT NULL,
    interest_portion NUMERIC(15, 2) NOT NULL,
    shares_contribution NUMERIC(15, 2) NOT NULL,
    period_months INTEGER NOT NULL,
    
    -- Metadata
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    -- Constraints
    CONSTRAINT valid_amounts CHECK (
        loan_amount > 0 AND
        monthly_installment > 0 AND
        principal_portion > 0 AND
        interest_portion >= 0 AND
        shares_contribution >= 0 AND
        period_months > 0
    )
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_loan_products_amount ON loan_products(loan_amount) WHERE active = TRUE;

-- Insert official UKOMBOZI loan products
INSERT INTO loan_products (
    loan_amount, monthly_installment, principal_portion, interest_portion, 
    shares_contribution, period_months
) VALUES
    (5000, 500, 345, 55, 100, 15),
    (10000, 700, 500, 100, 100, 20),
    (15000, 900, 625, 135, 140, 24),
    (20000, 1200, 835, 180, 185, 24),
    (30000, 1850, 1200, 300, 300, 24),
    (50000, 2500, 2000, 250, 250, 25),
    (60000, 3200, 2500, 350, 350, 24),
    (70000, 3700, 2800, 450, 450, 25),
    (100000, 5000, 4000, 500, 500, 25),
    (150000, 7500, 6000, 1500, 1500, 25),
    (180000, 9000, 7500, 900, 900, 24),
    (200000, 10000, 8000, 1000, 1000, 25),
    (250000, 12500, 10000, 1250, 1250, 25),
    (300000, 15000, 12000, 1500, 1500, 25),
    (350000, 17500, 16000, 1750, 1750, 25),
    (400000, 20000, 16000, 2000, 2000, 25),
    (500000, 25000, 20000, 2500, 2500, 25),
    (600000, 30000, 24000, 3000, 3000, 25),
    (700000, 35000, 28000, 3500, 3500, 25),
    (800000, 40000, 32000, 4000, 4000, 25),
    (900000, 45000, 36000, 4500, 4500, 25),
    (1000000, 50000, 40000, 5000, 5000, 25)
ON CONFLICT (loan_amount) DO NOTHING;

-- Create repayment_schedule table
DROP TABLE IF EXISTS repayment_schedule CASCADE;
CREATE TABLE IF NOT EXISTS repayment_schedule (
    id BIGSERIAL PRIMARY KEY,
    loan_id BIGINT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    
    -- Schedule details
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    
    -- Expected amounts (from loan product)
    expected_installment NUMERIC(15, 2) NOT NULL,
    expected_principal NUMERIC(15, 2) NOT NULL,
    expected_interest NUMERIC(15, 2) NOT NULL,
    expected_shares NUMERIC(15, 2) NOT NULL,
    
    -- Actual payments
    paid_amount NUMERIC(15, 2) DEFAULT 0,
    paid_date DATE,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    days_overdue INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(loan_id, installment_number),
    CONSTRAINT valid_payment CHECK (paid_amount >= 0 AND paid_amount <= expected_installment * 1.5)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_loan ON repayment_schedule(loan_id);
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_due_date ON repayment_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_repayment_schedule_status ON repayment_schedule(status);

-- ============================================
-- FUNCTION: Generate Repayment Schedule
-- ============================================
DROP FUNCTION IF EXISTS generate_repayment_schedule(BIGINT, NUMERIC, DATE);
DROP FUNCTION IF EXISTS generate_repayment_schedule(BIGINT, NUMERIC, DATE);
CREATE OR REPLACE FUNCTION generate_repayment_schedule(
    p_loan_id BIGINT,
    p_loan_amount NUMERIC,
    p_start_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_loan_product loan_products%ROWTYPE;
    v_current_date DATE;
    v_installment_num INTEGER;
BEGIN
    -- Get loan product details
    SELECT * INTO v_loan_product
    FROM loan_products
    WHERE loan_amount = p_loan_amount AND active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No loan product found for amount: ' || p_loan_amount
        );
    END IF;
    
    -- Delete existing schedule if any
    DELETE FROM repayment_schedule WHERE loan_id = p_loan_id;
    
    -- Generate monthly schedule
    v_current_date := p_start_date;
    
    FOR v_installment_num IN 1..v_loan_product.period_months LOOP
        -- Calculate due date (1 month from start, then monthly)
        v_current_date := p_start_date + (v_installment_num || ' months')::INTERVAL;
        
        -- Insert schedule record
        INSERT INTO repayment_schedule (
            loan_id,
            installment_number,
            due_date,
            expected_installment,
            expected_principal,
            expected_interest,
            expected_shares,
            status
        ) VALUES (
            p_loan_id,
            v_installment_num,
            v_current_date,
            v_loan_product.monthly_installment,
            v_loan_product.principal_portion,
            v_loan_product.interest_portion,
            v_loan_product.shares_contribution,
            'pending'
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'installments_created', v_loan_product.period_months,
        'monthly_installment', v_loan_product.monthly_installment,
        'total_repayment', v_loan_product.monthly_installment * v_loan_product.period_months
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Calculate Arrears
-- ============================================
DROP FUNCTION IF EXISTS calculate_loan_arrears(BIGINT);
DROP FUNCTION IF EXISTS calculate_loan_arrears(BIGINT);
CREATE OR REPLACE FUNCTION calculate_loan_arrears(p_loan_id BIGINT)
RETURNS JSONB AS $$
DECLARE
    v_total_arrears NUMERIC := 0;
    v_overdue_installments INTEGER := 0;
    v_schedule RECORD;
BEGIN
    -- Update overdue status and calculate arrears
    FOR v_schedule IN
        SELECT *
        FROM repayment_schedule
        WHERE loan_id = p_loan_id
        AND status != 'paid'
        ORDER BY installment_number
    LOOP
        -- Calculate days overdue
        IF v_schedule.due_date < CURRENT_DATE THEN
            UPDATE repayment_schedule
            SET 
                status = CASE
                    WHEN paid_amount >= expected_installment THEN 'paid'
                    WHEN paid_amount > 0 THEN 'partial'
                    ELSE 'overdue'
                END,
                days_overdue = CURRENT_DATE - due_date
            WHERE id = v_schedule.id;
            
            -- Add to arrears if not fully paid
            IF v_schedule.paid_amount < v_schedule.expected_installment THEN
                v_total_arrears := v_total_arrears + (v_schedule.expected_installment - v_schedule.paid_amount);
                v_overdue_installments := v_overdue_installments + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'total_arrears', v_total_arrears,
        'overdue_installments', v_overdue_installments,
        'calculated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Record Payment
-- ============================================
DROP FUNCTION IF EXISTS record_loan_payment(BIGINT, INTEGER, NUMERIC, DATE);
DROP FUNCTION IF EXISTS record_loan_payment(BIGINT, INTEGER, NUMERIC, DATE);
CREATE OR REPLACE FUNCTION record_loan_payment(
    p_loan_id BIGINT,
    p_installment_number INTEGER,
    p_amount NUMERIC,
    p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
    v_schedule repayment_schedule%ROWTYPE;
    v_new_status TEXT;
BEGIN
    -- Get schedule record
    SELECT * INTO v_schedule
    FROM repayment_schedule
    WHERE loan_id = p_loan_id
    AND installment_number = p_installment_number;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Installment not found'
        );
    END IF;
    
    -- Determine new status
    IF (v_schedule.paid_amount + p_amount) >= v_schedule.expected_installment THEN
        v_new_status := 'paid';
    ELSIF (v_schedule.paid_amount + p_amount) > 0 THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := v_schedule.status;
    END IF;
    
    -- Update payment
    UPDATE repayment_schedule
    SET 
        paid_amount = paid_amount + p_amount,
        paid_date = CASE WHEN v_new_status = 'paid' THEN p_payment_date ELSE paid_date END,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_schedule.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'installment_number', p_installment_number,
        'amount_paid', p_amount,
        'total_paid', v_schedule.paid_amount + p_amount,
        'status', v_new_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEW: Loan Summary with Arrears
-- ============================================
CREATE OR REPLACE VIEW loan_summary_view AS
SELECT 
    l.id AS loan_id,
    l.member_id,
    m.full_name AS member_name,
    l.group_id,
    g.group_name AS group_name,
    l.loan_type,
    l.principal_amount,
    l.issued_date,
    l.due_date,
    l.status,
    
    -- Repayment summary
    COUNT(rs.id) AS total_installments,
    COUNT(CASE WHEN rs.status = 'paid' THEN 1 END) AS paid_installments,
    COUNT(CASE WHEN rs.status = 'overdue' THEN 1 END) AS overdue_installments,
    
    -- Financial summary
    SUM(rs.expected_installment) AS total_expected,
    SUM(rs.paid_amount) AS total_paid,
    SUM(CASE WHEN rs.status = 'overdue' THEN (rs.expected_installment - rs.paid_amount) ELSE 0 END) AS total_arrears,
    
    -- Next payment
    MIN(CASE WHEN rs.status IN ('pending', 'partial') THEN rs.due_date END) AS next_payment_date,
    MIN(CASE WHEN rs.status IN ('pending', 'partial') THEN rs.expected_installment END) AS next_payment_amount
    
FROM loans l
LEFT JOIN members m ON m.id = l.member_id
LEFT JOIN groups g ON g.id = l.group_id
LEFT JOIN repayment_schedule rs ON rs.loan_id = l.id
GROUP BY l.id, l.member_id, m.full_name, l.group_id, g.group_name, l.loan_type, l.principal_amount, 
         l.issued_date, l.due_date, l.status;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE repayment_schedule ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Everyone can view loan products" ON loan_products;
DROP POLICY IF EXISTS "Admins can manage loan products" ON loan_products;
DROP POLICY IF EXISTS "Officers can view repayment schedules for assigned groups" ON repayment_schedule;
DROP POLICY IF EXISTS "Admins can view all repayment schedules" ON repayment_schedule;
DROP POLICY IF EXISTS "Officers can update payments for assigned groups" ON repayment_schedule;

-- Loan Products: Everyone can read, only admins can modify
CREATE POLICY "Everyone can view loan products"
    ON loan_products FOR SELECT
    USING (active = TRUE);

CREATE POLICY "Admins can manage loan products"
    ON loan_products FOR ALL
    USING (is_director_or_admin());

-- Repayment Schedule: Officers can view their groups, admins can view all
CREATE POLICY "Officers can view repayment schedules for assigned groups"
    ON repayment_schedule FOR SELECT
    USING (
        loan_id IN (
            SELECT id FROM loans
            WHERE group_id IN (SELECT get_officer_groups())
        )
    );

CREATE POLICY "Admins can view all repayment schedules"
    ON repayment_schedule FOR SELECT
    USING (is_director_or_admin());

CREATE POLICY "Officers can update payments for assigned groups"
    ON repayment_schedule FOR UPDATE
    USING (
        loan_id IN (
            SELECT id FROM loans
            WHERE group_id IN (SELECT get_officer_groups())
        )
    );

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Loan Product Matrix Created';
    RAISE NOTICE '📊 22 loan products loaded (KES 5K - 1M)';
    RAISE NOTICE '📅 Repayment schedule system ready';
    RAISE NOTICE '🧮 Auto-calculation functions created';
    RAISE NOTICE '🔒 RLS policies applied';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Field officers can now:';
    RAISE NOTICE '   - View standardized loan options';
    RAISE NOTICE '   - Auto-generate repayment schedules';
    RAISE NOTICE '   - Track arrears in real-time';
    RAISE NOTICE '   - Record payments accurately';
END $$;


