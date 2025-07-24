import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, Search, X } from 'lucide-react';

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
      
      // Update total expenses in financial_overview after deletion
      try {
        const { data: updatedData, error: updateError } = await supabase
          .rpc('update_total_expenses', { user_id_param: user.id });
          
        if (updateError) {
          console.error('Error updating total expenses after deletion:', updateError);
        } else {
          console.log('Total expenses updated successfully after deletion:', updatedData);
        }
      } catch (updateError) {
        console.error('Error calling update_total_expenses function after deletion:', updateError);
      }
      // Decrement BudgeXP points by 1 (not below 0)
      try {
        const { data: xpData, error: xpFetchError } = await supabase
          .from('financial_overview')
          .select('budgexp_points')
          .eq('user_id', user.id)
          .single();
        if (xpFetchError) {
          console.error('Error fetching BudgeXP points:', xpFetchError);
        } else {
          const currentXP = xpData?.budgexp_points || 0;
          const newXP = currentXP > 0 ? currentXP - 1 : 0;
          const { error: xpUpdateError } = await supabase
            .from('financial_overview')
            .update({ budgexp_points: newXP })
            .eq('user_id', user.id);
          if (xpUpdateError) {
            console.error('Error decrementing BudgeXP points:', xpUpdateError);
          }
        }
      } catch (xpError) {
        console.error('Error decrementing BudgeXP points:', xpError);
      }
    } else {
      alert('Failed to delete expense.');
    }
  }

  // Start editing
  function handleStartEdit(expense) {
    setEditingId(expense.id);
    setEditForm({
      description: expense.description,
      amount: expense.amount,
      recurring_end_date: expense.recurring_end_date || ''
    });
  }

  // Save edit
  async function handleSaveEdit(id) {
    const updateData = {
      description: editForm.description,
      amount: parseFloat(editForm.amount)
    };
    if (editForm.recurring_end_date !== undefined) {
      updateData.recurring_end_date = editForm.recurring_end_date;
    }
    const { error } = await supabase.from('expenses').update(updateData).eq('id', id);
    if (!error) {
      setExpenses(expenses => expenses.map(e => e.id === id ? { ...e, ...updateData } : e));
      setEditingId(null);
      
      // Update total expenses in financial_overview after editing
      try {
        const { data: updatedData, error: updateError } = await supabase
          .rpc('update_total_expenses', { user_id_param: user.id });
          
        if (updateError) {
          console.error('Error updating total expenses after edit:', updateError);
        } else {
          console.log('Total expenses updated successfully after edit:', updatedData);
        }
      } catch (updateError) {
        console.error('Error calling update_total_expenses function after edit:', updateError);
      }
    } else {
      alert('Failed to update expense.');
    }
  }

  // Check if all data is loaded (after all hooks)
  const isDataLoaded = !expensesLoading && user;

  // Show loading screen until all data is ready
  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Expenses</h2>
          <p className="text-gray-500">Please wait while we fetch your expense data...</p>
        </div>
      </div>
    );
  }

  // Function to get category color class
  const getCategoryColor = (category) => {
    const colors = {
      Food: 'bg-green-100',
      Grocery: 'bg-yellow-100',
      Education: 'bg-blue-100',
      'Transportation and Fuel': 'bg-cyan-100',
      Transportation: 'bg-cyan-100',
      Entertainment: 'bg-purple-100',
      Housing: 'bg-pink-100',
      Utilities: 'bg-orange-100',
      Healthcare: 'bg-red-100',
      Shopping: 'bg-indigo-100',
      'Personal Care': 'bg-teal-100',
      Travel: 'bg-fuchsia-100',
      Other: 'bg-gray-200',
      default: 'bg-gray-100'
    };
    return colors[category] || colors.default;
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <button
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white font-semibold shadow-md hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all duration-300"
          onClick={() => navigate('/')}
        >
          ← Back to Dashboard
        </button>
        <h2 className="text-2xl font-bold">All Expenses</h2>
      </div>
      
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by description or category..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 shadow-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button 
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setSearchTerm('')}
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>
      
      {expensesError ? (
        <div className="text-center py-8 text-red-500">{expensesError}</div>
      ) : filteredExpenses(expenses, searchTerm).length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-gray-500 font-medium">No expenses found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExpenses(expenses, searchTerm).map((expense) => (
            <div key={expense.id} className="border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              {editingId === expense.id ? (
                <div className="p-4 bg-white">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Description"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        type="number"
                        value={editForm.amount}
                        onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="Amount"
                      />
                    </div>
                    {/* Recurring End Date field for recurring expenses */}
                    {expense.is_recurring && (
                      <div className="w-56">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Recurring End Date</label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          type="date"
                          value={editForm.recurring_end_date || ''}
                          onChange={e => setEditForm(f => ({ ...f, recurring_end_date: e.target.value }))}
                          placeholder="Recurring End Date"
                        />
                      </div>
                    )}
                    <div className="flex gap-2 self-end">
                      <button
                        className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                        onClick={() => handleSaveEdit(expense.id)}
                      >
                        Save
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-medium text-sm shadow hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 transition"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 sm:mb-0">
                    <div className={`${getCategoryColor(expense.category)} px-4 py-2 rounded-full text-sm font-medium w-fit`}>
                      {expense.category}
                      {expense.is_recurring && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200 align-middle">Recurring</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-lg">{expense.description}</p>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(expense.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    <p className="text-lg font-bold text-gray-900">{symbol}{expense.amount.toLocaleString()}</p>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 rounded-lg bg-yellow-400 text-gray-900 font-medium text-sm shadow hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition"
                        onClick={() => handleStartEdit(expense)}
                      >
                        Update
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium text-sm shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                        onClick={() => handleDeleteExpense(expense.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllExpenses; 