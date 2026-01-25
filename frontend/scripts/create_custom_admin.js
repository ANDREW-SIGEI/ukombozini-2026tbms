const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createCustomAdmin() {
    const email = 'andrewsigei684@gmail.com';
    const password = 'Teddymark1';

    console.log(`Creating Requested Admin: ${email}`);

    // Attempt Sign Up
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Andrew Sigei',
                role: 'director', // Setting as director for full admin access
                phone: '0700000000' // Placeholder, user can update later
            }
        }
    });

    if (error) {
        console.error('❌ Failed:', error.message);
    } else {
        if (data.user) {
            console.log('✅ Success! User ID:', data.user.id);
            console.log('Account created successfully.');
        } else {
            console.log('✅ Action completed. Please check if confirmation email was sent or user appears in dashboard.');
        }
    }
}

createCustomAdmin();
