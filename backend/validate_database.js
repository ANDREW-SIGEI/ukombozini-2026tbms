const db = require('./db');

console.log('='.repeat(70));
console.log('🔍 UKOMBOZINI TBMS - DATABASE VALIDATION REPORT');
console.log('='.repeat(70));
console.log();

const validationResults = {
    matrices: { passed: 0, failed: 0, issues: [] },
    relationships: { passed: 0, failed: 0, issues: [] },
    mte: { passed: 0, failed: 0, issues: [] },
    integrity: { passed: 0, failed: 0, issues: [] }
};

// 1. LOAN MATRICES VALIDATION
async function validateLoanMatrices() {
    console.log('📊 1. LOAN MATRICES VALIDATION');
    console.log('-'.repeat(70));

    try {
        // Check if loan_matrices table exists
        const tableCheck = await db.queryStandalone(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='loan_matrices'`
        );

        if (tableCheck.rows.length === 0) {
            validationResults.matrices.failed++;
            validationResults.matrices.issues.push('❌ loan_matrices table does NOT exist');
            console.log('   ❌ CRITICAL: loan_matrices table not found!');
            return;
        }

        console.log('   ✅ loan_matrices table exists');
        validationResults.matrices.passed++;

        // Count total matrices
        const countResult = await db.queryStandalone('SELECT COUNT(*) as count FROM loan_matrices');
        const totalMatrices = countResult.rows[0].count;
        console.log(`   📋 Total matrices: ${totalMatrices}`);

        if (totalMatrices === 0) {
            validationResults.matrices.failed++;
            validationResults.matrices.issues.push('⚠️  No loan matrices found in database');
            console.log('   ⚠️  WARNING: No loan matrices found!');
        } else {
            validationResults.matrices.passed++;
        }

        // Check STL matrices
        const stlMatrices = await db.queryStandalone(
            'SELECT * FROM loan_matrices WHERE loan_type = ? ORDER BY principal_amount LIMIT 5',
            ['STL']
        );
        console.log(`   📌 STL matrices: ${stlMatrices.rows.length} found`);
        if (stlMatrices.rows.length > 0) {
            console.log('      Sample STL matrix:');
            const sample = stlMatrices.rows[0];
            console.log(`      - Principal: KES ${sample.principal_amount}`);
            console.log(`      - Interest Rate: ${sample.interest_rate}%`);
            console.log(`      - Monthly Installment: KES ${sample.monthly_installment}`);
            validationResults.matrices.passed++;
        } else {
            validationResults.matrices.failed++;
            validationResults.matrices.issues.push('❌ No STL matrices found');
        }

        // Check LTL matrices
        const ltlMatrices = await db.queryStandalone(
            'SELECT * FROM loan_matrices WHERE loan_type = ? ORDER BY principal_amount LIMIT 5',
            ['LTL']
        );
        console.log(`   📌 LTL matrices: ${ltlMatrices.rows.length} found`);
        if (ltlMatrices.rows.length > 0) {
            console.log('      Sample LTL matrix:');
            const sample = ltlMatrices.rows[0];
            console.log(`      - Principal: KES ${sample.principal_amount}`);
            console.log(`      - Interest Rate: ${sample.interest_rate}%`);
            console.log(`      - Monthly Installment: KES ${sample.monthly_installment}`);
            validationResults.matrices.passed++;
        } else {
            validationResults.matrices.failed++;
            validationResults.matrices.issues.push('❌ No LTL matrices found');
        }

    } catch (error) {
        validationResults.matrices.failed++;
        validationResults.matrices.issues.push(`❌ Error: ${error.message}`);
        console.log(`   ❌ ERROR: ${error.message}`);
    }

    console.log();
}

// 2. DATABASE RELATIONSHIPS VALIDATION
async function validateRelationships() {
    console.log('🔗 2. DATABASE RELATIONSHIPS VALIDATION');
    console.log('-'.repeat(70));

    try {
        // Check for orphaned loans (loans without valid members)
        const orphanedLoans = await db.queryStandalone(
            `SELECT COUNT(*) as count FROM loans WHERE member_id NOT IN (SELECT id FROM members)`
        );
        const orphanCount = orphanedLoans.rows[0].count;

        if (orphanCount === 0) {
            console.log('   ✅ No orphaned loans found');
            validationResults.relationships.passed++;
        } else {
            console.log(`   ❌ Found ${orphanCount} orphaned loans!`);
            validationResults.relationships.failed++;
            validationResults.relationships.issues.push(`❌ ${orphanCount} orphaned loans`);
        }

        // Check for orphaned transactions
        const orphanedTransactions = await db.queryStandalone(
            `SELECT COUNT(*) as count FROM transactions WHERE member_id NOT IN (SELECT id FROM members) AND member_id != 0`
        );
        const txOrphanCount = orphanedTransactions.rows[0].count;

        if (txOrphanCount === 0) {
            console.log('   ✅ No orphaned transactions found');
            validationResults.relationships.passed++;
        } else {
            console.log(`   ❌ Found ${txOrphanCount} orphaned transactions!`);
            validationResults.relationships.failed++;
            validationResults.relationships.issues.push(`❌ ${txOrphanCount} orphaned transactions`);
        }

        // Check for orphaned guarantors
        const orphanedGuarantors = await db.queryStandalone(
            `SELECT COUNT(*) as count FROM guarantors WHERE loan_id NOT IN (SELECT id FROM loans)`
        );
        const guarantorOrphanCount = orphanedGuarantors.rows[0].count;

        if (guarantorOrphanCount === 0) {
            console.log('   ✅ No orphaned guarantors found');
            validationResults.relationships.passed++;
        } else {
            console.log(`   ❌ Found ${guarantorOrphanCount} orphaned guarantors!`);
            validationResults.relationships.failed++;
            validationResults.relationships.issues.push(`❌ ${guarantorOrphanCount} orphaned guarantors`);
        }

        // Check members-groups relationship
        const orphanedMembers = await db.queryStandalone(
            `SELECT COUNT(*) as count FROM members WHERE group_id NOT IN (SELECT id FROM groups)`
        );
        const memberOrphanCount = orphanedMembers.rows[0].count;

        if (memberOrphanCount === 0) {
            console.log('   ✅ All members belong to valid groups');
            validationResults.relationships.passed++;
        } else {
            console.log(`   ❌ Found ${memberOrphanCount} members without valid groups!`);
            validationResults.relationships.failed++;
            validationResults.relationships.issues.push(`❌ ${memberOrphanCount} orphaned members`);
        }

    } catch (error) {
        validationResults.relationships.failed++;
        validationResults.relationships.issues.push(`❌ Error: ${error.message}`);
        console.log(`   ❌ ERROR: ${error.message}`);
    }

    console.log();
}

// 3. MTE TRIPLE-ENTRY LEDGER VALIDATION
async function validateMTE() {
    console.log('⚖️  3. MTE TRIPLE-ENTRY LEDGER VALIDATION');
    console.log('-'.repeat(70));

    try {
        // Check if transactions table exists
        const txTable = await db.queryStandalone(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'`
        );

        if (txTable.rows.length === 0) {
            console.log('   ❌ transactions table not found!');
            validationResults.mte.failed++;
            validationResults.mte.issues.push('❌ transactions table missing');
            return;
        }

        console.log('   ✅ transactions table exists');
        validationResults.mte.passed++;

        // Count total transactions
        const txCount = await db.queryStandalone('SELECT COUNT(*) as count FROM transactions');
        console.log(`   📊 Total transactions: ${txCount.rows[0].count}`);

        // Check for member balance consistency
        const balanceCheck = await db.queryStandalone(`
            SELECT 
                m.id,
                m.name,
                m.current_savings,
                COALESCE(SUM(CASE 
                    WHEN t.type = 'SAVINGS' THEN t.amount 
                    WHEN t.type = 'WITHDRAWAL' THEN -t.amount 
                    ELSE 0 
                END), 0) as calculated_savings
            FROM members m
            LEFT JOIN transactions t ON m.id = t.member_id
            GROUP BY m.id, m.name, m.current_savings
            HAVING ABS(m.current_savings - calculated_savings) > 0.01
            LIMIT 10
        `);

        if (balanceCheck.rows.length === 0) {
            console.log('   ✅ Member savings balances are consistent');
            validationResults.mte.passed++;
        } else {
            console.log(`   ⚠️  Found ${balanceCheck.rows.length} members with balance discrepancies`);
            balanceCheck.rows.forEach(row => {
                console.log(`      - ${row.name}: Stored=${row.current_savings}, Calculated=${row.calculated_savings}`);
            });
            validationResults.mte.failed++;
            validationResults.mte.issues.push(`⚠️  ${balanceCheck.rows.length} balance discrepancies`);
        }

        // Check transaction types distribution
        const typeDistribution = await db.queryStandalone(`
            SELECT type, COUNT(*) as count, SUM(amount) as total
            FROM transactions
            GROUP BY type
            ORDER BY count DESC
        `);

        console.log('   📈 Transaction type distribution:');
        typeDistribution.rows.forEach(row => {
            console.log(`      - ${row.type}: ${row.count} transactions, KES ${row.total.toLocaleString()}`);
        });
        validationResults.mte.passed++;

    } catch (error) {
        validationResults.mte.failed++;
        validationResults.mte.issues.push(`❌ Error: ${error.message}`);
        console.log(`   ❌ ERROR: ${error.message}`);
    }

    console.log();
}

