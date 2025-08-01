require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Anon Key in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  try {
    console.log('Checking database connection...');
    
    // Test connection by listing tables
    const { data: tables, error } = await supabase
      .rpc('get_tables');
    
    if (error) {
      console.error('Error listing tables:', error);
      
      // Try to create the RPC function if it doesn't exist
      console.log('Creating get_tables function...');
      const { error: createFnError } = await supabase.rpc('create_get_tables_function');
      
      if (createFnError) {
        console.error('Error creating get_tables function:', createFnError);
        await createGetTablesFunction();
      }
      
      return;
    }
    
    console.log('Tables in database:');
    console.log(tables);
    
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

async function createGetTablesFunction() {
  try {
    console.log('Creating get_tables function...');
    const { data, error } = await supabase.rpc('create_get_tables_function');
    
    if (error) {
      console.error('Error creating function:', error);
      return;
    }
    
    console.log('Function created successfully');
    await checkDatabase();
  } catch (error) {
    console.error('Error in createGetTablesFunction:', error);
  }
}

// Execute the check
checkDatabase();
