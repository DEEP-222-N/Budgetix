import React, { useState, useEffect } from 'react';
import { Target, Percent, Calendar, AlertCircle, Save, X, Brain, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useBudget } from '../context/BudgetContext';

const allCategories = [
  'Food',
  'Transportation and Fuel',
  'Entertainment',
  'Housing',
  'Utilities',
  'Grocery',
  'Healthcare',
  'Education',
  'Shopping',
  'Personal Care',
  'Travel',
  'Other'
];

const BudgetManager = () => {
  const { user, supabase } = useAuth();
  const { currency, setCurrency, symbol } = useCurrency();
  const { monthlyBudget, setMonthlyBudget } = useBudget();
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [settings, setSettings] = useState({
    overspendingAlert: 90,
    currency: 'USD',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categoryBudgets, setCategoryBudgets] = useState(
    allCategories.map(name => ({ name, budget: 200, current: 0 }))
  );
  // Add a state to track the input string for each category (for UI only)
  const [categoryBudgetInputs, setCategoryBudgetInputs] = useState(
    allCategories.map(() => undefined)
  );
  // Add a state for the monthly budget input string (for UI only)
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState(undefined);
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState('');
  const [monthlyInvestmentGoal, setMonthlyInvestmentGoal] = useState('');
  const [achievableGoal, setAchievableGoal] = useState('');
  const [monthsToAchieveGoal, setMonthsToAchieveGoal] = useState('');

  // Alert dismiss logic
  const [showError, setShowError] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  // Add state for aiPromptResponse at the top of the component
  const [aiPromptResponse, setAiPromptResponse] = useState(null);
  // Add state for custom budget breakdown and loading
  const [customBudget, setCustomBudget] = useState(null);
  const [customBudgetLoading, setCustomBudgetLoading] = useState(false);
  const [customBudgetError, setCustomBudgetError] = useState('');
  const [autoFillPrompt, setAutoFillPrompt] = useState(false);
  const [autoFillDone, setAutoFillDone] = useState(false);
  const [autoFillSuccess, setAutoFillSuccess] = useState(false);

  useEffect(() => {
    if (showSuccess) {
      setShowSuccessAlert(true);
      const timer = setTimeout(() => setShowSuccessAlert(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // When loading the monthly budget, reset the input string to undefined
  useEffect(() => {
    setMonthlyBudgetInput(undefined);
  }, [monthlyBudget]);

  // Handler for input change
  const handleMonthlyBudgetInputChange = (value) => {
    if (/^\d*$/.test(value)) {
      setMonthlyBudgetInput(value);
    }
  };
  // On blur, update the actual budget value
  const handleMonthlyBudgetInputBlur = () => {
    setMonthlyBudget(monthlyBudgetInput === '' || monthlyBudgetInput === undefined ? 0 : Number(monthlyBudgetInput));
    setMonthlyBudgetInput(undefined);
  };

  useEffect(() => {
    const fetchUserBudgetData = async () => {
      if (!user || !supabase) return;
      setLoading(true);
      setError(null);
      try {
        // Temporarily use old budget system until migration is applied
        const { data: budgetData, error: budgetError } = await supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (budgetError && budgetError.code !== 'PGRST116') {
          setError('Failed to load budget data');
        }
        const { data: expenseData, error: expenseError } = await supabase
          .from('expenses')
          .select('category, amount')
          .eq('user_id', user.id);
        if (expenseError) {
          setError('Failed to load expense data');
          return;
        }
        const spentMap = {};
        expenseData.forEach(exp => {
          if (!spentMap[exp.category]) spentMap[exp.category] = 0;
          spentMap[exp.category] += Number(exp.amount) || 0;
        });
        if (budgetData) {
          console.log('✅ Loaded monthly budget data:', budgetData);
          console.log('📅 Current month:', budgetData.month);
          setMonthlyBudget(budgetData.monthly_budget_total);
          setCategoryBudgets(allCategories.map(name => {
            const dbName = getCategoryColumnName(name);
            return {
              name,
              budget: budgetData[dbName] || 200,
              current: spentMap[name] || 0
            };
          }));
          setCategoryBudgetInputs(allCategories.map(name => String(budgetData[getCategoryColumnName(name)] || 200)));
        } else {
          setCategoryBudgets(prev =>
            prev.map(cat => ({
              ...cat,
              current: spentMap[cat.name] || 0
            }))
          );
          setCategoryBudgetInputs(prev => prev.map(() => undefined));
        }
      } catch (err) {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchUserBudgetData();
  }, [user, supabase, setMonthlyBudget]);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'currency') setCurrency(value);
  };
  const handleCategoryBudgetChange = (index, value) => {
    setCategoryBudgets(prev => prev.map((cat, i) =>
      i === index ? { ...cat, budget: Number(value) } : cat
    ));
  };
  // Update the input string on change
  const handleCategoryBudgetInputChange = (index, value) => {
    // Allow only numbers or empty string
    if (/^\d*$/.test(value)) {
      setCategoryBudgetInputs(prev => prev.map((v, i) => i === index ? value : v));
    }
  };
  // On blur, update the actual budget value
  const handleCategoryBudgetInputBlur = (index) => {
    const value = categoryBudgetInputs[index];
    setCategoryBudgets(prev => prev.map((cat, i) =>
      i === index ? { ...cat, budget: value === '' || value === undefined ? 0 : Number(value) } : cat
    ));
    setCategoryBudgetInputs(prev => prev.map((v, i) => i === index ? undefined : v));
  };
  // Create a mapping function to convert category names to database column names
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

  const handleSave = async () => {
    if (!user || !supabase) return;
    // Validation: If achievableGoal is filled, monthsToAchieveGoal must be filled
    if (achievableGoal && !monthsToAchieveGoal) {
      setError('Please enter the number of months to achieve your goal.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      // Prepare budget updates for the current month
      const budgetUpdates = {};
      categoryBudgets.forEach(cat => {
        const dbName = getCategoryColumnName(cat.name);
        // Ensure budget values are valid numbers
        const budgetValue = Number(cat.budget);
        budgetUpdates[dbName] = isNaN(budgetValue) ? 0 : budgetValue;
      });
      budgetUpdates.monthly_budget_total = Number(monthlyBudget) || 0;
      // Add new fields with logic and ensure they are valid numbers
      budgetUpdates.monthly_investment_goal = monthlyInvestmentGoal ? Number(monthlyInvestmentGoal) : 0;
      budgetUpdates.monthly_savings_goal = monthlySavingsGoal ? Number(monthlySavingsGoal) : 0;
      budgetUpdates.achievable_goal = achievableGoal || null;
      budgetUpdates.months_to_achieve_goal = monthsToAchieveGoal ? Number(monthsToAchieveGoal) : (achievableGoal ? null : 0);
      
      // Log the data being sent to help with debugging
      console.log('Saving monthly budget data:', budgetUpdates);
      
      // Temporarily use old budget system until migration is applied
      budgetUpdates.user_id = user.id;
      budgetUpdates.updated_at = new Date().toISOString();
      
      // Try to update existing budget first, then insert if it doesn't exist
      let updateResult, upsertError;
      
      // First, try to update existing budget
      const { data: existingBudget } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (existingBudget) {
        // Update existing budget
        const { data, error } = await supabase
          .from('budgets')
          .update(budgetUpdates)
          .eq('user_id', user.id);
        updateResult = data;
        upsertError = error;
      } else {
        // Insert new budget
        const { data, error } = await supabase
          .from('budgets')
          .insert(budgetUpdates);
        updateResult = data;
        upsertError = error;
      }
      
      console.log('📤 Update result:', updateResult);
      console.log('❌ Update error:', upsertError);
      
      if (upsertError) {
        console.error('Budget save error:', upsertError);
        setError(`Failed to save budget data: ${upsertError.message || 'Database error'}`);
        return;
      }
      
      console.log('✅ Budget updated successfully (old system)');
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Unexpected error saving budget:', err);
      setError(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler to save only Budget Settings fields
  const handleBudgetSettingsSave = async () => {
    if (!user || !supabase) return;
    setIsSaving(true);
    setError(null);
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.toISOString().slice(0, 7); // Gets YYYY-MM format
      
      const budgetSettingsData = {
        user_id: user.id,
        month: currentMonth, // Add current month to match unique constraint
        monthly_budget_total: Number(monthlyBudgetInput !== undefined ? monthlyBudgetInput : monthlyBudget) || 0,
        monthly_savings_goal: monthlySavingsGoal ? Number(monthlySavingsGoal) : 0,
        monthly_investment_goal: monthlyInvestmentGoal ? Number(monthlyInvestmentGoal) : 0,
        achievable_goal: achievableGoal || null,
        months_to_achieve_goal: monthsToAchieveGoal ? Number(monthsToAchieveGoal) : null,
        updated_at: currentDate.toISOString(),
      };
      
      const { error: upsertError } = await supabase
        .from('budgets')
        .upsert(budgetSettingsData, { 
          onConflict: 'user_id,month', // Update onConflict to match unique constraint
          ignoreDuplicates: false 
        });
      if (upsertError) {
        setError('Failed to save budget settings');
        setShowError(true);
        return;
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setError('An unexpected error occurred while saving budget settings');
      setShowError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiSuggestion = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    
    setIsLoadingAi(true);
    setAiError('');
    setAiSuggestion('');
    
    try {
      console.log('Sending request to AI endpoint with prompt:', aiPrompt);
      const response = await fetch('http://localhost:5000/api/ai/suggest-budget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          userId: user.id
        }),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('API Error Response:', responseData);
        throw new Error(responseData.error || responseData.details || 'Failed to get suggestion');
      }
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Invalid response from server');
      }
      
      console.log('AI Suggestion received:', responseData);
      setAiSuggestion(responseData.suggestion || 'No suggestion provided');
    } catch (err) {
      console.error('Error getting AI suggestion:', err);
      setAiError(err.message || 'Failed to get suggestion. Please try again.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Check if all data is loaded (after all hooks)
  const isDataLoaded = !loading && user;

  // Show loading screen until all data is ready
  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Budget Manager</h2>
          <p className="text-gray-500">Please wait while we fetch your budget data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Budget Manager</h1>
        <p className="text-gray-600">Manage your budget goals and category allocations</p>
      </div>
      {/* AI Budget Advisor Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center mb-4">
          <Brain className="h-6 w-6 text-indigo-600 mr-2" />
          <h2 className="text-xl font-semibold">AI Budget Advisor</h2>
        </div>
        
        <form onSubmit={handleAiSuggestion} className="mb-6">
          <div className="mb-4">
            <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-2">
              What's your financial goal? (e.g., "I want to buy a bike worth 100000 in 2 years")
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="goal"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="I want to buy a bike worth 100000 in 2 years"
                disabled={isLoadingAi}
              />
              <button
                type="submit"
                disabled={!aiPrompt.trim() || isLoadingAi}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingAi ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="-ml-1 mr-2 h-4 w-4" />
                    Get Suggestion
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {aiError && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {aiError}
          </div>
        )}

        {aiSuggestion && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">Your Personalized Budget Plan</h3>
              <div 
                className="prose max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ 
                  __html: aiSuggestion.replace(/\n/g, '<br />')
                }} 
              />
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="mb-3 font-medium text-blue-900">Do you want the AI to build a customized AI budget?</p>
              <div className="flex gap-4">
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none"
                  onClick={async () => {
                    setAiPromptResponse('yes');
                    setCustomBudget(null);
                    setCustomBudgetError('');
                    setCustomBudgetLoading(true);
                    try {
                      const response = await fetch('http://localhost:5000/api/ai/custom-budget-50-30-20', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.id, aiSuggestion })
                      });
                      const data = await response.json();
                      if (!data.success) throw new Error(data.error || 'Failed to get custom budget');
                      setCustomBudget(data);
                    } catch (err) {
                      setCustomBudgetError(err.message || 'Failed to get custom budget');
                    } finally {
                      setCustomBudgetLoading(false);
                    }
                  }}
                  type="button"
                >
                  Yes
                </button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none"
                  onClick={() => setAiPromptResponse('no')}
                  type="button"
                >
                  No
                </button>
              </div>
              {aiPromptResponse === 'yes' && (
                <div className="mt-3">
                  {customBudgetLoading && <div className="text-blue-700 font-semibold">Calculating your custom 50/30/20 budget...</div>}
                  {customBudgetError && <div className="text-red-700 font-semibold">{customBudgetError}</div>}
                  {customBudget && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-2">
                      <h4 className="font-bold text-green-900 mb-2">Your 50/30/20 Custom Budget</h4>
                      <div className="text-gray-800 mb-1">Monthly Income: <span className="font-semibold">₹{customBudget.monthlyIncome.toLocaleString()}</span></div>
                      <div className="text-gray-800 mb-1">AI-Suggested Savings: <span className="font-semibold">₹{customBudget.aiSuggestedSavings.toLocaleString()}</span></div>
                      <div className="text-gray-800 mb-1">Remaining for 50/30/20: <span className="font-semibold">₹{customBudget.remaining.toLocaleString()}</span></div>
                      <div className="mt-2">
                        <div className="text-blue-900 font-medium">
                          Needs (50%): <span className="font-semibold">₹{customBudget.breakdown.needs.toLocaleString()}</span>
                          <div className="text-xs text-gray-700 mt-1">(Food, Transportation and Fuel, Housing, Utilities, Grocery, Healthcare, Education)</div>
                        </div>
                        <div className="text-blue-900 font-medium mt-2">
                          Wants (30%): <span className="font-semibold">₹{customBudget.breakdown.wants.toLocaleString()}</span>
                          <div className="text-xs text-gray-700 mt-1">(Entertainment, Shopping, Travel, Personal Care)</div>
                        </div>
                        <div className="text-blue-900 font-medium mt-2">
                          Extra (20%): <span className="font-semibold">₹{customBudget.breakdown.extra.toLocaleString()}</span>
                        </div>
                      </div>
                      {/* Auto-fill prompt */}
                      {!autoFillDone && (
                        <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                          <p className="mb-2 font-medium text-blue-900">Should I add this automatically?</p>
                          <div className="flex gap-4">
                            <button
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none"
                              onClick={() => {
                                // Extract achievable goal from aiPrompt or aiSuggestion
                                let goalText = aiPrompt;
                                // Try to extract from AI suggestion if possible
                                const matchGoal = aiSuggestion.match(/Financial Analysis: (.+)/i);
                                if (matchGoal) goalText = matchGoal[1];
                                // Extract months from goal text (e.g. 'in 1 year', 'in 6 months')
                                let months = '';
                                const monthsMatch = goalText.match(/in (\d+) months?/i);
                                if (monthsMatch) months = monthsMatch[1];
                                else {
                                  const yearsMatch = goalText.match(/in (\d+) years?/i);
                                  if (yearsMatch) months = String(Number(yearsMatch[1]) * 12);
                                }
                                setAchievableGoal(goalText);
                                setMonthlySavingsGoal(customBudget.aiSuggestedSavings);
                                setMonthlyBudget(customBudget.remaining);
                                setMonthsToAchieveGoal(months);
                                setAutoFillSuccess(true);
                                setAutoFillDone(true);
                              }}
                              type="button"
                            >
                              Yes
                            </button>
                            <button
                              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none"
                              onClick={() => {
                                setAutoFillSuccess(false);
                                setAutoFillDone(true);
                              }}
                              type="button"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}
                      {autoFillDone && autoFillSuccess && (
                        <div className="mt-2 text-green-700 font-semibold">Fields have been auto-filled in Budget Settings below!</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {aiPromptResponse === 'no' && (
                <div className="mt-3 text-red-700 font-semibold">No problem! You can always ask for help later.</div>
              )}
            </div>
          </>
        )}
      </div>
      {/* Toast Notifications */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full flex justify-center pointer-events-none">
        <div className="w-full max-w-md">
          {showSuccessAlert && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 shadow-lg mb-4 animate-fade-in pointer-events-auto transition-all duration-300">
              <div className="flex items-center space-x-2">
                <Save className="h-5 w-5 text-green-600" />
                <span className="font-medium">Settings saved successfully!</span>
              </div>
              <button onClick={() => setShowSuccessAlert(false)} className="ml-4 text-green-700 hover:text-green-900 focus:outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          {showError && error && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 shadow-lg mb-4 animate-fade-in pointer-events-auto transition-all duration-300">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium">{error}</span>
              </div>
              <button onClick={() => setShowError(false)} className="ml-4 text-red-700 hover:text-red-900 focus:outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Combined Budget Settings and Categories */}
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 w-full mb-8">
        <div className="flex items-center space-x-3 mb-8">
          <Target className="h-7 w-7 text-blue-600" />
          <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Budget Management</h3>
        </div>
        
        {/* Budget Settings Section */}
        <div className="mb-12">
          <h4 className="text-lg font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">Budget Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Left Column */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Budget Goal</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{symbol}</span>
                  <input
                    type="text"
                    value={monthlyBudgetInput !== undefined ? monthlyBudgetInput : (monthlyBudget === 0 ? '' : monthlyBudget)}
                    onChange={e => handleMonthlyBudgetInputChange(e.target.value)}
                    onBlur={handleMonthlyBudgetInputBlur}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:border-blue-400 transition align-middle"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Set your total spending goal for the month.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Savings Goal</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{symbol}</span>
                  <input
                    type="number"
                    value={monthlySavingsGoal}
                    onChange={e => setMonthlySavingsGoal(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 hover:border-green-400 transition align-middle"
                    placeholder="Enter your savings goal"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">How much do you want to save this month?</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Achievable Goal</label>
                <input
                  type="text"
                  value={achievableGoal}
                  onChange={e => setAchievableGoal(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 hover:border-purple-400 transition align-middle"
                  placeholder="Describe your goal (e.g., Save for a new car)"
                />
                <p className="text-xs text-gray-500 mt-1">Describe a specific goal you want to achieve this month.</p>
              </div>
            </div>
            {/* Right Column */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Investment Goal</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{symbol}</span>
                  <input
                    type="number"
                    value={monthlyInvestmentGoal}
                    onChange={e => setMonthlyInvestmentGoal(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-gray-50 hover:border-yellow-400 transition align-middle"
                    placeholder="Enter your investment goal"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">How much do you want to invest this month?</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Months to Achieve Goal</label>
                <input
                  type="number"
                  value={monthsToAchieveGoal}
                  onChange={e => setMonthsToAchieveGoal(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:border-blue-400 transition align-middle"
                  placeholder="Enter number of months"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">How many months do you plan to achieve your goal in?</p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Budgets Section */}
        <div className="mt-12">
          <h4 className="text-lg font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-200">Category Budgets</h4>
          <div className="space-y-4">
            {categoryBudgets.map((category, idx) => {
              const isOverBudget = category.current > category.budget;
              return (
                <div
                  key={category.name}
                  className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg ${isOverBudget ? 'border border-red-500' : ''}`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{category.name}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${isOverBudget ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-blue-500 to-purple-600'}`}
                          style={{ width: `${category.budget > 0 ? Math.min((category.current / category.budget) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <span className={`text-sm ${isOverBudget ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {symbol}{category.current} / {symbol}{category.budget}
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={categoryBudgetInputs[idx] !== undefined ? categoryBudgetInputs[idx] : (category.budget === 0 ? '' : category.budget)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm ml-4"
                    onChange={e => handleCategoryBudgetInputChange(idx, e.target.value)}
                    onBlur={() => handleCategoryBudgetInputBlur(idx)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Single Save Button */}
        <div className="flex justify-end mt-10">
          <button
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-300"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save All Budget Settings'}
          </button>
        </div>
      </div>
      {/* Toast Notifications */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full flex justify-center pointer-events-none">
        <div className="w-full max-w-md">
          {showSuccessAlert && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 shadow-lg mb-4 animate-fade-in pointer-events-auto transition-all duration-300">
              <div className="flex items-center space-x-2">
                <Save className="h-5 w-5 text-green-600" />
                <span className="font-medium">Settings saved successfully!</span>
              </div>
              <button onClick={() => setShowSuccessAlert(false)} className="ml-4 text-green-700 hover:text-green-900 focus:outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          {showError && error && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 shadow-lg mb-4 animate-fade-in pointer-events-auto transition-all duration-300">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium">{error}</span>
              </div>
              <button onClick={() => setShowError(false)} className="ml-4 text-red-700 hover:text-red-900 focus:outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetManager;