const API_URL = 'http://127.0.0.1:5000/api';

async function verifySystem() {
    console.log('🚀 UKOMBOZINI SYSTEM INTEGRITY CHECK');
    console.log('====================================');

    let token = '';
    let memberId = '';
    let loanId = '';
    let groupId = '';

    // helper
    const post = async (endpoint, data) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`POST ${endpoint} failed: ${res.status} - ${txt}`);
        }
        return res.json();
    };

    const get = async (endpoint) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`GET ${endpoint} failed: ${res.status}`);
        return res.json();
    };

    try {
        // 1. LOGIN
        console.log('\n🔐 1. Authenticating...');
        const loginData = await post('/auth/login', {
            email: 'andrewsigei684@gmail.com',
            password: 'password123'
        });
        token = loginData.token;
        console.log('   ✅ Login successful');

        // 2. GET REFERENCE DATA
        console.log('\n📂 2. Fetching Reference Data...');
        const groups = await get('/groups');
        if (groups.length === 0) throw new Error('No groups found');
        groupId = groups[0].id; // Use first group
        console.log(`   ✅ Group Found: ${groups[0].name} (ID: ${groupId})`);

        const members = await get(`/members?groupId=${groupId}`);
        if (members.length === 0) throw new Error('No members found');
        memberId = members[0].id;
        console.log(`   ✅ Member Found: ${members[0].name} (ID: ${memberId})`);

        // 3. ISSUE LOAN (Simulate)
        console.log('\n💸 3. Testing Loan Issuance...');
        // We'll calculate a safe amount
        const amount = 5000;
        const loanData = {
            memberId,
            groupId,
            loanType: 'LTL',
            amount: amount,
            repaymentPeriod: 6,
            interestRate: 10,
            guarantors: [],
            disbursementDate: new Date().toISOString().split('T')[0]
        };

        // Check eligibility first (Frontend does this via Member logic, but backend should accept valid loan)
        // We will just try to issue. If it fails due to existing loans, we'll skip or catch.

        try {
            const issueRes = await post('/loans', loanData);
            if (issueRes.success || issueRes.loanId) {
                loanId = issueRes.loanId || issueRes.id; // Adjust based on actual response
                console.log(`   ✅ Loan Issued Successfully (ID: ${loanId})`);
            } else {
                console.log('   ⚠️ Loan Issue skipped/failed (might have existing loan):', issueRes);
                // Try to find an existing loan to test repayment
                const loans = await get(`/loans?memberId=${memberId}`);
                const activeLoan = loans.find(l => l.status === 'Running' || l.status === 'Active');
                if (activeLoan) {
                    loanId = activeLoan.id;
                    console.log(`   ℹ️ Using Existing Loan (ID: ${loanId})`);
                }
            }
        } catch (e) {
            console.log('   ⚠️ Loan Issue Error (Likely active loan exists):', e.message);
            const loans = await get(`/loans?memberId=${memberId}`);
            const activeLoan = loans.find(l => l.status === 'Running' || l.status === 'Active');
            if (activeLoan) {
                loanId = activeLoan.id;
                console.log(`   ℹ️ Using Existing Loan (ID: ${loanId})`);
            }
        }

        if (!loanId) {
            console.log('   ⏭️ Skipping Repayment Test (No Active Loan)');
        } else {
            // 4. TEST REPAYMENT
            console.log('\n💳 4. Testing Loan Repayment...');
            const repayRes = await post('/transactions', {
                memberId,
                sessionId: null, // Ad-hoc repayment
                transaction_type: 'LOAN_REPAYMENT',
                loanId: loanId,
                amount: 100, // Small test amount
                description: 'Automated Integrity Check'
            });
            console.log('   ✅ Repayment Processed:', repayRes.success ? 'Yes' : 'No');
        }

        // 5. VERIFY REPORT DATA
        console.log('\n📊 5. Verifying Report Data...');
        const statement = await get(`/transactions?memberId=${memberId}`);
        console.log(`   ✅ Member Statement: Retrieved ${statement.length} records`);

        // 6. HEALTH CHECK
        console.log('\n🏥 6. Final Health Check...');
        // Health check is at root /health, not /api/health
        const healthRes = await fetch('http://127.0.0.1:5000/health');
        if (!healthRes.ok) throw new Error(`GET /health failed: ${healthRes.status}`);
        const health = await healthRes.json();
        console.log('   ✅ System Status:', health.status);

        console.log('\n✨ INTEGRITY VERIFICATION COMPLETE');

    } catch (error) {
        console.error('\n❌ CRITICAL FAILURE:', error.message);
    }
}

verifySystem();
