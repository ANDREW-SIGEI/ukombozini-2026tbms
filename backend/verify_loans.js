const axios = require('axios');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://127.0.0.1:5000/api';
const JWT_SECRET = 'ukombozi-secret-key-2026';

async function verifyLoans() {
    try {
        console.log('🔄 1. Generating Auth Token (Bypassing Login)...');
        // Manually generate token for ID: 1 (Officer)
        const token = jwt.sign({ id: 1, role: 'Field Officer' }, JWT_SECRET, { expiresIn: '1h' });
        console.log('✅ Token Generated.');

        console.log('🔄 2. Fetching Loans...');
        const loansRes = await axios.get(`${BASE_URL}/loans`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const loans = loansRes.data;
        console.log(`✅ Found ${loans.length} loans.`);

        if (loans.length === 0) {
            console.warn('⚠️ No loans found to verify schedule against.');
            return;
        }

        const loanId = loans[0].id;
        console.log(`🔄 3. Fetching Schedule for Loan ID ${loanId}...`);

        try {
            const scheduleRes = await axios.get(`${BASE_URL}/loans/${loanId}/schedule`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Schedule received!');
            console.log(`📅 Schedule Entries: ${scheduleRes.data.length}`);
            if (scheduleRes.data.length > 0) {
                console.log('Sample Entry:', scheduleRes.data[0]);
            }
        } catch (scheduleErr) {
            console.error('❌ Failed to fetch schedule:', scheduleErr.response?.data || scheduleErr.message);
        }

    } catch (error) {
        console.error('❌ Verification Failed:', error.response?.data || error.message);
    }
}

verifyLoans();
