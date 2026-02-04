const db = require('../db');

console.log('Starting Export System Migration...');

db.serialize(() => {
    // 1. Create export_logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS export_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            member_id INTEGER,
            export_type TEXT NOT NULL, -- PDF, EXCEL
            date_range TEXT,
            status TEXT DEFAULT 'SUCCESS',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating export_logs:', err.message);
        else console.log('✅ export_logs table verified.');
    });

    // 2. Create member_ledger_view
    // This view unifies all cash-flow events for a member into a debit/credit format
    db.run(`DROP VIEW IF EXISTS member_ledger_view`, (err) => {
        db.run(`
            CREATE VIEW member_ledger_view AS
            -- Standard Savings Deposits
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Savings Deposit' as type,
                0 as debit,
                t.savings_amount as credit,
                COALESCE(t.description, 'Monthly Meeting Savings') as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.savings_amount > 0 AND t.transaction_type NOT IN ('ProjectSaving', 'education', 'agriculture')

            UNION ALL

            -- Education Project Savings
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Project (Education)' as type,
                0 as debit,
                t.savings_amount as credit,
                t.description as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.transaction_type IN ('ProjectSaving', 'education') AND t.description LIKE '%Education%'

            UNION ALL

            -- Agriculture Project Savings
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Project (Agriculture)' as type,
                0 as debit,
                t.savings_amount as credit,
                t.description as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.transaction_type IN ('ProjectSaving', 'agriculture') OR (t.transaction_type = 'ProjectSaving' AND t.description LIKE '%Agriculture%')

            UNION ALL

            -- Loan Repayment: Principal
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Loan Pay (Principal)' as type,
                0 as debit,
                (t.stl_repayment + t.ltl_repayment) as credit,
                'Principal Serving for Loan' as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE (t.stl_repayment + t.ltl_repayment) > 0

            UNION ALL

            -- Loan Repayment: Interest
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Loan Pay (Interest)' as type,
                0 as debit,
                t.loan_interest as credit,
                'Interest Serving' as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.loan_interest > 0

            UNION ALL

            -- Fine/Penalty Payment (Credit towards debt)
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Fine Payment' as type,
                0 as debit,
                t.fines as credit,
                'Penalty Clearance' as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.fines > 0 AND t.transaction_type = 'LoanRepayment'

            UNION ALL

            -- Fine/Penalty Charge (Debit - increase debt)
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Fine Charged' as type,
                t.fines as debit,
                0 as credit,
                COALESCE(t.description, 'Late Fee/Violation') as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.fines > 0 AND t.transaction_type IN ('Fine', 'penalty')

            UNION ALL

            -- Withdrawals
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Withdrawal' as type,
                t.withdrawals as debit,
                0 as credit,
                COALESCE(t.description, 'Savings Withdrawal') as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.withdrawals > 0 AND t.transaction_type NOT IN ('AssetFinancing', 'productfinancing')

            UNION ALL
            
            -- Asset Financing (Product)
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Asset Purchased' as type,
                t.withdrawals as debit,
                0 as credit,
                COALESCE(t.description, 'Project Asset Financing') as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.transaction_type IN ('AssetFinancing', 'productfinancing')

            UNION ALL

            -- Loan Disbursements
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Loan Issued' as type,
                t.loans_issued as debit,
                0 as credit,
                COALESCE(t.description, 'New Loan Disbursement') as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.loans_issued > 0

            UNION ALL

            -- Welfare Contributions
            SELECT 
                t.id, 
                t.memberId, 
                COALESCE(s.date, date(t.created_at)) as trans_date,
                'Welfare Fund' as type,
                0 as debit,
                t.welfare as credit,
                'Member Welfare Support' as description,
                t.created_at
            FROM transactions t
            LEFT JOIN meeting_sessions s ON t.sessionId = s.id
            WHERE t.welfare > 0
        `, (err) => {
            if (err) console.error('Error creating member_ledger_view:', err.message);
            else console.log('✅ member_ledger_view created successfully.');
        });
    });
});
