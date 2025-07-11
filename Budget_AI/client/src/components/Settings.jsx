import React, { useState, useEffect } from 'react';
import { Target, Bell, Palette, Shield, Save, DollarSign, Percent, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useBudget } from '../context/BudgetContext';

const allCategories = [
  'Food',
  'Transportation',
  'Entertainment',
  'Housing',
  'Utilities',
  'Healthcare',
  'Education',
  'Shopping',
  'Personal Care',
  'Travel',
  'Gifts',
  'Other'
];

const Settings = () => {
  const { user, supabase } = useAuth();
  const { currency, setCurrency, symbol } = useCurrency();
  const { monthlyBudget, setMonthlyBudget } = useBudget();
  const [settings, setSettings] = useState({
    budgetAlerts: true,
    overspendingAlert: 90,
    weeklyReports: true,
    aiRecommendations: true,
    currency: 'USD',
    theme: 'light'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initialize all categories with default budgets and 0 spent
  const [categoryBudgets, setCategoryBudgets] = useState(
    allCategories.map(name => ({ name, budget: 200, current: 0 }))
  );

  useEffect(() => {
    // Fetch user's budget data and expenses
    const fetchUserBudgetData = async () => {
      if (!user || !supabase) return;
      setLoading(true);
      setError(null);
      
      try {
        // Fetch budget limits from the budgets table
        const { data: budgetData, error: budgetError } = await supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (budgetError && budgetError.code !== 'PGRST116') { // PGRST116 is the "no rows returned" error
          console.error('Error fetching budget data:', budgetError);
          setError('Failed to load budget data');
        }
        
        // Fetch expenses for the user and aggregate spent per category
        const { data: expenseData, error: expenseError } = await supabase
          .from('expenses')
          .select('category, amount')
          .eq('user_id', user.id);
          
        if (expenseError) {
          console.error('Error fetching expenses:', expenseError);
          setError('Failed to load expense data');
          return;
        }
        
        // Aggregate spent per category
        const spentMap = {};
        expenseData.forEach(exp => {
          if (!spentMap[exp.category]) spentMap[exp.category] = 0;
          spentMap[exp.category] += Number(exp.amount) || 0;
        });
        
        // Update category budgets with data from the database
        if (budgetData) {
          // Update monthly budget from the database
          setMonthlyBudget(budgetData.monthly_budget_total);
          
          // Update category budgets with values from the database
          setCategoryBudgets(allCategories.map(name => {
            const dbName = name.toLowerCase().replace(' ', '_');
            return {
              name,
              budget: budgetData[dbName] || 200, // Default to 200 if not set
              current: spentMap[name] || 0
            };
          }));
        } else {
          // No budget data found, just update the spending amounts
          setCategoryBudgets(prev =>
            prev.map(cat => ({
              ...cat,
              current: spentMap[cat.name] || 0
            }))
          );
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserBudgetData();
  }, [user, supabase, setMonthlyBudget]);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    if (key === 'currency') {
      setCurrency(value);
    }
  };

  // Update category budget in state
  const handleCategoryBudgetChange = (index, value) => {
    setCategoryBudgets(prev => prev.map((cat, i) =>
      i === index ? { ...cat, budget: Number(value) } : cat
    ));
  };

  const handleSave = async () => {
    if (!user || !supabase) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Convert category budgets to database format
      const budgetData = {};
      categoryBudgets.forEach(cat => {
        const dbName = cat.name.toLowerCase().replace(' ', '_');
        budgetData[dbName] = Number(cat.budget) || 0;
      });
      
      // Add monthly budget total
      budgetData.monthly_budget_total = Number(monthlyBudget) || 0;
      budgetData.user_id = user.id;
      budgetData.updated_at = new Date().toISOString();
      
      // Upsert budget data (insert if not exists, update if exists)
      const { error: upsertError } = await supabase
        .from('budgets')
        .upsert(budgetData, { onConflict: 'user_id' });
        
      if (upsertError) {
        console.error('Error saving budget data:', upsertError);
        setError('Failed to save budget data');
        return;
      }
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Unexpected error saving budget data:', err);
      setError('An unexpected error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your budget goals and app preferences</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Budget Settings */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-6">
            <Target className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold">Budget Settings</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Budget Goal
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-500 font-medium">{symbol}</span>
                <input
                  type="number"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={0}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Set your total spending goal for the month.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overspending Alert Threshold
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  value={settings.overspendingAlert}
                  onChange={(e) => handleSettingChange('overspendingAlert', Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Get notified when you've spent this percentage of your budget
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
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
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-6">
            <Bell className="h-6 w-6 text-purple-600" />
            <h3 className="text-lg font-semibold">Notifications</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Budget Alerts</p>
                <p className="text-sm text-gray-500">Get notified about budget limits</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.budgetAlerts}
                  onChange={(e) => handleSettingChange('budgetAlerts', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Weekly Reports</p>
                <p className="text-sm text-gray-500">Receive weekly spending summaries</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.weeklyReports}
                  onChange={(e) => handleSettingChange('weeklyReports', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">AI Recommendations</p>
                <p className="text-sm text-gray-500">Get personalized saving tips</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.aiRecommendations}
                  onChange={(e) => handleSettingChange('aiRecommendations', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Category Budgets */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
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
                  type="number"
                  value={category.budget}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm ml-4"
                  onChange={e => handleCategoryBudgetChange(idx, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Settings;