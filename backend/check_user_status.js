const { createClient } = require('@supabase/supabase-js');

// Config from frontend/src/services/supabase.js
const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const email = 'admin@ukombozi.com';

const checkUser = async () => {
    console.log(`Checking status for ${email}...`);

    // We can't query auth.users with anon key, but we can try to sign in and catch the specific error
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'wrong-password' // Intentionally wrong to trigger specific errors
    });

    if (error) {
        console.log('--------------------------------------------------');
        console.log('Result:', error.message);

        if (error.message.includes('Email not confirmed')) {
            console.log('🛑 STATUS: ACCOUNT EXISTS BUT EMAIL NOT CONFIRMED');
            console.log('ACTION: Check your Gmail inbox for a link OR disable "Confirm email" in Supabase settings.');
        } else if (error.message.includes('Invalid login credentials')) {
            console.log('✅ STATUS: ACCOUNT EXISTS & READY (Wrong password confirmed it exists)');
        } else {
            console.log('❓ STATUS: UNKNOWN ERROR:', error.message);
        }
        console.log('--------------------------------------------------');
    } else {
        console.log('Wait... login worked? That shouldn\'t happen with a wrong password.');
    }
};

checkUser();
