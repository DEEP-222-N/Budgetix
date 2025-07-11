import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { DollarSign, TrendingUp, Target, AlertCircle, Brain } from 'lucide-react';
import ExpenseCard from './ExpenseCard';
import BudgetProgress from './BudgetProgress';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { useBudget } from '../context/BudgetContext';

const Dashboard = () => {
  const { user } = useAuth();
  const { monthlyBudget, loading: budgetLoading } = useBudget();
  const [aiRecommendations] = useState([
    "Consider reducing dining out expenses by 20% to save $90/month",
    "Switch to a more fuel-efficient commute to save $40/month",
    "Review subscription services - potential savings of $25/month"
  ]);
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState(null);
  const [showAllModal, setShowAllModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '' });

  // Month and year dropdown state
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const { symbol } = useCurrency();

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
        .order('date', { ascending: false })
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

  // Get unique years from expenses
  const years = React.useMemo(() => {
    const set = new Set(expenses.map(e => new Date(e.date).getFullYear()));
    return ['All', ...Array.from(set).sort((a, b) => b - a)];
  }, [expenses]);

  // Months
  const months = ['All', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Filtered expenses by month/year
  const filteredExpensesForGraphs = React.useMemo(() => {
    return expenses.filter(e => {
      const date = new Date(e.date);
      const yearMatch = selectedYear === 'All' || date.getFullYear().toString() === selectedYear.toString();
      const monthMatch = selectedMonth === 'All' || (date.getMonth() + 1) === (months.indexOf(selectedMonth));
      return yearMatch && monthMatch;
    });
  }, [expenses, selectedMonth, selectedYear]);

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
    const year = selectedYear === 'All' ? new Date().getFullYear() : parseInt(selectedYear);
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: months[i + 1],
      spent: 0,
      budget: monthlyBudget
    }));
    expenses.forEach(exp => {
      const date = new Date(exp.date);
      if ((selectedYear === 'All' || date.getFullYear() === year)) {
        const m = date.getMonth();
        data[m].spent += Number(exp.amount) || 0;
      }
    });
    return data;
  }, [expenses, selectedYear, monthlyBudget]);

  // Calculate spent for selected period
  const totalSpent = React.useMemo(() => {
    return filteredExpensesForGraphs.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [filteredExpensesForGraphs]);
  const remaining = monthlyBudget ? monthlyBudget - totalSpent : 0;
  const budgetUsage = monthlyBudget && monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;

  // TODO: If you want to show charts based on real expenses, fetch and process them in a higher-level component or context.
  // For now, only the ExpensesList below will show real user expenses.

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];

  const monthlyData = [
    { month: 'Jan', spent: 1200, budget: 2500 },
    { month: 'Feb', spent: 1400, budget: 2500 },
    { month: 'Mar', spent: 1100, budget: 2500 },
    { month: 'Apr', spent: 1600, budget: 2500 },
    { month: 'May', spent: 0, budget: monthlyBudget },
  ];

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

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Dashboard</h1>
        <p className="text-gray-600">Track your expenses and optimize your budget with AI insights</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">{symbol}{totalSpent.toLocaleString()}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Remaining</p>
              <p className="text-2xl font-bold text-green-600">{symbol}{remaining.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Budget</p>
              {budgetLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                  <span className="text-gray-500">Loading...</span>
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-900">
                  {monthlyBudget !== null ? `${symbol}${monthlyBudget.toLocaleString()}` : "--"}
                </p>
              )}
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Budget Usage</p>
              <p className="text-2xl font-bold text-gray-900">{budgetUsage.toFixed(0)}%</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Budget Progress */}
      <BudgetProgress spent={totalSpent} budget={monthlyBudget || 0} />

      {/* Charts Parent with Dropdowns */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {months.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
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
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Distribution by Payment Method</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentMethodData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${symbol}${value}`} />
                <Bar dataKey="value" fill="#8B5CF6" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Line Chart for Monthly Spent and Budget */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-4">Monthly Spent vs Budget</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyLineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `${symbol}${value}`} />
              <Legend />
              <Line type="monotone" dataKey="spent" stroke="#3B82F6" name="Spent" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="budget" stroke="#F59E0B" name="Budget" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <div className="flex items-center space-x-2 mb-4">
          <Brain className="h-6 w-6 text-purple-600" />
          <h3 className="text-lg font-semibold">AI Recommendations</h3>
        </div>
        <div className="space-y-3">
          {aiRecommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
              <div className="bg-purple-100 p-1 rounded-full mt-1">
                <AlertCircle className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-gray-700">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">Recent Expenses</h3>
        <div className="space-y-3">
          {expensesLoading ? (
            <div className="text-center py-8 text-gray-500">Loading expenses...</div>
          ) : expensesError ? (
            <div className="text-center py-8 text-red-500">{expensesError}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No expenses added yet.</p>
              <p className="text-sm">Add your first expense to see it here!</p>
            </div>
          ) : (
            [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} />
            ))
          )}
        </div>
        <div className="flex justify-center mt-4">
          <button
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white font-semibold shadow-md hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all duration-300"
            onClick={() => setShowAllModal(true)}
            disabled={expenses.length === 0}
          >
            View All
          </button>
        </div>
      </div>
      {/* All Expenses Modal */}
      {showAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative max-h-[80vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              onClick={() => setShowAllModal(false)}
            >
              Close
            </button>
            <h2 className="text-2xl font-bold mb-4">All Expenses</h2>
            <input
              type="text"
              placeholder="Search by description or category..."
              className="w-full mb-4 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="space-y-3">
              {expensesLoading ? (
                <div className="text-center py-8 text-gray-500">Loading expenses...</div>
              ) : expensesError ? (
                <div className="text-center py-8 text-red-500">{expensesError}</div>
              ) : filteredExpenses(expenses, searchTerm).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No expenses found.</p>
                </div>
              ) : (
                filteredExpenses(expenses, searchTerm).map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    {editingId === expense.id ? (
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2">
                        <input
                          className="border rounded px-2 py-1 mr-2"
                          value={editForm.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          placeholder={expense.description || 'Description'}
                        />
                        <input
                          className="border rounded px-2 py-1 mr-2 w-24"
                          type="number"
                          value={editForm.amount}
                          onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder={expense.amount !== undefined ? expense.amount : 'Amount'}
                        />
                        <div className="flex gap-2 mt-2 md:mt-0">
                          <button
                            className="px-4 py-1 rounded-lg bg-green-600 text-white font-semibold text-sm shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                            onClick={() => handleSaveEdit(expense.id)}
                          >
                            Save
                          </button>
                          <button
                            className="px-4 py-1 rounded-lg bg-gray-300 text-gray-800 font-semibold text-sm shadow hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ExpenseCard expense={expense} />
                        <div className="flex flex-row gap-2 ml-4 mt-2 md:mt-0">
                          <button
                            className="px-4 py-1 rounded-lg bg-red-600 text-white font-semibold text-sm shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                            onClick={() => handleDeleteExpense(expense.id)}
                          >
                            Delete
                          </button>
                          <button
                            className="px-4 py-1 rounded-lg bg-yellow-400 text-gray-900 font-semibold text-sm shadow hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition"
                            onClick={() => handleStartEdit(expense)}
                          >
                            Update
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
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