// 4. DATA INTEGRITY CHECKS
async function validateDataIntegrity() {
    console.log('🛡️  4. DATA INTEGRITY VALIDATION');
    console.log('-'.repeat(70));

    try {
        // Check for negative balances (could be legitimate but worth flagging)
        const negativeBalances = await db.queryStandalone(`
            SELECT id, name, current_savings, active_loan_balance, penalties
            FROM members
            WHERE current_savings < 0 OR penalties < 0
            LIMIT 5
        `);

        if (negativeBalances.rows.length === 0) {
            console.log('   ✅ No negative savings or penalty balances');
            validationResults.integrity.passed++;
        } else {
            console.log(`   ⚠️  Found ${negativeBalances.rows.length} members with negative balances`);
            negativeBalances.rows.forEach(row => {
                console.log(`      - ${row.name}: Savings=${row.current_savings}, Penalties=${row.penalties}`);
            });
            validationResults.integrity.issues.push(`⚠️  ${negativeBalances.rows.length} negative balances`);
        }

        // Check for duplicate member names in same group
        const duplicates = await db.queryStandalone(`
            SELECT group_id, name, COUNT(*) as count
            FROM members
            GROUP BY group_id, name
            HAVING count > 1
        `);

        if (duplicates.rows.length === 0) {
            console.log('   ✅ No duplicate member names within groups');
            validationResults.integrity.passed++;
        } else {
            console.log(`   ⚠️  Found ${duplicates.rows.length} duplicate names`);
            duplicates.rows.forEach(row => {
                console.log(`      - Group ${row.group_id}: "${row.name}" appears ${row.count} times`);
            });
            validationResults.integrity.issues.push(`⚠️  ${duplicates.rows.length} duplicate names`);
        }

        // Check for loans with missing guarantors
        const loansWithoutGuarantors = await db.queryStandalone(`
            SELECT l.id, l.member_id, l.principal_amount, COUNT(g.id) as guarantor_count
            FROM loans l
            LEFT JOIN guarantors g ON l.id = g.loan_id
            WHERE l.loan_type IN ('STL', 'LTL')
            GROUP BY l.id, l.member_id, l.principal_amount
            HAVING guarantor_count < 2
            LIMIT 10
        `);

        if (loansWithoutGuarantors.rows.length === 0) {
            console.log('   ✅ All STL/LTL loans have sufficient guarantors');
            validationResults.integrity.passed++;
        } else {
            console.log(`   ⚠️  Found ${loansWithoutGuarantors.rows.length} loans with insufficient guarantors`);
            loansWithoutGuarantors.rows.forEach(row => {
                console.log(`      - Loan ID ${row.id}: ${row.guarantor_count} guarantors (needs 2)`);
            });
            validationResults.integrity.failed++;
            validationResults.integrity.issues.push(`❌ ${loansWithoutGuarantors.rows.length} loans missing guarantors`);
        }

        // Check group count
        const groupCount = await db.queryStandalone('SELECT COUNT(*) as count, SUM(member_count) as total_members FROM groups');
        const groups = groupCount.rows[0];
        console.log(`   📊 System overview: ${groups.count} groups, ${groups.total_members || 0} total members`);
        validationResults.integrity.passed++;

    } catch (error) {
        validationResults.integrity.failed++;
        validationResults.integrity.issues.push(`❌ Error: ${error.message}`);
        console.log(`   ❌ ERROR: ${error.message}`);
    }

    console.log();
}

