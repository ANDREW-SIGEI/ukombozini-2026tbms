const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testMemberRegistration() {
    try {
        // 1. Get a group
        const groupsRes = await axios.get(`${API_URL}/groups`);
        if (groupsRes.data.length === 0) {
            console.error('No groups found. Create a group first.');
            return;
        }
        const groupId = groupsRes.data[0].id;
        console.log(`Using Group ID: ${groupId} (${groupsRes.data[0].name})`);

        // 2. Register a new member
        const timestamp = Date.now();
        const memberData = {
            full_name: `Test Member ${timestamp}`,
            phone: `07${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
            groupId: groupId,
            opening_balance_savings: 1000,
            opening_balance_reason: 'Test Migration',
            next_of_kin_name: 'Jane Doe',
            next_of_kin_phone: '0711111111',
            next_of_kin_relationship: 'Spouse'
        };

        console.log('Registering member:', memberData);
        const registerRes = await axios.post(`${API_URL}/members`, memberData);
        console.log('Registration Success:', registerRes.data);

        // 3. Verify member exists
        const memberId = registerRes.data.id;
        const getRes = await axios.get(`${API_URL}/members`);
        const found = getRes.data.find(m => m.id === memberId);
        if (found) {
            console.log('Verification Success: Member found in list.');
        } else {
            console.error('Verification Failed: Member not found in list.');
        }

    } catch (error) {
        console.error('Test Failed:', error.response?.data || error.message);
    }
}

testMemberRegistration();
