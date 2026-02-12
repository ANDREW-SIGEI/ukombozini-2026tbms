
const axios = require('axios');

const API_URL = 'http://127.0.0.1:5000/api';

async function check() {
    try {
        console.log("Checking Groups...");
        const groupsRes = await axios.get(`${API_URL}/groups`);
        const groups = groupsRes.data;
        const kapkores = groups.find(g => (g.group_name || g.name || '').toUpperCase().includes('KAPKORES'));

        if (kapkores) {
            console.log("Found KAPKORES:", kapkores);
        } else {
            console.log("KAPKORES group NOT found in database.");
        }

        console.log("\nChecking Meeting Sessions...");
        const sessionsRes = await axios.get(`${API_URL}/sessions`);
        const sessions = sessionsRes.data;
        const activeSessions = sessions.filter(s => s.status === 'ACTIVE' || s.status === 'OPEN');

        console.log(`Found ${activeSessions.length} active sessions.`);
        activeSessions.forEach(s => {
            const group = groups.find(g => g.id === (s.group_id || s.groupId));
            console.log(`- Session ${s.session_number || s.sessionNumber}: Group ${group ? (group.group_name || group.name) : 'UNKNOWN'} (ID: ${s.group_id || s.groupId})`);
        });

    } catch (err) {
        console.error("Check failed:", err.message);
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        }
    }
}

check();
