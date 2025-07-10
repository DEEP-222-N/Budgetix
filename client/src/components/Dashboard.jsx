import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Target, AlertCircle, Brain } from 'lucide-react';
import ExpenseCard from './ExpenseCard';
import BudgetProgress from './BudgetProgress';

const Dashboard = () => {
  const [expenses, setExpenses] = useState([
    { id: 1, category: 'Food', amount: 450, date: '2024-01-15', description: 'Groceries' },
    { id: 2, category: 'Transport', amount: 120, date: '2024-01-14', description: 'Gas' },
    { id: 3, category: 'Entertainment', amount: 80, date: '2024-01-13', description: 'Movies' },
    { id: 4, category: 'Utilities', amount: 200, date: '2024-01-12', description: 'Electricity' },
    { id: 5, category: 'Healthcare', amount: 150, date: '2024-01-11', description: 'Doctor visit' },
  ]);

  const [monthlyBudget] = useState(2500);
  const [aiRecommendations] = useState([
    "Consider reducing dining out expenses by 20% to save $90/month",
    "Switch to a more fuel-efficient commute to save $40/month",
    "Review subscription services - potential savings of $25/month"
  ]);

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = monthlyBudget - totalSpent;

  const categoryData = expenses.reduce((acc, expense) => {
    const existing = acc.find(item => item.name === expense.category);
    if (existing) {
      existing.value += expense.amount;
    } else {
      acc.push({ name: expense.category, value: expense.amount });
    }
    return acc;
  }, []);

  const monthlyData = [
    { month: 'Jan', spent: 1200, budget: 2500 },
    { month: 'Feb', spent: 1400, budget: 2500 },
    { month: 'Mar', spent: 1100, budget: 2500 },
    { month: 'Apr', spent: 1600, budget: 2500 },
    { month: 'May', spent: totalSpent, budget: monthlyBudget },
  ];

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];

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
              <p className="text-2xl font-bold text-gray-900">${totalSpent.toLocaleString()}</p>
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
              <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${remaining.toLocaleString()}
              </p>
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
              <p className="text-2xl font-bold text-gray-900">${monthlyBudget.toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-gray-900">{Math.round((totalSpent / monthlyBudget) * 100)}%</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Budget Progress */}
      <BudgetProgress spent={totalSpent} budget={monthlyBudget} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
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
              <Tooltip formatter={(value) => `$${value}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Monthly Spending Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="spent" fill="#3B82F6" name="Spent" />
              <Bar dataKey="budget" fill="#E5E7EB" name="Budget" />
            </BarChart>
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
          {expenses.slice(0, 5).map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;