const db = require('./db');
const bcrypt = require('bcryptjs');

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
const DECIMAL = isPostgres ? "DECIMAL(20,2)" : "REAL";

const init = async () => {
    try {
        console.log("Initializing Database...");

        // 1. GROUPS TABLE
        await run(`CREATE TABLE IF NOT EXISTS groups (
            id ${PK},
            name TEXT NOT NULL,
            location TEXT,
            meetingDay TEXT,
            chairperson TEXT,
            secretary TEXT,
            treasurer TEXT,
            status TEXT DEFAULT 'active' CHECK( status IN ('active', 'suspended', 'inactive') ),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration for existing groups table
        const columnsToAdd = [
            'chairperson', 'secretary', 'treasurer',
            'chairperson_id', 'secretary_id', 'treasurer_id',
            'registrationDate', 'meetingFrequency', 'dividendPolicy',
            'minMonthlySaving', 'loanMultiplier', 'stlInterestRate', 'ltlInterestRate',
            'financial_year', 'freeze_status', 'freeze_reason'
        ];
        for (const col of columnsToAdd) {
            try { await run(`ALTER TABLE groups ADD COLUMN ${col} TEXT`); } catch (e) { }
        }

        // 2. MEMBERS TABLE
        await run(`CREATE TABLE IF NOT EXISTS members (
            id ${PK},
            name TEXT NOT NULL,
            phone TEXT,
            group_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
            opening_balance_savings ${DECIMAL} DEFAULT 0,
            opening_balance_ltl ${DECIMAL} DEFAULT 0,
            opening_balance_stl ${DECIMAL} DEFAULT 0,
            opening_balance_set_by INTEGER,
            opening_balance_set_at TEXT,
            opening_balance_reason TEXT,
            opening_balance_locked INTEGER DEFAULT 0,
            current_savings ${DECIMAL} DEFAULT 0,
            active_loan_balance ${DECIMAL} DEFAULT 0,
            next_of_kin_name TEXT,
            next_of_kin_phone TEXT,
            next_of_kin_relationship TEXT,
            next_of_kin_member_id INTEGER -- Linked to existing member
        )`);

        // 3. LOANS TABLE
        await run(`CREATE TABLE IF NOT EXISTS loans (
            id ${PK},
            member_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            loan_type TEXT NOT NULL,
            principal_amount ${DECIMAL} NOT NULL,
            interest_rate ${DECIMAL} NOT NULL,
            issued_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            issued_by INTEGER,
            guarantor1_id INTEGER,
            guarantor2_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // 4. MEETING SESSIONS
        await run(`CREATE TABLE IF NOT EXISTS meeting_sessions (
            id ${PK},
            groupId INTEGER NOT NULL,
            officerId INTEGER NOT NULL,
            date TEXT NOT NULL,
            startTime TEXT,
            endTime TEXT,
            location TEXT,
            status TEXT DEFAULT 'ACTIVE',
            notes TEXT,
            meeting_type TEXT DEFAULT 'Regular',
            attendance_summary TEXT, -- JSON string
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // 5. GROUP OFFICIALS (Governance Term Tracking)
        await run(`CREATE TABLE IF NOT EXISTS group_officials (
            id ${PK},
            group_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            term_start TEXT NOT NULL,
            term_end TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id),
            FOREIGN KEY (member_id) REFERENCES members(id)
        )`);

        // 5. TRANSACTIONS
        await run(`CREATE TABLE IF NOT EXISTS transactions(
                                id ${PK},
                                sessionId INTEGER,
                                memberId INTEGER NOT NULL,
                                memberName TEXT,
                                attended INTEGER DEFAULT 1,
                                savings_amount ${DECIMAL} DEFAULT 0,
                                stl_repayment ${DECIMAL} DEFAULT 0,
                                ltl_repayment ${DECIMAL} DEFAULT 0,
                                loan_interest ${DECIMAL} DEFAULT 0,
                                welfare ${DECIMAL} DEFAULT 0,
                                fines ${DECIMAL} DEFAULT 0,
                                withdrawals ${DECIMAL} DEFAULT 0,
                                loans_issued ${DECIMAL} DEFAULT 0,
                                transaction_type TEXT,
                                description TEXT,
                                uploaded INTEGER DEFAULT 0,
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(sessionId) REFERENCES meeting_sessions(id),
                                FOREIGN KEY(memberId) REFERENCES members(id)
                            )`);

        try { await run(`ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'COMPLETED'`); } catch (e) { }

        // 6. DIVIDEND TABLES
        await run(`CREATE TABLE IF NOT EXISTS dividend_runs(
                                id ${PK},
                                financial_year INTEGER,
                                group_id INTEGER,
                                run_number TEXT,
                                banking_interest ${DECIMAL} DEFAULT 0,
                                stl_interest ${DECIMAL} DEFAULT 0,
                                ltl_interest ${DECIMAL} DEFAULT 0,
                                penalties ${DECIMAL} DEFAULT 0,
                                other_income ${DECIMAL} DEFAULT 0,
                                operating_expenses ${DECIMAL} DEFAULT 0,
                                mandatory_reserves ${DECIMAL} DEFAULT 0,
                                risk_buffer ${DECIMAL} DEFAULT 0,
                                reinvested_capital ${DECIMAL} DEFAULT 0,
                                profit_share_percentage ${DECIMAL} DEFAULT 75,
                                dividend_rate ${DECIMAL} DEFAULT 0,
                                allocable_profit ${DECIMAL} DEFAULT 0,
                                total_payout ${DECIMAL} DEFAULT 0,
                                status TEXT DEFAULT 'DRAFT',
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP
                            )`);

        await run(`CREATE TABLE IF NOT EXISTS dividend_allocations(
                                id ${PK},
                                dividend_run_id INTEGER,
                                member_id INTEGER,
                                average_shares ${DECIMAL},
                                gross_dividend ${DECIMAL},
                                arrears_offset ${DECIMAL},
                                net_dividend ${DECIMAL},
                                posted_to_savings INTEGER DEFAULT 0,
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(dividend_run_id) REFERENCES dividend_runs(id),
                                FOREIGN KEY(member_id) REFERENCES members(id)
                            )`);

        // 7. ADMIN & AUDIT
        await run(`CREATE TABLE IF NOT EXISTS audit_logs(
                                id ${PK},
                                action TEXT NOT NULL,
                                category TEXT NOT NULL,
                                details TEXT,
                                officer_id INTEGER,
                                officer_name TEXT,
                                ip_address TEXT,
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP
                            )`);

        await run(`CREATE TABLE IF NOT EXISTS settings(
                                key TEXT PRIMARY KEY,
                                value TEXT,
                                description TEXT,
                                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                            )`);

        // 7. LOAN PRODUCTS (Dropped and recreated for clean matrix)
        await run(`DROP TABLE IF EXISTS loan_products`);
        await run(`CREATE TABLE loan_products(
                                id ${PK},
                                name TEXT NOT NULL,
                                code TEXT UNIQUE,
                                loan_amount ${DECIMAL} NOT NULL,
                                monthly_installment ${DECIMAL} NOT NULL,
                                principal_portion ${DECIMAL} NOT NULL,
                                interest_portion ${DECIMAL} NOT NULL,
                                shares_contribution ${DECIMAL} NOT NULL,
                                repayment_period_months INTEGER NOT NULL,
                                is_active INTEGER DEFAULT 1,
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP
                            )`);

        // 7b. REPAYMENT SCHEDULE
        await run(`CREATE TABLE IF NOT EXISTS repayment_schedule (
            id ${PK},
            loan_id INTEGER NOT NULL,
            installment_number INTEGER NOT NULL,
            due_date TEXT NOT NULL,
            expected_installment ${DECIMAL} NOT NULL,
            expected_principal ${DECIMAL} NOT NULL,
            expected_interest ${DECIMAL} NOT NULL,
            expected_shares ${DECIMAL} NOT NULL,
            paid_amount ${DECIMAL} DEFAULT 0,
            actual_payment ${DECIMAL} DEFAULT 0,
            payment_date TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // 7c. LOAN PAYMENTS - Tracks individual payment transactions
        await run(`CREATE TABLE IF NOT EXISTS loan_payments (
            id ${PK},
            loan_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            session_id INTEGER,
            amount_paid ${DECIMAL} NOT NULL,
            principal_paid ${DECIMAL} DEFAULT 0,
            interest_paid ${DECIMAL} DEFAULT 0,
            payment_method TEXT DEFAULT 'cash',
            payment_ref TEXT UNIQUE,
            payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
            posted_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // 8. LOAN APPLICATIONS
        await run(`CREATE TABLE IF NOT EXISTS loan_applications(
                                id ${PK},
                                application_number TEXT UNIQUE,
                                member_id INTEGER NOT NULL,
                                group_id INTEGER NOT NULL,
                                loan_type TEXT NOT NULL,
                                amount_requested ${DECIMAL} NOT NULL,
                                duration_months INTEGER NOT NULL,
                                purpose TEXT,
                                status TEXT DEFAULT 'APPLIED',
                                monthly_installment ${DECIMAL},
                                interest_portion ${DECIMAL},
                                principal_portion ${DECIMAL},
                                shares_contribution ${DECIMAL},
                                officer_id INTEGER,
                                guarantor1_id INTEGER,
                                guarantor2_id INTEGER,
                                comments TEXT,
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP
                            )`);

        // 9. OFFICERS
        await run(`CREATE TABLE IF NOT EXISTS officers(
                                id ${PK},
                                name TEXT NOT NULL,
                                role TEXT NOT NULL,
                                phone TEXT,
                                email TEXT UNIQUE,
                                password_hash TEXT,
                                status TEXT DEFAULT 'active',
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP
                            )`);

        await run(`CREATE TABLE IF NOT EXISTS officer_groups(
                                officer_id INTEGER NOT NULL,
                                group_id INTEGER NOT NULL,
                                PRIMARY KEY(officer_id, group_id),
                                FOREIGN KEY(officer_id) REFERENCES officers(id) ON DELETE CASCADE,
                                FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
                            )`);

        // Migration for officers (freeze status)
        try { await run(`ALTER TABLE officers ADD COLUMN freeze_status TEXT DEFAULT 'unfrozen'`); } catch (e) { }
        try { await run(`ALTER TABLE officers ADD COLUMN freeze_reason TEXT`); } catch (e) { }

        // 10. SMS LOGS
        await run(`CREATE TABLE IF NOT EXISTS sms_logs(
                                id ${PK},
                                member_id INTEGER,
                                phone TEXT NOT NULL,
                                message TEXT NOT NULL,
                                type TEXT, --CONTRIBUTION, LOAN, ALERT
                                cost ${DECIMAL} DEFAULT 0,
                                status TEXT DEFAULT 'SENT', --SENT, DELIVERED, FAILED
                                error_message TEXT,
                                transaction_id INTEGER,
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP
                            )`);

        // 10b. AUDIT READ LOGS (Auditor Mode Traceability)
        await run(`CREATE TABLE IF NOT EXISTS audit_read_logs(
                                id ${PK},
                                user_id INTEGER,
                                officer_name TEXT,
                                module TEXT,
                                endpoint TEXT,
                                details TEXT,
                                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
                            )`);

        // 11. PROJECT SAVINGS MODULE
        await run(`CREATE TABLE IF NOT EXISTS project_registrations(
                                id ${PK},
                                member_id INTEGER NOT NULL,
                                project_type TEXT NOT NULL,
                                registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
                                fee_paid ${DECIMAL} DEFAULT 200,
                                year INTEGER NOT NULL,
                                FOREIGN KEY(member_id) REFERENCES members(id)
                            )`);

        await run(`CREATE TABLE IF NOT EXISTS project_savings(
                                id ${PK},
                                registration_id INTEGER NOT NULL,
                                amount ${DECIMAL} NOT NULL,
                                date TEXT NOT NULL,
                                status TEXT DEFAULT 'ACTIVE',
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                                payout_status TEXT DEFAULT 'PENDING',
                                FOREIGN KEY(registration_id) REFERENCES project_registrations(id)
                            )`);

        await run(`CREATE TABLE IF NOT EXISTS company_revenue(
                        id ${PK},
                        source TEXT NOT NULL,
                        amount ${DECIMAL} NOT NULL,
                        member_id INTEGER,
                        date TEXT DEFAULT CURRENT_TIMESTAMP,
                        description TEXT,
                        FOREIGN KEY(member_id) REFERENCES members(id)
                    )`);

        await run(`CREATE TABLE IF NOT EXISTS company_investments(
            id ${PK},
            group_id INTEGER,
            amount ${DECIMAL} NOT NULL,
            date TEXT DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            status TEXT DEFAULT 'ACTIVE',
            type TEXT DEFAULT 'TOPUP',
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )`);

        await run(`CREATE TABLE IF NOT EXISTS daily_cash_reports(
            id ${PK},
            officer_id INTEGER,
            group_id INTEGER,
            session_id INTEGER,
            report_date TEXT NOT NULL,
            morning_balance ${DECIMAL} DEFAULT 0,
            total_cash_in ${DECIMAL} DEFAULT 0,
            total_cash_out ${DECIMAL} DEFAULT 0,
            expected_closing_balance ${DECIMAL} DEFAULT 0,
            physical_cash_counted ${DECIMAL} DEFAULT 0,
            variance ${DECIMAL} DEFAULT 0,
            status TEXT DEFAULT 'draft',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(officer_id) REFERENCES officers(id),
            FOREIGN KEY(group_id) REFERENCES groups(id),
            FOREIGN KEY(session_id) REFERENCES meeting_sessions(id)
        )`);

        await run(`CREATE TABLE IF NOT EXISTS group_commitments(
            id ${PK},
            group_id INTEGER,
            amount ${DECIMAL} NOT NULL,
            date TEXT DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'LOCKED',
            notes TEXT,
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )`);

        // 12. FINANCIAL CONTROLS & AUDIT (Phase 2)
        await run(`CREATE TABLE IF NOT EXISTS system_settings(
            key TEXT PRIMARY KEY,
            value TEXT,
            category TEXT, --'SECURITY', 'FINANCIAL', 'SYSTEM'
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(`CREATE TABLE IF NOT EXISTS freeze_logs(
            id ${PK},
            scope TEXT NOT NULL,
            target_id INTEGER,
            action TEXT NOT NULL,
            reason TEXT,
            performed_by INTEGER,
            performed_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(performed_by) REFERENCES officers(id)
        )`);

        await run(`CREATE TABLE IF NOT EXISTS risk_scores(
            id ${PK},
            scope TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            metrics_snapshot TEXT,
            calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(`CREATE TABLE IF NOT EXISTS risk_alerts(
            id ${PK},
            scope TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            alert_type TEXT NOT NULL,
            severity TEXT DEFAULT 'MEDIUM',
            message TEXT NOT NULL,
            is_resolved INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(`CREATE TABLE IF NOT EXISTS reversal_requests(
            id ${PK},
            transaction_id INTEGER NOT NULL,
            requester_id INTEGER NOT NULL,
            approver_id INTEGER,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TEXT,
            FOREIGN KEY(transaction_id) REFERENCES transactions(id),
            FOREIGN KEY(requester_id) REFERENCES officers(id),
            FOREIGN KEY(approver_id) REFERENCES officers(id)
        )`);

        // 22. TOPUP REQUESTS (Admin Gatekeeper)
        await run(`CREATE TABLE IF NOT EXISTS topup_requests(
            id ${PK},
            group_id INTEGER NOT NULL,
            commitment_amount ${DECIMAL} NOT NULL,
            topup_amount ${DECIMAL} NOT NULL,
            status TEXT DEFAULT 'PENDING',
            requested_by INTEGER NOT NULL,
            approved_by INTEGER,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            approved_at TEXT,
            FOREIGN KEY(group_id) REFERENCES groups(id),
            FOREIGN KEY(requested_by) REFERENCES officers(id),
            FOREIGN KEY(approved_by) REFERENCES officers(id)
        )`);

        // Seed default system settings
        const settingsCount = await get("SELECT count(*) as count FROM system_settings");
        if (settingsCount.count === 0) {
            await run("INSERT INTO system_settings (key, value, category) VALUES (?, ?, ?)", ["system_freeze", "false", "SECURITY"]);
            await run("INSERT INTO system_settings (key, value, category) VALUES (?, ?, ?)", ["min_liquidity_threshold", "0", "FINANCIAL"]);
        }

        // SEEDING
        const groupCount = await get("SELECT count(*) as count FROM groups");
        if (groupCount.count === 0) {
            console.log("Seeding Groups...");
            await run("INSERT INTO groups (name, location, meetingDay) VALUES (?, ?, ?)", ["Victory Women", "Kibera", "Monday"]);
            await run("INSERT INTO groups (name, location, meetingDay) VALUES (?, ?, ?)", ["Ukombozi A", "Mathare", "Tuesday"]);
            await run("INSERT INTO groups (name, location, meetingDay) VALUES (?, ?, ?)", ["Ukombozi B", "Kawanagware", "Wednesday"]);
        }

        const memberCount = await get("SELECT count(*) as count FROM members");
        if (memberCount.count === 0) {
            console.log("Seeding Members...");
            const now = new Date().toISOString();
            await run("INSERT INTO members (name, phone, group_id, opening_balance_savings, current_savings) VALUES (?, ?, ?, ?, ?)", ["Alice", "0711", 1, 1000, 1000]);
            await run("INSERT INTO members (name, phone, group_id, current_savings) VALUES (?, ?, ?, ?)", ["Bob", "0722", 1, 500]);
        }

        const officerCount = await get("SELECT count(*) as count FROM officers");
        if (officerCount.count === 0) {
            console.log("Seeding Officers...");
            const adminPass = await bcrypt.hash('Teddymark1', 10);
            const directorPass = await bcrypt.hash('Teddymark11$', 10);
            const staffPass = await bcrypt.hash('123456', 10);

            await run("INSERT INTO officers (name, role, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)", ["System Admin", "Admin", "0700", "andrewsigei684@gmail.com", adminPass]);
            await run("INSERT INTO officers (name, role, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)", ["Andrew Sigei", "Director", "0711", "andrewsigei6@gmail.com", directorPass]);
            await run("INSERT INTO officers (name, role, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)", ["Sarah", "Field Officer", "0722", "sarah@tbms.com", staffPass]);

            await run("INSERT INTO officer_groups (officer_id, group_id) VALUES (1, 2), (2, 2)");
        }

        const officialCount = await get("SELECT count(*) as count FROM group_officials");
        if (officialCount.count === 0) {
            console.log("Seeding Group Officials...");
            // Alice (ID 1) is Treasurer for Group 1
            await run("INSERT INTO group_officials (group_id, member_id, role, term_start, term_end, status) VALUES (?, ?, ?, ?, ?, ?)",
                [1, 1, 'Treasurer', '2025-01-01', '2027-12-31', 'active']);
            // Also seed a Chairman and Secretary for a valid term
            await run("INSERT INTO group_officials (group_id, member_id, role, term_start, term_end, status) VALUES (?, ?, ?, ?, ?, ?)",
                [1, 2, 'Chairman', '2025-01-01', '2027-12-31', 'active']);
        }

        console.log("Database initialized successfully.");
    } catch (err) {
        console.error("Initialization failed:", err);
    } finally {
        // Do not close DB here if we want to continue using it in other scripts, 
        // but for init-db standalone, we exit.
        process.exit();
    }
};

init();
