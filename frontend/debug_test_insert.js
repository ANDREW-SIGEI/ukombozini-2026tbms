const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
    const testId = '00000000-0000-0000-0000-000000000000'; // Fake UUID
    console.log('Attempting to insert test profile...');
    const { data, error } = await supabase
        .from('profiles')
        .insert([
            { id: testId, full_name: 'Test User', role: 'member', email: 'test@example.com' }
        ]);

    if (error) {
        console.error('Insert Error:', error.message);
        console.log('HINT: RLS is likely blocking anonymous inserts.');
    } else {
        console.log('Insert Success!', data);
    }
}

testInsert();
