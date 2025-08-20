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

      // Use mock data if no financial overview exists
      let financialOverview = financialOverviews && financialOverviews[0] 
        ? financialOverviews[0] 
        : {
            total_monthly_income: 50000,
            total_savings: 100000,
            total_expenses: 35000,
            total_investment_amount: 50000
          };

      console.log('Using financial overview:', financialOverview);

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
        suggestion,
        mockDataUsed: !financialOverviews || financialOverviews.length === 0
      });

    } catch (error) {
      console.error('Error in suggest-budget database operations:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error in suggest-budget endpoint:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Provide a fallback response if everything fails
    const fallbackSuggestion = {
      message: `Based on your goal to "${req.body.prompt}", here's a suggested budget plan:\n\n` +
      `1. **Monthly Income:** ₹50,000 (estimated)\n` +
      `2. **Recommended Monthly Savings:** ₹15,000 (30% of income)\n` +
      `3. **Category Breakdown (Monthly):**\n` +
      `   - Housing: ₹15,000\n` +
      `   - Food: ₹10,000\n` +
      `   - Transportation: ₹5,000\n` +
      `   - Utilities: ₹3,000\n` +
      `   - Entertainment: ₹2,000\n` +
      `   - Other: ₹5,000\n\n` +
      `*Note: This is a general suggestion based on standard budgeting principles. For personalized advice, please complete your profile with accurate financial details. You can then use the AI advisor to get customized recommendations based on your actual spending patterns from the app.*`,
      isFallback: true
    };
    
    res.status(200).json({
      success: true,
      suggestion: fallbackSuggestion,
      mockDataUsed: true
    });
  }
});

// Custom 50/30/20 budget endpoint
router.post('/custom-budget-50-30-20', async (req, res) => {
  try {
    const { userId, aiSuggestion } = req.body;
    if (!userId || !aiSuggestion) {
      return res.status(400).json({ error: 'userId and aiSuggestion are required' });
    }

    // Get financial overview
    const { data: financialOverviews, error: overviewError } = await supabase
      .from('financial_overview')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (overviewError) {
      return res.status(500).json({ error: 'Failed to fetch financial overview', details: overviewError.message });
    }
    const financialOverview = financialOverviews && financialOverviews[0]
      ? financialOverviews[0]
      : { total_monthly_income: 50000 };
    const monthlyIncome = financialOverview.total_monthly_income || 0;

    // Parse AI-suggested savings from aiSuggestion (look for 'Required Monthly Savings: ₹X' or similar)
    let savings = 0;
    const savingsRegexes = [
      /Required Monthly Savings:\s*₹?([\d,]+)/i,
      /saving[s]?\s*₹?([\d,]+)\s*\/\s*month/i,
      /save[s]?\s*₹?([\d,]+)\s*(per\s*month|\/\s*month)/i,
      /need[s]?\s*to\s*save\s*₹?([\d,]+)\s*\/\s*month/i
    ];
    for (const regex of savingsRegexes) {
      const match = aiSuggestion.match(regex);
      if (match) {
        savings = parseInt(match[1].replace(/,/g, ''));
        break;
      }
    }

    // Calculate remaining income
    const remaining = Math.max(0, monthlyIncome - savings);
    const needs = Math.round(remaining * 0.5);
    const wants = Math.round(remaining * 0.3);
    const extra = remaining - needs - wants; // To ensure total matches

    res.json({
      success: true,
      monthlyIncome,
      aiSuggestedSavings: savings,
      remaining,
      breakdown: {
        needs,
        wants,
        extra
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate custom budget', details: error.message });
  }
});

// Receipt scan endpoint
router.post('/scan-receipt', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data is required' });
    }
    const result = await aiService.scanReceiptBase64({ base64Data, mimeType });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('scan-receipt error:', error);
    res.status(500).json({ success: false, error: 'Failed to scan receipt' });
  }
});

// Monthly insights endpoint
router.post('/monthly-insights', async (req, res) => {
  try {
    const { userId, reportData } = req.body;
    
    if (!userId || !reportData) {
      return res.status(400).json({ 
        error: 'userId and reportData are required' 
      });
    }

    console.log('Generating monthly insights for user:', userId);
    
    // Generate AI insights using the AI service
    const insights = await aiService.generateMonthlyInsights(reportData);
    
    return res.json({
      success: true,
      insights
    });

  } catch (error) {
    console.error('Error in monthly-insights endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to generate monthly insights',
      details: error.message 
    });
  }
});

module.exports = router;
