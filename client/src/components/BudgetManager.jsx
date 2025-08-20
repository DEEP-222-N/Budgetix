import React, { useState, useEffect } from 'react';
import { Target, Percent, Calendar, AlertCircle, Save, X, Brain, Sparkles, Loader2, TrendingUp, DollarSign, PieChart, BarChart3, Settings, Zap, CheckCircle } from 'lucide-react';
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
  
  
  // Simple styling for AI financial report
  
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
 
  const [categoryBudgetInputs, setCategoryBudgetInputs] = useState(
    allCategories.map(() => undefined)
  );
  
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState(undefined);
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState('');
  const [monthlyInvestmentGoal, setMonthlyInvestmentGoal] = useState('');
  const [achievableGoal, setAchievableGoal] = useState('');
  const [monthsToAchieveGoal, setMonthsToAchieveGoal] = useState('');


  const [showError, setShowError] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

 
  const [aiPromptResponse, setAiPromptResponse] = useState(null);
  // Add state for custom budget breakdown and loading
  const [customBudget, setCustomBudget] = useState(null);
  const [customBudgetLoading, setCustomBudgetLoading] = useState(false);
  const [customBudgetError, setCustomBudgetError] = useState('');
  const [autoFillPrompt, setAutoFillPrompt] = useState(false);
  const [autoFillDone, setAutoFillDone] = useState(false);
  const [autoFillDeclined, setAutoFillDeclined] = useState(false);

 
  const now = new Date();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const years = Array.from({ length: 9 }, (_, i) => now.getFullYear() - 4 + i);

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

  // REMOVED: Auto-saving useEffect hooks that were causing conflicts
  // localStorage is now only saved when explicitly needed

  // Load valid data from localStorage on component mount
  useEffect(() => {
    const savedSuggestion = localStorage.getItem('aiSuggestion');
    const savedPrompt = localStorage.getItem('aiPrompt');
    
    console.log('🔄 Loading from localStorage:', { savedSuggestion: savedSuggestion?.substring(0, 50), savedPrompt: savedPrompt?.substring(0, 50) });
    
    // Simply load whatever data exists - no validation, no clearing
    if (savedSuggestion && savedPrompt) {
      console.log('✅ Loading both prompt and suggestion');
      setAiSuggestion(savedSuggestion);
      setAiPrompt(savedPrompt);
    } else if (savedSuggestion) {
      console.log('✅ Loading suggestion only');
      setAiSuggestion(savedSuggestion);
    } else if (savedPrompt) {
      console.log('✅ Loading prompt only');
      setAiPrompt(savedPrompt);
    } else {
      console.log('ℹ️ No data found in localStorage');
    }
  }, []);

  // When loading the monthly budget, reset the input string to undefined
  useEffect(() => {
    setMonthlyBudgetInput(undefined);
  }, [monthlyBudget]);

  
  const handleMonthlyBudgetInputChange = (value) => {
    if (/^\d*$/.test(value)) {
      setMonthlyBudgetInput(value);
    }
  };
 
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
     
        const { data: budgetData, error: budgetError } = await supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .eq('budget_month', monthNames[selectedMonth])
          .eq('budget_year', selectedYear)
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
          console.log('📅 Budget period:', budgetData.budget_month, budgetData.budget_year);
          setMonthlyBudget(budgetData.monthly_budget_total);
          
          // Load budget settings fields
          setMonthlySavingsGoal(budgetData.monthly_savings_goal ? String(budgetData.monthly_savings_goal) : '');
          setMonthlyInvestmentGoal(budgetData.monthly_investment_goal ? String(budgetData.monthly_investment_goal) : '');
          setAchievableGoal(budgetData.achievable_goal || '');
          setMonthsToAchieveGoal(budgetData.months_to_achieve_goal ? String(budgetData.months_to_achieve_goal) : '');
          
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
  }, [user, supabase, setMonthlyBudget, selectedMonth, selectedYear]);

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
      // Prepare budget updates for the selected month/year
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
      budgetUpdates.budget_month = monthNames[selectedMonth];
      budgetUpdates.budget_year = selectedYear;
      
      // Log the data being sent to help with debugging
      console.log('Saving monthly budget data:', budgetUpdates);
      
      // Upsert by unique key (user, month, year)
      const payload = {
        user_id: user.id,
        ...budgetUpdates,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('budgets')
        .upsert(payload, {
          onConflict: 'user_id,budget_month,budget_year',
          ignoreDuplicates: false,
        });

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
      const budgetSettingsData = {
        user_id: user.id,
        budget_month: monthNames[selectedMonth],
        budget_year: selectedYear,
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
          onConflict: 'user_id,budget_month,budget_year',
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
    
              // Enhanced validation for meaningful financial goals
     const prompt = aiPrompt.trim();
     if (prompt.length < 10) {
       setAiError('Please provide a more detailed financial goal (at least 10 characters).');
       return;
     }
     
     // Check for basic financial context
     const financialKeywords = ['buy', 'save', 'invest', 'goal', 'money', 'house', 'car', 'education', 'travel', 'wedding', 'business', 'retirement', 'emergency', 'fund', 'lakh', 'crore', 'thousand', 'million', 'billion'];
     const hasFinancialContext = financialKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
     
     if (!hasFinancialContext) {
       setAiError('Please include financial context like "save", "buy", "invest", or specific amounts with "lakh", "crore", etc.');
       return;
     }
     
     // Check for amount and timeline
     const hasAmount = /\d+/.test(prompt);
     const hasTimeline = /(?:in|for|within|by|months?|years?|yrs?|mos?)/i.test(prompt);
     
     if (!hasAmount || !hasTimeline) {
       setAiError('Please include both an amount (e.g., "5 lakhs", "₹50,000") and a timeline (e.g., "in 2 years", "within 6 months").');
       return;
     }
    
    setIsLoadingAi(true);
    setAiError('');
    setAiSuggestion('');
    
    // Clear previous custom budget data when starting new AI suggestion
    setCustomBudget(null);
    setCustomBudgetError('');
    setAiPromptResponse(null);
    setAutoFillDone(false);
    setAutoFillDeclined(false);
    
    // Clear localStorage for clean workflow
    localStorage.removeItem('aiSuggestion');
    // Don't clear the prompt yet - keep it until we get a new suggestion
    
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
       const newSuggestion = responseData.suggestion || 'No suggestion provided';
       setAiSuggestion(newSuggestion);
       
       // Save both prompt and suggestion to localStorage immediately
       localStorage.setItem('aiPrompt', aiPrompt.trim());
       localStorage.setItem('aiSuggestion', newSuggestion);
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
      <div className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 rounded-2xl shadow-xl border border-gray-200/60 p-8 mb-8 overflow-hidden relative">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/40 to-purple-100/40 rounded-full -translate-y-16 translate-x-16 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-100/40 to-blue-100/40 rounded-full translate-y-12 -translate-x-12 blur-xl"></div>
        
        {/* Header */}
        <div className="flex items-center mb-8 relative z-10">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg mr-4">
            <Brain className="h-7 w-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">AI Budget Advisor</h2>
            <p className="text-gray-600 text-sm">Get personalized financial guidance powered by AI</p>
          </div>
        </div>
        
        {/* Input Form */}
        <form onSubmit={handleAiSuggestion} className="mb-8 relative z-10">
          <div className="mb-6">
            <label htmlFor="goal" className="block text-sm font-semibold text-gray-700 mb-3">
              What's your financial goal?
              <span className="text-xs font-normal text-gray-500 ml-2">Include amount, timeline, and purpose (e.g., "I want to save ₹5 lakhs for a house down payment in 2 years")</span>
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
              <input
                type="text"
                id="goal"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full px-6 py-4 rounded-xl border-2 border-gray-200 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 bg-white text-gray-900 placeholder-gray-400 transition-all duration-300 shadow-sm hover:shadow-md"
                  placeholder="e.g., Save ₹5 lakhs for house down payment in 2 years..."
                disabled={isLoadingAi}
              />
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full"></div>
                </div>
              </div>
              <button
                type="submit"
                disabled={!aiPrompt.trim() || isLoadingAi}
                className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-xl shadow-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-0.5 disabled:transform-none"
              >
                {isLoadingAi ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="-ml-1 mr-3 h-5 w-5" />
                    Get Suggestion
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Error Display */}
        {aiError && (
          <div className="p-4 mb-6 text-sm text-red-700 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium">Error:</span>
              <span>{aiError}</span>
            </div>
          </div>
        )}

        {/* AI Suggestion Display */}
        {aiSuggestion && (
          <>
            <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 p-8 rounded-xl border border-gray-200/60 mb-6 relative z-10 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <PieChart className="h-5 w-5 text-white" />
                </div>
                                 <div className="flex-1">
                   <h3 className="text-xl font-bold text-gray-900">Your Personalized Budget Plan</h3>
                   <p className="text-sm text-gray-600 mt-1">AI-generated financial analysis and recommendations</p>
                 </div>
                                   <button
                    onClick={() => {
                      setAiSuggestion('');
                      setAiPrompt('');
                      setCustomBudget(null);
                      setCustomBudgetError('');
                      setAiPromptResponse(null);
                      setAutoFillDone(false);
                      setAutoFillDeclined(false);
                      localStorage.removeItem('aiSuggestion');
                      localStorage.removeItem('aiPrompt');
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Clear AI suggestion"
                  >
                    <X className="h-5 w-5" />
                  </button>
              </div>
              <div 
                className="prose max-w-none text-gray-700 bg-white p-8 rounded-xl border border-gray-200/60 shadow-lg"
                style={{
                  '--tw-prose-headings': '#1f2937',
                  '--tw-prose-links': '#3b82f6',
                  '--tw-prose-bold': '#1f2937',
                  '--tw-prose-counters': '#6b7280',
                  '--tw-prose-bullets': '#d1d5db',
                  '--tw-prose-hr': '#e5e7eb',
                  '--tw-prose-quotes': '#1f2937',
                  '--tw-prose-quote-borders': '#e5e7eb',
                  '--tw-prose-captions': '#6b7280',
                  '--tw-prose-code': '#1f2937',
                  '--tw-prose-pre-code': '#e5e7eb',
                  '--tw-prose-pre-bg': '#1f2937',
                  '--tw-prose-invert-headings': '#f9fafb',
                  '--tw-prose-invert-links': '#60a5fa',
                  '--tw-prose-invert-bold': '#f9fafb',
                  '--tw-prose-invert-counters': '#9ca3af',
                  '--tw-prose-invert-bullets': '#4b5563',
                  '--tw-prose-invert-hr': '#374151',
                  '--tw-prose-invert-quotes': '#f9fafb',
                  '--tw-prose-invert-quote-borders': '#374151',
                  '--tw-prose-invert-captions': '#9ca3af',
                  '--tw-prose-invert-code': '#f9fafb',
                  '--tw-prose-invert-pre-code': '#d1d5db',
                  '--tw-prose-invert-pre-bg': '#111827'
                }}
              >
                
                                                   <div 
                    className="ai-financial-report"
                    style={{
                      fontSize: '1rem',
                      lineHeight: '1.8',
                      color: '#374151'
                    }}
                  >
                    {aiSuggestion.split('\n').map((line, index) => {
                      // Clean the line completely - remove ALL hash symbols, stars, and special characters
                      let cleanLine = line.trim();
                      
                      // Remove hash symbols from anywhere in the line
                      cleanLine = cleanLine.replace(/#/g, '');
                      
                      // Remove star symbols from anywhere in the line
                      cleanLine = cleanLine.replace(/\*/g, '');
                      
                      // Skip empty lines
                      if (!cleanLine) {
                        return <div key={index} className="h-2"></div>;
                      }
                      
                      // Check if it was originally a heading (starts with ## or ###)
                      if (line.startsWith('##') || line.startsWith('###')) {
                        return (
                          <h3 key={index} className="text-lg font-semibold text-gray-800 mb-3 mt-4">
                            {cleanLine}
                          </h3>
                        );
                      }
                      
                      // Check if it was originally a bullet point
                      if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
                        return (
                          <div key={index} className="flex items-start mb-2">
                            <span className="text-gray-500 mr-2 w-4 text-center">•</span>
                            <span className="text-gray-700">{cleanLine}</span>
            </div>
                        );
                      }
                      
                      // Check if it was originally a numbered list
                      if (/^\d+\./.test(line)) {
                        const number = line.match(/^\d+/)[0];
                        return (
                          <div key={index} className="flex items-start mb-2">
                            <span className="text-gray-500 mr-2 font-medium w-6 text-center">{number}.</span>
                            <span className="text-gray-700">{cleanLine.replace(/^\d+\.\s*/, '')}</span>
                          </div>
                        );
                      }
                      
                      // Regular text
                      return (
                        <p key={index} className="mb-2 text-gray-700">
                          {cleanLine}
                        </p>
                      );
                    })}
                  </div>
              </div>
            </div>
            
            {/* Custom Budget Prompt */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200/60 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
                <p className="text-lg font-semibold text-blue-900">Do you want the AI to build a customized budget?</p>
              </div>
              <div className="flex gap-4 mb-4">
                <button
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 transition-all duration-300 transform hover:-translate-y-0.5 shadow-md"
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
                  Yes, please!
                </button>
                <button
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 transition-all duration-300 transform hover:-translate-y-0.5 shadow-md"
                  onClick={() => setAiPromptResponse('no')}
                  type="button"
                >
                  No, thanks
                </button>
              </div>
              
              {/* Custom Budget Results */}
              {aiPromptResponse === 'yes' && (
                <div className="mt-4">
                  {customBudgetLoading && (
                    <div className="flex items-center gap-3 p-4 bg-blue-100 rounded-lg border border-blue-200">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-blue-700 font-semibold">Calculating your custom 50/30/20 budget...</span>
                    </div>
                  )}
                  {customBudgetError && (
                    <div className="p-4 bg-red-100 rounded-lg border border-red-200 text-red-700 font-semibold">
                      {customBudgetError}
                    </div>
                  )}
                  {customBudget && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mt-4 shadow-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-white" />
                        </div>
                        <h4 className="text-xl font-bold text-green-900">Your 50/30/20 Custom Budget</h4>
                        </div>
                      
                      {/* Budget Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-lg border border-green-200/60">
                          <div className="text-sm text-gray-600 mb-1">Monthly Income</div>
                          <div className="text-xl font-bold text-green-700">₹{customBudget.monthlyIncome.toLocaleString()}</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-green-200/60">
                          <div className="text-sm text-gray-600 mb-1">AI-Suggested Savings</div>
                          <div className="text-xl font-bold text-green-700">₹{customBudget.aiSuggestedSavings.toLocaleString()}</div>
                      </div>
                        <div className="bg-white p-4 rounded-lg border border-green-200/60">
                          <div className="text-sm text-gray-600 mb-1">Remaining for 50/30/20</div>
                          <div className="text-xl font-bold text-green-700">₹{customBudget.remaining.toLocaleString()}</div>
                        </div>
                      </div>
                      
                      {/* Budget Breakdown */}
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-blue-900 font-semibold">Needs (50%)</span>
                            <span className="text-blue-700 font-bold text-lg">₹{customBudget.breakdown.needs.toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-blue-700">Food, Transportation and Fuel, Housing, Utilities, Grocery, Healthcare, Education</div>
                        </div>
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-purple-900 font-semibold">Wants (30%)</span>
                            <span className="text-purple-700 font-bold text-lg">₹{customBudget.breakdown.wants.toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-purple-700">Entertainment, Shopping, Travel, Personal Care</div>
                        </div>
                        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-indigo-900 font-semibold">Extra (20%)</span>
                            <span className="text-indigo-700 font-bold text-lg">₹{customBudget.breakdown.extra.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Auto-fill Prompt */}
                      {!autoFillDone && (
                        <div className="mt-6 p-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg border border-blue-200">
                          <p className="mb-3 font-semibold text-blue-900">Should I add this automatically to your budget settings?</p>
                          <div className="flex gap-4">
                            <button
                              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 transition-all duration-300 transform hover:-translate-y-0.5 shadow-md"
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
                                setAutoFillDone(true);
                                setAutoFillDeclined(false);
                              }}
                              type="button"
                            >
                              Yes, auto-fill!
                            </button>
                            <button
                              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 transition-all duration-300 transform hover:-translate-y-0.5 shadow-md"
                              onClick={() => {
                                setAutoFillDone(true);
                                setAutoFillDeclined(true);
                              }}
                              type="button"
                            >
                              No, I'll do it manually
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Auto-fill Status */}
                      {autoFillDone && !autoFillDeclined && (
                        <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-200 text-green-700 font-semibold flex items-center gap-2">
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                          Fields have been auto-filled in Budget Settings below!
                        </div>
                      )}
                      {autoFillDone && autoFillDeclined && (
                        <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-semibold flex items-center gap-2">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <AlertCircle className="h-3 w-3 text-white" />
                          </div>
                          OK, you can fill the fields manually below
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {aiPromptResponse === 'no' && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg border border-gray-200 text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-500 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-3 w-3 text-white" />
                  </div>
                  No problem! You can always ask for help later.
                </div>
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
      <div className="bg-gradient-to-br from-white via-gray-50/30 to-blue-50/20 p-8 rounded-2xl shadow-xl border border-gray-200/60 w-full mb-8 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-100/30 to-purple-100/30 rounded-full -translate-y-12 translate-x-12 blur-xl"></div>
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-indigo-100/30 to-blue-100/30 rounded-full translate-y-10 -translate-x-10 blur-lg"></div>
        
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Budget Management</h2>
            <p className="text-base text-gray-500">Set your financial goals and track your progress</p>
          </div>
        </div>
        
        {/* Budget Settings Section */}
        <div className="mb-8">
          <div className="flex items-center mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full mr-3"></div>
            <h3 className="text-xl font-semibold text-gray-800">Budget Settings</h3>
            </div>
          
          {/* Budget Period */}
          <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-6 mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="text-base font-medium text-gray-700">Budget Period</span>
            </div>
            <div className="flex space-x-4">
            <select
              value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {monthNames.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
              ))}
            </select>
            <select
              value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
              ))}
            </select>
          </div>
          </div>

          {/* Monthly Budget Goal */}
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
              <label className="text-base font-medium text-gray-700">Monthly Budget Goal</label>
            </div>
                  <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              placeholder="Enter your monthly budget"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="text-sm text-gray-500 mt-2">Set your total spending goal for the month</p>
                </div>

          {/* Monthly Investment Goal */}
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
              <label className="text-base font-medium text-gray-700">Monthly Investment Goal</label>
              </div>
            <input
              type="number"
              value={monthlyInvestmentGoal}
              onChange={(e) => setMonthlyInvestmentGoal(e.target.value)}
              placeholder="Enter your investment goal"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="text-sm text-gray-500 mt-2">How much do you want to invest this month?</p>
          </div>
        </div>

        {/* Category Allocations */}
        <div className="mb-8">
          <div className="flex items-center mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full mr-3"></div>
            <h3 className="text-xl font-semibold text-gray-800">Category Allocations</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categoryBudgets.map((category, index) => (
              <div key={category.name} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-base font-semibold text-gray-800">{category.name}</span>
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm text-purple-600 font-medium">
                      {index + 1}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
              <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Budget Amount (₹)</label>
                  <input
                    type="number"
                      value={categoryBudgetInputs[index] !== undefined ? categoryBudgetInputs[index] : category.budget}
                      onChange={(e) => handleCategoryBudgetInputChange(index, e.target.value)}
                      onBlur={() => handleCategoryBudgetInputBlur(index)}
                      placeholder="Enter amount"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all"
                  />
                </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Current Spending</span>
                    <span className="font-medium text-gray-700">₹{category.current.toLocaleString()}</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${category.budget > 0 ? Math.min((category.current / category.budget) * 100, 100) : 0}%` 
                      }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>{category.budget > 0 ? Math.round((category.current / category.budget) * 100) : 0}% used</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Savings Goal */}
        <div className="mb-8">
          <div className="flex items-center mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full mr-3"></div>
            <h3 className="text-xl font-semibold text-gray-800">Savings & Goals</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                  <Save className="w-5 h-5 text-white" />
              </div>
              <div>
                  <h4 className="text-lg font-semibold text-blue-900">Monthly Savings Goal</h4>
                  <p className="text-sm text-blue-600">Set your target savings amount</p>
                </div>
              </div>
                <input
                type="number"
                value={monthlySavingsGoal}
                onChange={(e) => setMonthlySavingsGoal(e.target.value)}
                placeholder="Enter savings goal"
                className="w-full px-4 py-3 bg-white border border-blue-200 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
            </div>
              <div>
                  <h4 className="text-lg font-semibold text-orange-900">Monthly Investment Goal</h4>
                  <p className="text-sm text-orange-600">Plan your investment strategy</p>
                </div>
              </div>
                  <input
                    type="number"
                    value={monthlyInvestmentGoal}
                onChange={(e) => setMonthlyInvestmentGoal(e.target.value)}
                placeholder="Enter investment goal"
                className="w-full px-4 py-3 bg-white border border-orange-200 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
          </div>
          
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-purple-900">Long-term Financial Goal</h4>
                <p className="text-sm text-purple-600">Set a bigger financial milestone</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-2">Goal Description</label>
                <input
                  type="text"
                  value={achievableGoal}
                  onChange={(e) => setAchievableGoal(e.target.value)}
                  placeholder="e.g., Buy a house, Start business"
                  className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-2">Timeline (months)</label>
                <input
                  type="number"
                  value={monthsToAchieveGoal}
                  onChange={(e) => setMonthsToAchieveGoal(e.target.value)}
                  placeholder="e.g., 24 months"
                  className="w-full px-4 py-3 bg-white border border-purple-200 rounded-lg text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex flex-col items-center space-y-6">
          {/* Budget Summary Card */}
          <div className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
                      </div>
              <div>
                <h4 className="text-lg font-semibold text-purple-900">Budget Summary</h4>
                <p className="text-sm text-purple-600">Overview of your financial plan</p>
                    </div>
                  </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-purple-200/60">
                <div className="text-sm text-gray-600 mb-1">Total Budget</div>
                <div className="text-xl font-bold text-purple-700">₹{monthlyBudget ? monthlyBudget.toLocaleString() : '0'}</div>
                </div>
              <div className="bg-white p-4 rounded-lg border border-purple-200/60">
                <div className="text-sm text-gray-600 mb-1">Savings Goal</div>
                <div className="text-xl font-bold text-blue-700">₹{monthlySavingsGoal ? Number(monthlySavingsGoal).toLocaleString() : '0'}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-purple-200/60">
                <div className="text-sm text-gray-600 mb-1">Investment Goal</div>
                <div className="text-xl font-bold text-orange-700">₹{monthlyInvestmentGoal ? Number(monthlyInvestmentGoal).toLocaleString() : '0'}</div>
              </div>
          </div>
        </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="group relative px-8 py-3 bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 text-white font-semibold text-base rounded-xl hover:from-purple-700 hover:via-purple-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/25 transform hover:-translate-y-0.5 hover:scale-102 disabled:transform-none overflow-hidden"
          >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 animate-pulse"></div>
            
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <div className="flex items-center justify-center space-x-2 relative z-10">
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="tracking-wide text-sm">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-200" />
                  <span className="tracking-wide">Save Settings</span>
                </>
              )}
            </div>
            
            {/* Enhanced glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-500 rounded-xl blur-lg opacity-0 group-hover:opacity-25 transition-opacity duration-300 -z-10 scale-105"></div>
            
            {/* Border glow */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400 via-purple-500 to-purple-400 p-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="h-full w-full bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 rounded-xl"></div>
            </div>
          </button>
          
          <p className="text-sm text-gray-500 text-center max-w-md">
            Your budget settings will be saved for {monthNames[selectedMonth]} {selectedYear}. 
            You can modify these anytime to adjust your financial goals.
          </p>
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