const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
    const email = 'andrewsigei684@gmail.com';
    const password = 'Teddymark1!'; // The password we suggested

    console.log(`Attempting login for ${email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error('Login Error:', error.message);
        if (error.message.includes('Email not confirmed')) {
            console.log('HINT: User exists but email is not confirmed.');
        }
    } else {
        console.log('Login Success!', data.user.id);
        console.log('User metadata:', data.user.user_metadata);
    }
}

testLogin();
