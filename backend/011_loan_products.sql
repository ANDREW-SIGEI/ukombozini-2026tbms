-- UKOMBOZI OFFICIAL LOAN PRODUCT MATRIX (18 Standardized Products)

-- Clear existing products to ensure clean matrix
DELETE FROM loan_products;

INSERT INTO loan_products (
    name, code, loan_amount, monthly_installment, principal_portion, 
    interest_portion, shares_contribution, repayment_period_months, is_active
) VALUES 
('Loan 5K', 'LP005', 5000, 500, 333, 67, 100, 15, 1),
('Loan 10K', 'LP010', 10000, 700, 500, 100, 100, 20, 1),
('Loan 15K', 'LP015', 15000, 1000, 750, 150, 100, 20, 1),
('Loan 20K', 'LP020', 20000, 1200, 833, 167, 200, 24, 1),
('Loan 30K', 'LP030', 30000, 1800, 1250, 250, 300, 24, 1),
('Loan 40K', 'LP040', 40000, 2400, 1667, 333, 400, 24, 1),
('Loan 50K', 'LP050', 50000, 3000, 2000, 500, 500, 25, 1),
('Loan 60K', 'LP060', 60000, 3600, 2400, 600, 600, 25, 1),
('Loan 70K', 'LP070', 70000, 4200, 2800, 700, 700, 25, 1),
('Loan 80K', 'LP080', 80000, 4800, 3200, 800, 800, 25, 1),
('Loan 90K', 'LP090', 90000, 5400, 3600, 900, 900, 25, 1),
('Loan 100K', 'LP100', 100000, 6000, 4000, 1000, 1000, 25, 1),
('Loan 150K', 'LP150', 150000, 9000, 6250, 1250, 1500, 24, 1),
('Loan 200K', 'LP200', 200000, 12000, 8333, 1667, 2000, 24, 1),
('Loan 250K', 'LP250', 250000, 15000, 10417, 2083, 2500, 24, 1),
('Loan 300K', 'LP300', 300000, 18000, 12500, 2500, 3000, 24, 1),
('Loan 400K', 'LP400', 400000, 24000, 16667, 3333, 4000, 24, 1),
('Loan 500K', 'LP500', 500000, 30000, 20833, 4167, 5000, 24, 1);
