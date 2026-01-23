
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function checkProfiles() {
    console.log('🕵️‍♀️ Checking for Officers/Profiles...');

    const { data: profiles, error } = await supabase.from('profiles').select('*');

    if (error) {
        console.error('❌ SELECT FAILED:', error.message);
    } else {
        console.log(`✅ Found ${profiles.length} profiles.`);
        if (profiles.length === 0) {
            console.log('⚠️ No profiles found! We need to create users before we can assign them.');
        } else {
            profiles.forEach(p => console.log(`   - [${p.role}] ${p.full_name} (${p.email}) ID: ${p.id}`));
        }
    }
}

checkProfiles();
