import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import ExpenseCard from './ExpenseCard';
import { useNavigate } from 'react-router-dom';

const AllExpenses = () => {
  const { user } = useAuth();
  const { symbol } = useCurrency();
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!user) return;
      setExpensesLoading(true);
      setExpensesError(null);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (error) {
        setExpensesError('Failed to load expenses.');
        setExpenses([]);
      } else {
        setExpenses(data || []);
      }
      setExpensesLoading(false);
    };
    fetchExpenses();
  }, [user]);

  function filteredExpenses(expenses, searchTerm) {
    if (!searchTerm) return expenses;
    return expenses.filter(exp =>
      (exp.description && exp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exp.category && exp.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Delete expense
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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <button
        className="mb-6 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white font-semibold shadow-md hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all duration-300"
        onClick={() => navigate('/')}
      >
        ← Back to Dashboard
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
  );
};

export default AllExpenses; 