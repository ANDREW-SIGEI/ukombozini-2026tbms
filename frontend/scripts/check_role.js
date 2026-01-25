const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRole() {
    console.log('Checking role for andrewsigei684@gmail.com...');

    // 1. Get User ID (we can't query auth.users directly with anon key usually, but let's try direct profile query by email if enabled?)
    // Actually we can't query profiles by email if RLS is strict (read own data only).
    // So we must login first.

    const { data: { user }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'andrewsigei684@gmail.com',
        password: 'Teddymark1'
    });

    if (loginError) {
        console.error('Login Failed:', loginError.message);
        return;
    }

    // 2. Fetch Profile
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Fetch Profile Error:', error.message);
    } else {
        console.log('------------------------------------------------');
        console.log('User ID:', profile.id);
        console.log('Role:', profile.role);
        console.log('Full Name:', profile.full_name);
        console.log('------------------------------------------------');
    }
}

checkRole();
