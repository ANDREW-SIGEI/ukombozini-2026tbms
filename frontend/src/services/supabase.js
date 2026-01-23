import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// Supabase configuration
const supabaseUrl = 'https://pnillbxpokzgaaibftwp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWxsYnhwb2t6Z2FhaWJmdHdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Njk3MjgsImV4cCI6MjA4NDE0NTcyOH0.vz4SbTWL5JD1TloLJXq6b_yXUyFqUJP6M6NiWRJajkM';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to handle Supabase errors
export const handleSupabaseError = (error) => {
    console.error('Supabase Error:', error);
    if (error.message) {
        throw new Error(error.message);
    }
    throw new Error('An unexpected error occurred');
};

export default supabase;
