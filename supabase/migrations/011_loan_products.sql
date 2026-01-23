-- =====================================================
-- UKOMBOZI LOAN PRODUCTS SYSTEM
-- Standardized Loan Terms Matrix
-- =====================================================
-- Purpose: Create read-only reference table for approved loan products
-- Control: Only Admin/Director can modify
-- Usage: Field officers reference this for member advisory

-- Drop existing if recreating
DROP TABLE IF EXISTS loan_products CASCADE;

-- Create Loan Products Table
CREATE TABLE loan_products (
    id BIGSERIAL PRIMARY KEY,
    loan_amount DECIMAL(12,2) NOT NULL UNIQUE,
    monthly_installment DECIMAL(12,2) NOT NULL,
    principal_portion DECIMAL(12,2) NOT NULL,
    interest_portion DECIMAL(12,2) NOT NULL,
    shares_contribution DECIMAL(12,2) NOT NULL,
    repayment_period_months INTEGER NOT NULL,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Validation
    CONSTRAINT valid_installment CHECK (monthly_installment > 0),
    CONSTRAINT valid_principal CHECK (principal_portion > 0),
    CONSTRAINT valid_period CHECK (repayment_period_months BETWEEN 1 AND 36)
);

-- ADD COLUMNS TO LOAN APPLICATIONS TO STORE SELECTED MATRIX TERMS
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS monthly_installment NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS principal_portion NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS interest_portion NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS shares_contribution NUMERIC(15, 2);

-- Create Index for Fast Lookup
CREATE INDEX idx_loan_products_amount ON loan_products(loan_amount);
CREATE INDEX idx_loan_products_active ON loan_products(is_active) WHERE is_active = TRUE;

-- Insert Official UKOMBOZI Loan Products
INSERT INTO loan_products (loan_amount, monthly_installment, principal_portion, interest_portion, shares_contribution, repayment_period_months) VALUES
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
(1000000, 50000, 40000, 5000, 5000, 25);

-- Create View for Active Products Only
CREATE OR REPLACE VIEW active_loan_products AS
SELECT * FROM loan_products WHERE is_active = TRUE ORDER BY loan_amount;

-- RLS Policies
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;

-- Read Access: Everyone (for advisory)
CREATE POLICY "loan_products_read_all" ON loan_products
    FOR SELECT
    USING (is_active = TRUE);

-- Modify Access: Admin/Director Only
CREATE POLICY "loan_products_admin_modify" ON loan_products
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'director')
        )
    );

-- Helper Function: Get Loan Product by Amount
CREATE OR REPLACE FUNCTION get_loan_product(p_amount DECIMAL)
RETURNS TABLE (
    loan_amount DECIMAL,
    monthly_installment DECIMAL,
    principal_portion DECIMAL,
    interest_portion DECIMAL,
    shares_contribution DECIMAL,
    repayment_period_months INTEGER,
    total_repayable DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lp.loan_amount,
        lp.monthly_installment,
        lp.principal_portion,
        lp.interest_portion,
        lp.shares_contribution,
        lp.repayment_period_months,
        (lp.monthly_installment * lp.repayment_period_months) AS total_repayable
    FROM loan_products lp
    WHERE lp.loan_amount = p_amount
    AND lp.is_active = TRUE
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper Function: Find Closest Loan Product
CREATE OR REPLACE FUNCTION find_closest_loan_product(p_desired_amount DECIMAL)
RETURNS TABLE (
    loan_amount DECIMAL,
    monthly_installment DECIMAL,
    repayment_period_months INTEGER,
    total_repayable DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lp.loan_amount,
        lp.monthly_installment,
        lp.repayment_period_months,
        (lp.monthly_installment * lp.repayment_period_months) AS total_repayable
    FROM loan_products lp
    WHERE lp.is_active = TRUE
    ORDER BY ABS(lp.loan_amount - p_desired_amount)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE loan_products IS 'Official UKOMBOZI Loan Product Matrix - Standardized Terms';
COMMENT ON FUNCTION get_loan_product IS 'Fetch exact loan product by amount';
COMMENT ON FUNCTION find_closest_loan_product IS 'Find nearest loan product for advisory';
