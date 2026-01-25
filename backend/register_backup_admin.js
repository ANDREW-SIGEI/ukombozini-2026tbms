const { createClient } = require('@supabase/supabase-js');

// Config
const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const email = 'admin@ukombozi.com';
const password = 'Teddymark1';

const register = async () => {
    console.log(`🚀 Creating Backup Admin: ${email}...`);

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: 'Emergency Admin',
                    role: 'Admin'
                }
            }
        });

        if (error) {
            console.error('❌ Failed:', error.message);
        } else {
            console.log('✅ BACKUP ADMIN CREATED SUCCESSFULY!');
            console.log('User:', email);
            console.log('Pass:', password);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
};

register();
