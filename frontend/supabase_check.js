
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function checkMembersData() {
    console.log('🕵️‍♀️ Checking Members Data in DB...');

    const { data, error } = await supabase
        .from('members')
        .select(`
        *,
        groups:group_id (group_name)
    `);

    if (error) {
        console.error('❌ SELECT FAILED:', error.message);
    } else {
        console.log(`✅ Found ${data.length} members.`);
        if (data.length > 0) {
            console.log('📝 First Member Record:', JSON.stringify(data[0], null, 2));
        }
    }
}

checkMembersData();
