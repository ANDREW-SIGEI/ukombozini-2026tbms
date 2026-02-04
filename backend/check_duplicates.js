const axios = require('axios');
const fs = require('fs');

async function checkDirectories() {
    try {
        // Authenticate again to be sure (using same creds as before)
        const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'field@ukombozi.com',
            password: 'password123'
        });
        const token = loginRes.data.token;
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Check Members for Duplicates
        console.log("Checking Members...");
        const membersRes = await axios.get('http://localhost:5001/api/members', { headers });
        const members = membersRes.data;
        console.log(`Members Count: ${members.length}`);

        const mIds = members.map(m => m.id);
        const mDuplicates = mIds.filter((item, index) => mIds.indexOf(item) !== index);
        if (mDuplicates.length > 0) {
            console.error("❌ FOUND DUPLICATE MEMBER IDs:", mDuplicates);
        } else {
            console.log("✅ Members IDs Unique");
        }

        // 2. Check Groups for Duplicates
        console.log("Checking Groups...");
        const groupsRes = await axios.get('http://localhost:5001/api/groups', { headers });
        const groups = groupsRes.data;
        console.log(`Groups Count: ${groups.length}`);

        const gIds = groups.map(g => g.id);
        const gDuplicates = gIds.filter((item, index) => gIds.indexOf(item) !== index);
        if (gDuplicates.length > 0) {
            console.error("❌ FOUND DUPLICATE GROUP IDs:", gDuplicates);
        } else {
            console.log("✅ Groups IDs Unique");
        }
    } catch (err) {
        console.error("Error:", err.message);
        if (err.response) console.error(err.response.data);
    }
}

checkDirectories();
