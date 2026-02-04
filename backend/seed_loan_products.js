const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

const createTableSQL = `
CREATE TABLE IF NOT EXISTS loan_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    loan_amount REAL NOT NULL,
    monthly_installment REAL NOT NULL,
    repayment_period_months INTEGER NOT NULL,
    principal_portion REAL,
    interest_portion REAL NOT NULL,
    shares_contribution REAL NOT NULL,
    total_repayable REAL NOT NULL,
    interest_rate REAL NOT NULL,
    description TEXT,
    eligibility_criteria TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const products = [
    {
        name: 'Emergency Loan',
        code: 'EMG',
        loan_amount: 5000,
        monthly_installment: 1833,
        repayment_period_months: 3,
        principal_portion: 1666,
        interest_portion: 500,
        shares_contribution: 0,
        total_repayable: 5500,
        interest_rate: 10,
        description: 'Quick cash for urgent needs.',
        eligibility_criteria: 'Active member for 3 months.'
    },
    {
        name: 'School Fees Loan',
        code: 'SCH',
        loan_amount: 20000,
        monthly_installment: 3667,
        repayment_period_months: 6,
        principal_portion: 3333,
        interest_portion: 2000,
        shares_contribution: 200,
        total_repayable: 22200,
        interest_rate: 10,
        description: 'Support for education expenses.',
        eligibility_criteria: 'Active member, Guarantors required.'
    },
    {
        name: 'Development Loan',
        code: 'DEV',
        loan_amount: 50000,
        monthly_installment: 4583,
        repayment_period_months: 12,
        principal_portion: 4166,
        interest_portion: 5000,
        shares_contribution: 500,
        total_repayable: 55500,
        interest_rate: 10,
        description: 'Capital for business or projects.',
        eligibility_criteria: 'Active member for 6 months, Collateral required.'
    },
    {
        name: 'Normal Loan',
        code: 'NRM',
        loan_amount: 10000,
        monthly_installment: 2750,
        repayment_period_months: 4,
        principal_portion: 2500,
        interest_portion: 1000,
        shares_contribution: 100,
        total_repayable: 11100,
        interest_rate: 10,
        description: 'Standard personal loan.',
        eligibility_criteria: 'Active member.'
    }
];

db.serialize(() => {
    // 0. Drop Table
    db.run("DROP TABLE IF EXISTS loan_products", (err) => {
        if (err) console.error("Error dropping table:", err);
        else console.log("Dropped existing table.");

        // 1. Create Table
        db.run(createTableSQL, (err) => {
            if (err) {
                console.error("Error creating table:", err);
                return;
            }
            console.log("Table 'loan_products' created/verified.");

            // 2. Seed Data
            const stmt = db.prepare(`
                 INSERT INTO loan_products (
                     name, code, loan_amount, monthly_installment, repayment_period_months, 
                     principal_portion, interest_portion, shares_contribution, total_repayable, interest_rate,
                     description, eligibility_criteria
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             `);

            let count = 0;
            products.forEach(p => {
                stmt.run(
                    p.name, p.code, p.loan_amount, p.monthly_installment, p.repayment_period_months,
                    p.principal_portion, p.interest_portion, p.shares_contribution, p.total_repayable, p.interest_rate,
                    p.description, p.eligibility_criteria
                );
                count++;
            });

            stmt.finalize(() => {
                console.log(`Seeded ${count} loan products.`);
                db.close();
            });
        });
    });
});
