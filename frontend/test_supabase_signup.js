const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
    console.log('Testing signup call...');
    try {
        const email = 'verify_test@ukombozi.co.ke';
        const { data, error } = await supabase.auth.signUp({
            email,
            password: 'TestPassword123!',
            options: {
                data: {
                    full_name: 'Test Runner',
                    role: 'officer'
                }
            }
        });

        if (error) {
            console.error('Signup API error:', error);
        } else {
            console.log('Signup API success:', data.user ? data.user.id : 'No user returned (maybe email confirmation required)');
        }
    } catch (err) {
        console.error('Signup exception:', err);
    }
}

testSignup();
