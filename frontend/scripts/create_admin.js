const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    const email = 'admin@ukombozi.co.ke';
    const password = 'Password123!';

    console.log(`Attempting to create user: ${email}`);

    // 1. Check if user already exists (Sign In)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (signInData.user) {
        console.log('User already exists and login successful:', signInData.user.id);
        // Ensure profile exists
        await ensureProfile(signInData.user.id);
        return;
    }

    // 2. Sign Up if login failed
    console.log('User login failed, attempting Sign Up...');
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'System Admin',
                role: 'director' // Important for RLS
            }
        }
    });

    if (error) {
        console.error('Sign Up Error:', error.message);
    } else {
        console.log('Sign Up Successful:', data);
        if (data.user) {
            console.log('User ID:', data.user.id);
            // Ensure profile exists (trigger might have done it, but double check)
            await ensureProfile(data.user.id);
        }
    }
}

async function ensureProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !data) {
        console.log('Profile missing, creating...');
        const { error: insertError } = await supabase
            .from('profiles')
            .insert([{
                id: userId,
                full_name: 'System Admin',
                role: 'director',
                email: 'admin@ukombozi.co.ke',
                active: true
            }]);
        if (insertError) console.error('Profile creation error:', insertError);
        else console.log('Profile created manually.');
    } else {
        console.log('Profile exists.');
    }
}

createAdmin();