// SUMMARY REPORT
function printSummary() {
    console.log('='.repeat(70));
    console.log('📋 VALIDATION SUMMARY');
    console.log('='.repeat(70));

    const categories = [
        { name: 'Loan Matrices', results: validationResults.matrices },
        { name: 'Relationships', results: validationResults.relationships },
        { name: 'MTE System', results: validationResults.mte },
        { name: 'Data Integrity', results: validationResults.integrity }
    ];

    let totalPassed = 0;
    let totalFailed = 0;

    categories.forEach(cat => {
        const status = cat.results.failed === 0 ? '✅' : '❌';
        console.log(`${status} ${cat.name}: ${cat.results.passed} passed, ${cat.results.failed} failed`);
        totalPassed += cat.results.passed;
        totalFailed += cat.results.failed;
    });

    console.log();
    console.log(`TOTAL: ${totalPassed} checks passed, ${totalFailed} checks failed`);
    console.log();

    // Print all issues
    if (totalFailed > 0) {
        console.log('🔴 ISSUES FOUND:');
        console.log('-'.repeat(70));
        categories.forEach(cat => {
            if (cat.results.issues.length > 0) {
                console.log(`\n${cat.name}:`);
                cat.results.issues.forEach(issue => console.log(`  ${issue}`));
            }
        });
    } else {
        console.log('🎉 ALL VALIDATION CHECKS PASSED! Database is healthy.');
    }

    console.log();
    console.log('='.repeat(70));

    return totalFailed === 0;
}

// RUN ALL VALIDATIONS
async function runValidation() {
    try {
        await validateLoanMatrices();
        await validateRelationships();
        await validateMTE();
        await validateDataIntegrity();

        const success = printSummary();

        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('💥 FATAL ERROR:', error);
        process.exit(1);
    }
}

runValidation();
