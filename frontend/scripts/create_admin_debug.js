const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBareCreation() {
    const timestamp = Date.now();
    const email = `debug.${timestamp}@test.com`;
    const password = 'Password123!';

    console.log(`[TEST 1] Creating user with NO metadata: ${email}`);

    // Bare creation - triggers defaults (New User, member)
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });

    if (error) {
        console.error('[FAIL] Bare creation failed:', error.message);
        console.error('Details:', JSON.stringify(error, null, 2));
    } else {
        console.log('[SUCCESS] Bare creation succeeded:', data.user?.id);
    }
}

async function testMetadataCreation() {
    const timestamp = Date.now();
    const email = `debug.meta.${timestamp}@test.com`;
    const password = 'Password123!';
    const phone = `07${Math.floor(Math.random() * 100000000)}`

    console.log(`\n[TEST 2] Creating user with FULL metadata: ${email}`);

    // Full metadata creation
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Debug User',
                role: 'admin',
                phone: phone
            }
        }
    });

    if (error) {
        console.error('[FAIL] Metadata creation failed:', error.message);
        console.error('Details:', JSON.stringify(error, null, 2));
    } else {
        console.log('[SUCCESS] Metadata creation succeeded:', data.user?.id);
    }
}

async function runTests() {
    await testBareCreation();
    await testMetadataCreation();
}

runTests();
