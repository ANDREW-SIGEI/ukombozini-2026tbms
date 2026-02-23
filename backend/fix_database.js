const db = require('./db');

console.log('🔧 Creating missing database tables...\n');

async function createMissingTables() {
    try {
        // 1. Create loan_matrices table
        console.log('📊 Creating loan_matrices table...');
        await db.queryStandalone(`
            CREATE TABLE IF NOT EXISTS loan_matrices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                loan_type TEXT NOT NULL,
                principal_amount REAL NOT NULL,
                interest_rate REAL NOT NULL,
                duration_months INTEGER NOT NULL,
                monthly_installment REAL NOT NULL,
                total_repayment REAL NOT NULL,
                interest_amount REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(loan_type, principal_amount)
            )
        `);
        console.log('   ✅ loan_matrices table created');

        // 2. Create guarantors table
        console.log('\n🤝 Creating guarantors table...');
        await db.queryStandalone(`
            CREATE TABLE IF NOT EXISTS guarantors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                loan_id INTEGER NOT NULL,
                guarantor_member_id INTEGER NOT NULL,
                guaranteed_amount REAL NOT NULL,
                status TEXT DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                released_at DATETIME,
                FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
                FOREIGN KEY (guarantor_member_id) REFERENCES members(id) ON DELETE RESTRICT
            )
        `);
        console.log('   ✅ guarantors table created');

        // 3. Populate loan matrices with standard values
        console.log('\n💰 Populating loan matrices...');

        const stlAmounts = [500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
        const ltlAmounts = [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000];

        const stlRate = 10; // 10% per year
        const ltlRate = 12; // 12% per year

        // Insert STL matrices (1-month loans)
        for (const amount of stlAmounts) {
            const interestAmount = amount * (stlRate / 100);
            const totalRepayment = amount + interestAmount;
            const monthlyInstallment = totalRepayment; // Single payment

            await db.queryStandalone(`
                INSERT OR IGNORE INTO loan_matrices 
                (loan_type, principal_amount, interest_rate, duration_months, monthly_installment, total_repayment, interest_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, ['STL', amount, stlRate, 1, monthlyInstallment, totalRepayment, interestAmount]);
        }
        console.log(`   ✅ Added ${stlAmounts.length} STL matrices`);

        // Insert LTL matrices (12-month loans)
        for (const amount of ltlAmounts) {
            const totalInterest = amount * (ltlRate / 100);
            const totalRepayment = amount + totalInterest;
            const monthlyInstallment = totalRepayment / 12;

            await db.queryStandalone(`
                INSERT OR IGNORE INTO loan_matrices 
                (loan_type, principal_amount, interest_rate, duration_months, monthly_installment, total_repayment, interest_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, ['LTL', amount, ltlRate, 12, monthlyInstallment, totalRepayment, totalInterest]);
        }
        console.log(`   ✅ Added ${ltlAmounts.length} LTL matrices`);

        // 4. Verify creation
        console.log('\n🔍 Verifying tables...');
        const matrixCount = await db.queryStandalone('SELECT COUNT(*) as count FROM loan_matrices');
        console.log(`   ✅ loan_matrices: ${matrixCount.rows[0].count} records`);

        const guarantorCount = await db.queryStandalone('SELECT COUNT(*) as count FROM guarantors');
        console.log(`   ✅ guarantors: ${guarantorCount.rows[0].count} records`);

        console.log('\n✨ All missing tables created successfully!');
        console.log('💡 Run: node validate_database.js to verify fixes\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ ERROR:', error);
        process.exit(1);
    }
}

createMissingTables();
