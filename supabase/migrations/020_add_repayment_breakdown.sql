-- Add breakdown columns to transactions table for detailed repayment tracking
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS principal_paid NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_paid NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalty_paid NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_balance NUMERIC(15, 2);

COMMENT ON COLUMN transactions.principal_paid IS 'Portion of amount allocated to Principal';
COMMENT ON COLUMN transactions.interest_paid IS 'Portion of amount allocated to Interest';
COMMENT ON COLUMN transactions.penalty_paid IS 'Portion of amount allocated to Penalties';
