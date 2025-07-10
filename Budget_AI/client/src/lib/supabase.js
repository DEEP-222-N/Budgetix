import { createClient } from '@supabase/supabase-js';

// Using direct values for troubleshooting
const supabaseUrl = 'https://agchhwydoccsdnwuqwtq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnY2hod3lkb2Njc2Rud3Vxd3RxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDIyMzk2NCwiZXhwIjoyMDU5Nzk5OTY0fQ.nCLX75cAcCfz-VhD1P5R2nzOBjiMusHDbrOYV5zg-c0';

console.log('Supabase URL:', supabaseUrl);
console.log('Initializing Supabase client');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
