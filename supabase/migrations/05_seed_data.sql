-- ============================================
-- UKOMBOZI TBMS - SEED DATA
-- ============================================

-- 1. LOAN PRODUCTS
INSERT INTO loan_products (loan_amount, monthly_installment, principal_portion, interest_portion, shares_contribution, repayment_period_months) VALUES
(5000, 500, 345, 55, 100, 15),
(10000, 700, 500, 100, 100, 20),
(15000, 900, 625, 135, 140, 24),
(20000, 1200, 835, 180, 185, 24),
(50000, 2500, 2000, 250, 250, 25),
(100000, 5000, 4000, 500, 500, 25)
ON CONFLICT (loan_amount) DO NOTHING;

-- 2. GROUPS
INSERT INTO groups (group_name, registration_date, status, meeting_day, meeting_frequency) VALUES 
('Ukombozi Group A', '2025-01-01', 'ACTIVE', 'Monday', 'WEEKLY'),
('Ukombozi Group B', '2025-01-15', 'ACTIVE', 'Wednesday', 'WEEKLY'),
('Victory Women Group', '2025-02-01', 'ACTIVE', 'Friday', 'MONTHLY')
ON CONFLICT (group_name) DO NOTHING;

-- 3. SYSTEM SETTINGS
INSERT INTO system_settings (key, value, description) VALUES
('stl_interest_rate', '10', 'Short-term loan interest rate (%)'),
('ltl_interest_rate', '15', 'Long-term loan interest rate (%)'),
('max_loan_multiplier', '3', 'Maximum loan = savings × this value')
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE '✅ Seed Data Injected';
END $$;
