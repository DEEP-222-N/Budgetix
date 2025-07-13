import React, { useState, useEffect } from 'react';
import { Target, Percent, Calendar, AlertCircle, Save, X } from 'lucide-react';
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
          setMonthlyBudget(budgetData.monthly_budget_total);
          setCategoryBudgets(allCategories.map(name => {
            const dbName = name.toLowerCase().replace(/ and /gi, '_and_').replace(/ /g, '_');
            return {
              name,
              budget: budgetData[dbName] || 200,
              current: spentMap[name] || 0
            };
          }));
          setCategoryBudgetInputs(allCategories.map(name => String(budgetData[name.toLowerCase().replace(/ and /gi, '_and_').replace(/ /g, '_')] || 200)));
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
      const budgetData = {};
      categoryBudgets.forEach(cat => {
        const dbName = cat.name.toLowerCase().replace(/ and /gi, '_and_').replace(/ /g, '_');
        budgetData[dbName] = Number(cat.budget) || 0;
      });
      budgetData.monthly_budget_total = Number(monthlyBudget) || 0;
      budgetData.user_id = user.id;
      budgetData.updated_at = new Date().toISOString();
      // Add new fields with logic
      budgetData.monthly_investment_goal = monthlyInvestmentGoal ? Number(monthlyInvestmentGoal) : 0;
      budgetData.monthly_savings_goal = monthlySavingsGoal ? Number(monthlySavingsGoal) : 0;
      budgetData.achievable_goal = achievableGoal || null;
      budgetData.months_to_achieve_goal = monthsToAchieveGoal ? Number(monthsToAchieveGoal) : (achievableGoal ? null : 0);
      const { error: upsertError } = await supabase
        .from('budgets')
        .upsert(budgetData, { onConflict: 'user_id' });
      if (upsertError) {
        setError('Failed to save budget data');
        return;
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setError('An unexpected error occurred while saving');
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
      const budgetSettingsData = {
        user_id: user.id,
        monthly_budget_total: Number(monthlyBudgetInput !== undefined ? monthlyBudgetInput : monthlyBudget) || 0,
        monthly_savings_goal: monthlySavingsGoal ? Number(monthlySavingsGoal) : 0,
        monthly_investment_goal: monthlyInvestmentGoal ? Number(monthlyInvestmentGoal) : 0,
        achievable_goal: achievableGoal || null,
        months_to_achieve_goal: monthsToAchieveGoal ? Number(monthsToAchieveGoal) : null,
        updated_at: new Date().toISOString(),
      };
      const { error: upsertError } = await supabase
        .from('budgets')
        .upsert(budgetSettingsData, { onConflict: 'user_id' });
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
      {/* AI Assistant Prompt */}
      <div className="mb-8">
        <label htmlFor="aiPrompt" className="block text-lg font-bold text-purple-900 mb-2">AI Assistant Prompt</label>
        <textarea
          id="aiPrompt"
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          rows={4}
          className="w-full p-4 border-2 border-purple-300 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg resize-vertical min-h-[100px]"
          placeholder="Type your request or question for the AI assistant..."
        />
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
      {/* Budget Settings */}
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 w-full mb-8">
        <div className="flex items-center space-x-3 mb-8">
          <Target className="h-7 w-7 text-blue-600" />
          <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Budget Settings</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Monthly Budget Goal */}
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
            {/* Monthly Savings Goal */}
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
            {/* Achievable Goal */}
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
            {/* Monthly Investment Goal */}
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
            {/* Months to Achieve Goal */}
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
        <div className="flex justify-end mt-8">
          <button
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-300"
            onClick={handleBudgetSettingsSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Budget Settings'}
          </button>
        </div>
      </div>
      {/* Category Budgets */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 w-full">
        <div className="flex items-center space-x-2 mb-6">
          <Calendar className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-semibold">Category Budgets</h3>
        </div>
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
      <div className="flex justify-end mt-8">
        <button
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-300"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default BudgetManager; 