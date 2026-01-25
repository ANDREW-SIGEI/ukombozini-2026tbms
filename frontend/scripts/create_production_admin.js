const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createProductionAdmin() {
    const email = 'admin@ukombozi.co.ke';
    const password = 'Password123!';

    console.log(`Creating Official Admin: ${email}`);

    // Attempt Sign Up
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'System Admin',
                role: 'director',
                phone: '0712345678'
            }
        }
    });

    if (error) {
        console.error('❌ Failed:', error.message);
        // If user already exists, we might just be unable to login via script if email not confirmed, 
        // but for now let's hope the trigger fix allows the sign up or returns "already registered" cleanly.
    } else {
        if (data.user) {
            console.log('✅ Success! User ID:', data.user.id);
            console.log('You can now log in with the password: ' + password);
        } else {
            // Sometimes data.user is null if confirmation required, 
            // but our Supabase instance might have confirmation off or return the user anyway.
            console.log('✅ Action completed. Check dashboard if user is created.');
        }
    }
}

createProductionAdmin();
