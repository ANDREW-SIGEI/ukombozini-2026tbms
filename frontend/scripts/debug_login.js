const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLogin() {
    const email = 'andrewsigei684@gmail.com';
    const password = 'Teddymark1';

    console.log(`[DEBUG] Attempting login for: ${email}`);

    // 1. Try Login
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error('[FAIL] Login Failed!');
        console.error('Error Status:', error.status);
        console.error('Error Message:', error.message);
        console.error('Full Error:', JSON.stringify(error, null, 2));

        if (error.message.includes('Email not confirmed')) {
            console.log('\n>>> DIAGNOSIS: The user account is created but requires Email Confirmation.');
            console.log('>>> SOLUTION: Go to Supabase Dashboard -> Authentication -> Users, find the user, and click "Confirm" or disable "Confirm Email" in settings.');
        } else if (error.message.includes('Invalid login credentials')) {
            console.log('\n>>> DIAGNOSIS: Password mismatch or user does not exist.');
        }
    } else {
        console.log('[SUCCESS] Login Succeeded!');
        console.log('User ID:', data.user.id);

        // 2. Check Profile Access (RLS)
        console.log('\n[DEBUG] Checking Profile Access...');
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            console.error('[WARN] Logged in, but could not fetch Profile.');
            console.error('Profile Error:', profileError.message);
            console.log('>>> CAUSE: Trigger might have failed to create profile, or RLS is blocking access.');
        } else {
            console.log('[SUCCESS] Profile Found:', profile);
            console.log('Role:', profile.role);
            if (profile.role !== 'director' && profile.role !== 'admin') {
                console.log('>>> NOTE: User role is ' + profile.role + '. This might limit access.');
            }
        }
    }
}

debugLogin();
