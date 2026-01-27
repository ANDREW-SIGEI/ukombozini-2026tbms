const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSpecificUser() {
    const email = 'towetaron22@gmail.com';
    console.log(`Checking status for ${email}...`);

    // We can't check auth.users directly with anon key usually, 
    // but we can check the profiles table.
    const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email);

    if (profError) {
        console.error('Profile query error:', profError.message);
    } else {
        console.log('Profile found:', profile);
    }

    // Attempt a dummy login to see error code
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'WrongPassword123!'
    });

    if (error) {
        console.log('Auth check error code:', error.message);
        if (error.message.includes('Invalid login credentials')) {
            console.log('SUCCESS: The user EXISTS in the database (since it rejected the password instead of complaining about confirmation).');
        } else if (error.message.includes('Email not confirmed')) {
            console.log('PENDING: User exists but is UNCONFIRMED.');
        } else {
            console.log('NOT FOUND: User likely does not exist yet.');
        }
    }
}

checkSpecificUser();
