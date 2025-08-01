require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Anon Key in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  try {
    console.log('Listing tables in the database...');
    
    // Get tables from information_schema
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (error) {
      console.error('Error listing tables:', error);
      return;
    }
    
    if (!tables || tables.length === 0) {
      console.log('No tables found in the public schema.');
      console.log('Creating necessary tables...');
      await createTables();
      return;
    }
    
    console.log('Tables in database:');
    tables.forEach(table => console.log(`- ${table.table_name}`));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function createTables() {
  try {
    console.log('Creating tables...');
    
    // Create users table
    const { error: usersError } = await supabase.rpc('create_users_table');
    if (usersError) console.error('Error creating users table:', usersError);
    
    // Create financial_overview table
    const { error: financeError } = await supabase.rpc('create_financial_overview_table');
    if (financeError) console.error('Error creating financial_overview table:', financeError);
    
    // Create budget_suggestions table
    const { error: suggestionsError } = await supabase.rpc('create_budget_suggestions_table');
    if (suggestionsError) console.error('Error creating budget_suggestions table:', suggestionsError);
    
    console.log('Tables created successfully');
    await listTables();
    
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

// Execute the check
listTables();
