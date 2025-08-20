import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Wallet, TrendingUp, Target, AlertCircle, Brain, Sparkles, Loader2, Save, X, Calendar, Percent, BarChart3, ChevronDown, PieChart as PieChartIcon, FileText } from 'lucide-react';
import ExpenseCard from './ExpenseCard';
import BudgetProgress from './BudgetProgress';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { useBudget } from '../context/BudgetContext';
import { useNavigate } from 'react-router-dom';

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

const Dashboard = () => {
  const { user } = useAuth();
  const { monthlyBudget, setMonthlyBudget, loading: budgetLoading } = useBudget();
const [extraIncomes, setExtraIncomes] = useState({});
const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

// Helper to get key for month/year
const getMonthKey = (month, year) => `${year}-${String(month + 1).padStart(2, '0')}`;
// Get extra incomes for selected month
const getCurrentMonthExtraIncomes = () => {
  const key = getMonthKey(selectedMonth, selectedYear);
  return extraIncomes[key] || [];
};
// Fetch extra incomes from Supabase
useEffect(() => {
  if (!user) return;
  const fetchExtraIncomes = async () => {
    const { data, error } = await supabase
      .from('budgets')
      .select('budget_month, budget_year, extra_income_amount, extra_income_source')
      .eq('user_id', user.id);
    if (!error && data) {
      const incomes = {};
      data.forEach(row => {
        const key = getMonthKey(
          [
            'January','February','March','April','May','June','July','August','September','October','November','December'
          ].indexOf(row.budget_month),
          row.budget_year
        );
        if (row.extra_income_amount && Number(row.extra_income_amount) > 0) {
          incomes[key] = [{
            label: row.extra_income_source || 'Extra',
            amount: Number(row.extra_income_amount)
          }];
        }
      });
      setExtraIncomes(incomes);
    }
  };
  fetchExtraIncomes();
}, [user]);
  const [aiRecommendations] = useState([
    "Consider reducing dining out expenses by 20% to save $90/month",
    "Switch to a more fuel-efficient commute to save $40/month",
    "Review subscription services - potential savings of $25/month"
  ]);
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState(null);
  const [budgetsByMonth, setBudgetsByMonth] = useState({});
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsError, setBudgetsError] = useState(null);
  const [showAllModal, setShowAllModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '' });

  // Budget Manager States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiPromptResponse, setAiPromptResponse] = useState(null);
  const [customBudget, setCustomBudget] = useState(null);
  const [customBudgetLoading, setCustomBudgetLoading] = useState(false);
  const [customBudgetError, setCustomBudgetError] = useState('');
  const [autoFillPrompt, setAutoFillPrompt] = useState(false);
  const [autoFillDone, setAutoFillDone] = useState(false);
  const [autoFillDeclined, setAutoFillDeclined] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
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



  // Month and year dropdown state for charts
  const [selectedYearChart, setSelectedYearChart] = useState('All');
  const { symbol } = useCurrency();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!user) {
        console.log('No user logged in');
        return;
      }
      setExpensesLoading(true);
      setExpensesError(null);
      console.log('Fetching expenses for user_id:', user.id);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        console.error('Supabase error:', error);
        setExpensesError('Failed to load expenses.');
        setExpenses([]);
      } else {
        console.log('Fetched expenses:', data);
        setExpenses(data || []);
      }
      setExpensesLoading(false);
    };
    fetchExpenses();
  }, [user]);

  // Fetch budgets for the selected year so the line chart uses per-month values
  useEffect(() => {
    const fetchBudgetsForYear = async () => {
      if (!user) return;
      setBudgetsLoading(true);
      setBudgetsError(null);
      try {
        const year = selectedYearChart === 'All' ? new Date().getFullYear() : parseInt(selectedYearChart);
        const { data, error } = await supabase
          .from('budgets')
          .select('budget_month, budget_year, monthly_budget_total')
          .eq('user_id', user.id)
          .eq('budget_year', year);
        if (error) {
          setBudgetsError('Failed to load budgets');
          setBudgetsByMonth({});
                 } else {
           const map = {};
           const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
           (data || []).forEach(row => {
             if (!row.budget_month) return;
             const monthIndex = monthNames.indexOf(row.budget_month);
             if (monthIndex >= 0) { // 0-based index for Jan..Dec
               map[monthIndex] = Number(row.monthly_budget_total) || 0;
             }
           });
           setBudgetsByMonth(map);
         }
      } catch (e) {
        setBudgetsError('Failed to load budgets');
        setBudgetsByMonth({});
      } finally {
        setBudgetsLoading(false);
      }
    };
    fetchBudgetsForYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedYearChart]);

  // Get unique years from expenses
  const years = React.useMemo(() => {
    const set = new Set(expenses.map(e => new Date(e.date).getFullYear()));
    return ['All', ...Array.from(set).sort((a, b) => b - a)];
  }, [expenses]);



  // Filtered expenses by year
  const filteredExpensesForGraphs = React.useMemo(() => {
    return expenses.filter(e => {
      const date = new Date(e.date);
      const yearMatch = selectedYearChart === 'All' || date.getFullYear().toString() === selectedYearChart.toString();
      return yearMatch;
    });
  }, [expenses, selectedYearChart]);

  // Calculate category breakdown for PieChart (filtered)
  const categoryData = React.useMemo(() => {
    const map = {};
    filteredExpensesForGraphs.forEach(exp => {
      if (!exp.category) return;
      if (!map[exp.category]) map[exp.category] = 0;
      map[exp.category] += Number(exp.amount) || 0;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredExpensesForGraphs]);

  // Calculate payment method distribution for BarChart (filtered)
  const paymentMethodData = React.useMemo(() => {
    const map = {};
    filteredExpensesForGraphs.forEach(exp => {
      if (!exp.payment_method) return;
      if (!map[exp.payment_method]) map[exp.payment_method] = 0;
      map[exp.payment_method] += Number(exp.amount) || 0;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredExpensesForGraphs]);

  // Calculate monthly spent for the selected year
  const monthlyLineData = React.useMemo(() => {
    // Get months for the selected year
    const year = selectedYearChart === 'All' ? new Date().getFullYear() : parseInt(selectedYearChart);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Initialize data with base budgets
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: monthNames[i],
      spent: 0,
      budget: budgetsByMonth[i] ?? 0
    }));
    
    // Add extra income to the budget for each month
    Object.entries(extraIncomes).forEach(([key, incomes]) => {
      const [yearStr, monthStr] = key.split('-');
      const monthIndex = parseInt(monthStr) - 1; // Convert to 0-based index
      const monthYear = parseInt(yearStr);
      
      if (selectedYearChart === 'All' || monthYear === parseInt(selectedYearChart)) {
        const extra = incomes.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
        data[monthIndex].budget = (data[monthIndex].budget || 0) + extra;
      }
    });
    
    // Filter expenses by year only
    expenses.forEach(exp => {
      const date = new Date(exp.date);
      const yearMatch = selectedYearChart === 'All' || date.getFullYear() === year;
      
      if (yearMatch) {
        const m = date.getMonth();
        data[m].spent += Number(exp.amount) || 0;
      }
    });
    
    return data;
  }, [expenses, selectedYearChart, budgetsByMonth]);

  // Calculate spent for selected period
  const totalSpent = React.useMemo(() => {
    return filteredExpensesForGraphs.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [filteredExpensesForGraphs]);
  
  // Get extra income for current month and calculate total budget
  const extra = getCurrentMonthExtraIncomes().reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
  const totalBudget = (Number(monthlyBudget) || 0) + extra;
  const remaining = totalBudget - totalSpent;
  const budgetUsage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];

  // Delete expense handler
  async function handleDeleteExpense(id) {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      setExpenses(expenses => expenses.filter(e => e.id !== id));
    } else {
      alert('Failed to delete expense.');
    }
  }

  // Start editing
  function handleStartEdit(expense) {
    setEditingId(expense.id);
    setEditForm({ description: expense.description, amount: expense.amount });
  }

  // Save edit
  async function handleSaveEdit(id) {
    const { error } = await supabase.from('expenses').update({ description: editForm.description, amount: parseFloat(editForm.amount) }).eq('id', id);
    if (!error) {
      setExpenses(expenses => expenses.map(e => e.id === id ? { ...e, description: editForm.description, amount: parseFloat(editForm.amount) } : e));
      setEditingId(null);
    } else {
      alert('Failed to update expense.');
    }
  }

  // Check if all data is loaded (after all hooks)
  const isDataLoaded = !expensesLoading && !budgetLoading && !budgetsLoading && user;

  // Show loading screen until all data is ready
  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Dashboard</h2>
          <p className="text-gray-500">Please wait while we fetch your financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Dashboard</h1>
        <p className="text-gray-600">Track your expenses and optimize your budget with AI insights</p>
      </div>

      

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Spent Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">{symbol}{totalSpent.toLocaleString()}</p>
              <p className="text-xs text-blue-600 font-medium mt-1">This Month</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Wallet className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Remaining Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Remaining</p>
              <p className={`text-2xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {symbol}{remaining.toLocaleString()}
              </p>
              <p className={`text-xs font-medium mt-1 ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {remaining < 0 ? 'Over Budget' : 'Available'}
              </p>
            </div>
            <div className={`p-3 rounded-full ${remaining < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              <TrendingUp className={`h-6 w-6 ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </div>
        </div>

        {/* Monthly Budget Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Monthly Budget</p>
              {(() => {
  const extra = getCurrentMonthExtraIncomes().reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
  const total = (Number(monthlyBudget) || 0) + extra;
  return (
    <div>
      <span className="text-2xl font-bold text-gray-900">{symbol}{total.toLocaleString()}</span>
      <div className="text-xs text-gray-500 mt-1">(Base: {symbol}{(Number(monthlyBudget)||0).toLocaleString()} + Extra: {symbol}{extra.toLocaleString()})</div>
    </div>
  );
})()}
              <p className="text-xs text-purple-600 font-medium mt-1">Target</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Budget Usage Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Budget Usage</p>
              <p className="text-2xl font-bold text-gray-900">{budgetUsage.toFixed(0)}%</p>
              <p className="text-xs text-orange-600 font-medium mt-1">
                {budgetUsage > 80 ? 'High Usage' : budgetUsage > 50 ? 'Moderate' : 'Low Usage'}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Budget Progress */}
      <BudgetProgress spent={totalSpent} budget={totalBudget} />

      {/* Enhanced Charts Section with Beautiful UI */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-white p-8 rounded-2xl shadow-xl border border-gray-200 mb-8 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-transparent to-blue-50/30 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100/20 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-100/20 to-transparent rounded-full blur-2xl"></div>
        
        {/* Enhanced Header */}
        <div className="relative z-10 mb-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-white shadow-lg">
              <BarChart3 className="h-5 w-5" />
              <span className="font-semibold">Financial Analytics Dashboard</span>
            </div>
            <p className="text-gray-600 mt-3">Visualize your spending patterns and budget insights</p>
          </div>
          
          
          
          
        </div>

        {/* Enhanced Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 relative z-10">
          {/* Enhanced Pie Chart Container */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center">
                <PieChartIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Expense Breakdown</h3>
                <p className="text-sm text-gray-600">Category-wise spending distribution</p>
              </div>
            </div>
            
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${symbol}${value}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PieChartIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No data available</p>
                  <p className="text-sm text-gray-400">Add expenses to see category breakdown</p>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Bar Chart Container */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Payment Methods</h3>
                <p className="text-sm text-gray-600">Spending by payment type</p>
              </div>
            </div>
            
            {paymentMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={paymentMethodData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    formatter={(value) => `${symbol}${value}`}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="url(#paymentGradient)" 
                    name="Amount"
                    radius={[4, 4, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="paymentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No data available</p>
                  <p className="text-sm text-gray-400">Add expenses to see payment method distribution</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Line Chart Container */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Monthly Trends</h3>
              <p className="text-sm text-gray-600">Spending vs Budget over time</p>
            </div>
          </div>
          
          {monthlyLineData.some(d => d.spent > 0 || d.budget > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  formatter={(value) => `${symbol}${value}`}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend 
                  wrapperStyle={{
                    paddingTop: '20px',
                    fontSize: '14px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="spent" 
                  stroke="#3B82F6" 
                  name="Spent" 
                  strokeWidth={3} 
                  dot={{ r: 6, fill: '#3B82F6', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 8, fill: '#3B82F6', stroke: '#ffffff', strokeWidth: 3 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="budget" 
                  stroke="#F59E0B" 
                  name="Budget" 
                  strokeWidth={3} 
                  dot={false}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No data available</p>
                <p className="text-sm text-gray-400">Add expenses and set budgets to see trends</p>
              </div>
            </div>
          )}
        </div>
      </div>

             {/* Recent Expenses */}
       <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
         {/* Header with gradient background */}
         <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-purple-500 px-8 py-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Recent Expenses</h3>
                <p className="text-indigo-100 text-sm">Track your latest financial activities</p>
              </div>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm">
              <span className="text-white text-sm font-medium">{expenses.length} transactions</span>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="p-8">
          {expensesError ? (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-700 font-medium">{expensesError}</p>
              </div>
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 max-w-md mx-auto">
                <div className="bg-gray-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <Wallet className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-700 mb-2">No expenses yet</h4>
                <p className="text-gray-500 text-sm mb-4">Start tracking your expenses to see them here</p>
                <button
                  onClick={() => navigate('/add-expense')}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all duration-200 shadow-md"
                >
                  Add First Expense
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.slice(0, 5).map((expense, index) => (
                <div key={expense.id} className="group">
                  <ExpenseCard key={expense.id} expense={expense} />
                </div>
              ))}
            </div>
          )}

          {/* Enhanced View All Button */}
          {expenses.length > 0 && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center space-x-2">
                <button
                  className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-lg hover:bg-purple-700 hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300"
                  onClick={() => navigate('/all-expenses')}
                >
                  <span className="flex items-center space-x-2">
                    <span>View All Expenses</span>
                    <TrendingUp className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-3">View and manage all your expense records</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

// Helper function for filtering
function filteredExpenses(expenses, searchTerm) {
  if (!searchTerm) return expenses;
  return expenses.filter(exp =>
    (exp.description && exp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (exp.category && exp.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );
}