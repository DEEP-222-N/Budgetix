import { createClient } from '@supabase/supabase-js';

// Using direct values for troubleshooting
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Initializing Supabase client');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
