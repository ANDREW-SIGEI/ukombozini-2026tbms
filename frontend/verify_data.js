
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

// Extract Project ID from URL
const projectId = url.split('//')[1].split('.')[0];

async function proveDataExists() {
    console.log('🔍 CONNECTED TO PROJECT ID:', projectId);
    console.log('   (Please ensure your Supabase Dashboard matches this ID)');
    console.log('---------------------------------------------------');

    // Check Groups
    const { data: groups, error: gError } = await supabase.from('groups').select('id, group_name');
    if (gError) console.log('❌ Error fetching groups:', gError.message);
    else {
        console.log(`✅ GROUPS FOUND (${groups.length}):`);
        groups.forEach(g => console.log(`   - [ID: ${g.id}] ${g.group_name}`));
    }

    console.log('---------------------------------------------------');

    // Check Members
    const { data: members, error: mError } = await supabase.from('members').select('id, full_name, group_id');
    if (mError) console.log('❌ Error fetching members:', mError.message);
    else {
        console.log(`✅ MEMBERS FOUND (${members.length}):`);
        members.forEach(m => console.log(`   - [ID: ${m.id}] ${m.full_name} (in Group ID: ${m.group_id})`));
    }
}

proveDataExists();
