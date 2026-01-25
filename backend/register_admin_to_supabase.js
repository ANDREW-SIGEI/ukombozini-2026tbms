const { createClient } = require('@supabase/supabase-js');

// Config from frontend/src/services/supabase.js
const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const email = 'andrewsigei684@gmail.com';
const password = 'Teddymark1';

const register = async () => {
    console.log(`🚀 Attempting to register ${email} in Supabase Auth...`);

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: 'System Admin',
                    role: 'Admin'
                }
            }
        });

        if (error) {
            console.error('❌ Registration Failed:', error.message);
            if (error.message.includes('User already registered')) {
                console.log('💡 Tip: Try logging in again. If you forgot the password, reset it in Supabase.');
            }
        } else {
            console.log('✅ Registration SUCCESS!');
            console.log('--------------------------------------------------');
            console.log('📧 IMPORTANT: If you have "Email Confirmation" enabled in Supabase,');
            console.log('   check your inbox for an activation link.');
            console.log('--------------------------------------------------');
            console.log('You can now log into the app.');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
};

register();
