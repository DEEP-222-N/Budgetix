import React, { useState, useEffect } from 'react';
import { Target, Percent, Calendar, AlertCircle, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useBudget } from '../context/BudgetContext';

const allCategories = [
  'Food',
  'Transportation & Fuel',
  'Entertainment',
  'Housing',
  'Utilities & Grocery',
  'Healthcare',
  'Education',
  'Shopping',
  'Personal Care',
  'Travel',
  'Savings & Investments',
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
            const dbName = name.toLowerCase().replace(' ', '_');
            return {
              name,
              budget: budgetData[dbName] || 200,
              current: spentMap[name] || 0
            };
          }));
          setCategoryBudgetInputs(allCategories.map(() => undefined));
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
    setIsSaving(true);
    setError(null);
    try {
      const budgetData = {};
      categoryBudgets.forEach(cat => {
        const dbName = cat.name.toLowerCase().replace(' ', '_');
        budgetData[dbName] = Number(cat.budget) || 0;
      });
      budgetData.monthly_budget_total = Number(monthlyBudget) || 0;
      budgetData.user_id = user.id;
      budgetData.updated_at = new Date().toISOString();
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
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Save className="h-5 w-5 text-green-600" />
            <p className="text-green-800 font-medium">Settings saved successfully!</p>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="text-blue-800 font-medium">Loading your budget data...</p>
          </div>
        </div>
      )}
      {/* Budget Settings */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 w-full mb-8">
        <div className="flex items-center space-x-2 mb-6">
          <Target className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold">Budget Settings</h3>
        </div>
        <div className="space-y-6">
          {/* Currency at the top */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <select
              value={currency}
              onChange={(e) => handleSettingChange('currency', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
          {/* Monthly Budget Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Budget Goal</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500 font-medium">{symbol}</span>
              <input
                type="text"
                value={monthlyBudgetInput !== undefined ? monthlyBudgetInput : (monthlyBudget === 0 ? '' : monthlyBudget)}
                onChange={e => handleMonthlyBudgetInputChange(e.target.value)}
                onBlur={handleMonthlyBudgetInputBlur}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">Set your total spending goal for the month.</p>
          </div>
          {/* Overspending Alert Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Overspending Alert Threshold</label>
            <div className="relative">
              <Percent className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="number"
                value={settings.overspendingAlert}
                onChange={(e) => handleSettingChange('overspendingAlert', Number(e.target.value))}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">Get notified when you've spent this percentage of your budget</p>
          </div>
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