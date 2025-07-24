const express = require('express');
const router = express.Router();
const AIService = require('../services/aiService');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

module.exports = router;
