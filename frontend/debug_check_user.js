const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUser() {
    console.log('Checking profiles for andrewsigei684@gmail.com...');
    // We try to query by email in the profiles table
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'andrewsigei684@gmail.com');

    if (error) {
        console.error('Error querying profiles:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('User profile found:', data[0]);
    } else {
        console.log('No profile found for this email. Checking if ANY profiles exist...');
        const { data: allData, error: allErr } = await supabase
            .from('profiles')
            .select('*')
            .limit(5);

        if (allErr) {
            console.error('Error fetching any profiles:', allErr);
        } else {
            console.log('Found these profiles:', allData);
        }
    }
}

checkUser();
