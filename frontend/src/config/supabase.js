import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase URL and anon key
// These should ideally come from environment variables in production
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Export auth functions for easy access
export const auth = supabase.auth;
export const storage = supabase.storage;
export const from = supabase.from;
