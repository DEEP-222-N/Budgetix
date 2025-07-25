const express = require('express');
const router = express.Router();
const AIService = require('../services/aiService');
const { createClient } = require('@supabase/supabase-js');

// Debug log environment variables
console.log('Environment variables loaded:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

// Test Supabase connection
async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('Supabase connection test successful');
    return true;
  } catch (err) {
    console.error('Exception when testing Supabase connection:', err);
    return false;
  }
}

// Run the connection test when server starts
testSupabaseConnection();

const aiService = new AIService();

// Helper function to get category column name
const getCategoryColumnName = (categoryName) => {
  const mapping = {
    'Food': 'food',
    'Transportation and Fuel': 'transportation_and_fuel',
    'Entertainment': 'entertainment',
    'Housing': 'housing',
    'Utilities': 'utilities',
    'Grocery': 'grocery',
    'Healthcare': 'healthcare',
    'Education': 'education',
    'Shopping': 'shopping',
    'Personal Care': 'personal_care',
    'Travel': 'travel',
    'Other': 'other'
  };
  return mapping[categoryName] || categoryName.toLowerCase().replace(/ /g, '_');
};

// Test endpoint to verify Supabase connection
router.get('/test-connection', async (req, res) => {
  try {
    const isConnected = await testSupabaseConnection();
    if (isConnected) {
      res.json({ success: true, message: 'Successfully connected to Supabase' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to connect to Supabase' });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process AI prompt for budget updates
router.post('/process-prompt', async (req, res) => {
  console.log('AI process-prompt endpoint hit');
  console.log('Request body:', req.body);
  
  try {
    const { prompt, userId } = req.body;

    if (!prompt || !userId) {
      console.log('Missing required fields:', { prompt: !!prompt, userId: !!userId });
      return res.status(400).json({ 
        error: 'Prompt and userId are required' 
      });
    }
    
    console.log('Processing AI prompt:', prompt, 'for user:', userId);

    // Get current month's budget data using the new monthly budget system
    const { data: currentBudget, error: budgetError } = await supabase
      .rpc('get_or_create_monthly_budget', { p_user_id: userId });

    if (budgetError && budgetError.code !== 'PGRST116') {
      console.error('Error fetching budget:', budgetError);
      return res.status(500).json({ 
        error: 'Failed to fetch current budget data' 
      });
    }

    // Process the prompt with AI
    const aiResponse = await aiService.processBudgetPrompt(prompt, currentBudget);

    // Handle different actions
    if (aiResponse.action === 'update_budget') {
      await handleBudgetUpdate(userId, aiResponse.changes);
    } else if (aiResponse.action === 'add_expense') {
      await handleExpenseAddition(userId, aiResponse.expenses);
    }

    res.json({
      success: true,
      action: aiResponse.action,
      message: aiResponse.message,
      changes: aiResponse.changes,
      expenses: aiResponse.expenses
    });

  } catch (error) {
    console.error('AI Prompt Processing Error:', error);
    res.status(500).json({ 
      error: 'Failed to process AI prompt',
      details: error.message 
    });
  }
});

// Handle budget updates
async function handleBudgetUpdate(userId, changes) {
  try {
    const budgetData = { user_id: userId };

    // Handle monthly budget total
    if (changes.monthly_budget_total !== null) {
      budgetData.monthly_budget_total = changes.monthly_budget_total;
    }

    // Handle category budgets
    if (changes.categories) {
      Object.entries(changes.categories).forEach(([category, amount]) => {
        if (amount !== null) {
          const columnName = getCategoryColumnName(category);
          budgetData[columnName] = amount;
        }
      });
    }
    const { error } = await supabase
      .from('budgets')
      .upsert(budgetData);
    
    if (error) {
      console.error('Monthly budget update error:', error);
      throw error;
    }
    
    console.log('Monthly budget updated successfully');
    return { success: true };
    
  } catch (error) {
    console.error('Error in handleBudgetUpdate:', error);
    throw error;
  }
};

// Handle expense additions
async function handleExpenseAddition(userId, expenses) {
  try {
    const expenseData = expenses.map(expense => ({
      user_id: userId,
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: new Date().toISOString().split('T')[0], // Today's date
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('expenses')
      .insert(expenseData);

    if (error) {
      throw error;
    }

    console.log('Expenses added successfully:', expenseData);
  } catch (error) {
    console.error('Error adding expenses:', error);
    throw error;
  }
}

// Quick expense addition endpoint
router.post('/add-expense', async (req, res) => {
  try {
    const { prompt, userId } = req.body;

    if (!prompt || !userId) {
      return res.status(400).json({ 
        error: 'Prompt and userId are required' 
      });
    }

    const aiResponse = await aiService.processExpensePrompt(prompt);
    
    if (aiResponse.expenses && aiResponse.expenses.length > 0) {
      await handleExpenseAddition(userId, aiResponse.expenses);
    }

    res.json({
      success: true,
      message: aiResponse.message,
      expenses: aiResponse.expenses
    });

  } catch (error) {
    console.error('AI Expense Processing Error:', error);
    res.status(500).json({ 
      error: 'Failed to process expense',
      details: error.message 
    });
  }
});

// Get budget suggestions based on user goal
router.post('/suggest-budget', async (req, res) => {
  console.log('Suggest-budget endpoint hit with body:', req.body);
  
  try {
    const { prompt, userId } = req.body;

    if (!prompt || !userId) {
      console.log('Missing required fields:', { prompt: !!prompt, userId: !!userId });
      return res.status(400).json({ 
        error: 'Prompt and userId are required' 
      });
    }

    console.log('Getting budget data for user:', userId);
    
    try {
      // First, check if the budgets table exists and is accessible
      const { data: budgets, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (budgetError) {
        console.error('Error fetching budget:', {
          message: budgetError.message,
          code: budgetError.code,
          details: budgetError.details,
          hint: budgetError.hint
        });
        return res.status(500).json({ 
          error: 'Failed to fetch budget data',
          details: budgetError.message,
          code: budgetError.code
        });
      }

      if (!budgets || budgets.length === 0) {
        console.log('No budget data found for user:', userId);
        return res.status(404).json({
          error: 'No budget data found',
          details: 'Please set up your budget first'
        });
      }

      const currentBudget = budgets[0];
      console.log('Found budget data:', currentBudget);

      // Get financial overview data
      console.log('Getting financial overview for user:', userId);
      const { data: financialOverviews, error: overviewError } = await supabase
        .from('financial_overview')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (overviewError) {
        console.error('Error fetching financial overview:', overviewError);
        return res.status(500).json({
          error: 'Failed to fetch financial overview',
          details: overviewError.message,
          code: overviewError.code
        });
      }

      if (!financialOverviews || financialOverviews.length === 0) {
        console.log('No financial overview found for user:', userId);
        return res.status(404).json({
          error: 'No financial overview found',
          details: 'Please complete your financial profile'
        });
      }

      const financialOverview = financialOverviews[0];
      console.log('Found financial overview:', financialOverview);

      console.log('Generating AI suggestion...');
      // Generate AI suggestion
      const suggestion = await aiService.generateBudgetSuggestion(
        prompt,
        currentBudget,
        financialOverview
      );

      if (!suggestion) {
        throw new Error('AI service returned empty suggestion');
      }

      console.log('Suggestion generated successfully');
      return res.json({
        success: true,
        suggestion
      });

    } catch (error) {
      console.error('Error in suggest-budget database operations:', error);
      throw error; // This will be caught by the outer try-catch
    }

  } catch (error) {
    console.error('Error in suggest-budget endpoint:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Failed to generate budget suggestion',
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

module.exports = router;
