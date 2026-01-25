const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    // Try a new user to avoid conflict state
    const email = 'admin.fix@ukombozi.co.ke';
    const password = 'Password123!';

    console.log(`Attempting to create user: ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'System Admin Fix',
                role: 'director',
                phone: '0700000000'
            }
        }
    });

    if (error) {
        console.error('Sign Up Error:', error.message);
        console.error('Details:', error);
    } else {
        console.log('Sign Up Successful:', data);
    }
}

createAdmin();
