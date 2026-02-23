const axios = require('axios');
const API_URL = 'http://127.0.0.1:5000/api';

async function verifyLockdown() {
    console.log("🚀 Starting Guarantor Lockdown Verification...");

    try {
        // 1. Login to get token
        console.log("Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'verify@admin.com',
            password: 'Verify123!'
        });
        const token = loginRes.data.token;
        const authHeader = { Authorization: `Bearer ${token}` };
        console.log("✅ Authenticated successfully.");

        // 2. Get some members
        const membersRes = await axios.get(`${API_URL}/members`, { headers: authHeader });
        const members = membersRes.data;
        if (members.length < 3) {
            console.error("❌ Not enough members for testing.");
            return;
        }

        const applicant = members[0];
        const nonCompliantGuarantor = members[1];
        const groupId = applicant.group_id;

        console.log(`Testing with Applicant: ${applicant.name} (ID: ${applicant.id})`);
        console.log(`Testing with Non-Compliant Guarantor: ${nonCompliantGuarantor.name} (ID: ${nonCompliantGuarantor.id})`);

        // 3. Check eligibility with the non-compliant guarantor
        console.log("Checking eligibility...");
        const response = await axios.post(`${API_URL}/loans/check-eligibility`, {
            memberId: applicant.id,
            groupId: groupId,
            requestedAmount: 5000,
            loanType: 'Long-Term Loan (LTL)',
            duration: 12,
            guarantor1_id: nonCompliantGuarantor.id,
            guarantor2_id: members[2].id
        }, { headers: authHeader });

        console.log("Eligibility Response:", JSON.stringify(response.data, null, 2));

        if (response.data.lockdown) {
            console.log("✅ SUCCESS: Lockdown correctly triggered!");
            console.log(`Reason: ${response.data.reason}`);
        } else {
            console.log("❌ FAILURE: Lockdown was NOT triggered but should have been (assuming no contributions yet).");
        }

    } catch (error) {
        console.error("❌ verification failed:", error.response?.data || error.message);
    }
}

verifyLockdown();
