const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
    const email = 'andrewsigei684@gmail.com';
    const password = 'Teddymark1!';

    console.log(`Attempting signup for ${email}...`);
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: 'Andrew Sigei', role: 'officer' }
        }
    });

    if (error) {
        console.error('Signup Error:', error.message);
    } else {
        console.log('Signup Success!', data.user.id);
        console.log('User identities:', data.user.identities);
    }
}

testSignup();
