import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, Search, X, TrendingUp, Filter, Edit3, Trash2, ArrowLeft, Save, XCircle, ChevronUp, ChevronDown } from 'lucide-react';

const AllExpenses = () => {
  const { user } = useAuth();
  const { symbol } = useCurrency();
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '' });
  const [isMinimized, setIsMinimized] = useState(false);
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
      <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center py-20">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-purple-600 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Loading Your Expenses</h2>
          <p className="text-gray-600 max-w-md mx-auto">We're fetching your financial data to give you a complete overview of your spending patterns.</p>
        </div>
      </div>
    );
  }

  // Function to get category color class
  const getCategoryColor = (category) => {
    const colors = {
      Food: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Grocery: 'bg-amber-50 text-amber-700 border-amber-200',
      Education: 'bg-blue-50 text-blue-700 border-blue-200',
      'Transportation and Fuel': 'bg-cyan-50 text-cyan-700 border-cyan-200',
      Transportation: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      Entertainment: 'bg-violet-50 text-violet-700 border-violet-200',
      Housing: 'bg-rose-50 text-rose-700 border-rose-200',
      Utilities: 'bg-orange-50 text-orange-700 border-orange-200',
      Healthcare: 'bg-red-50 text-red-700 border-red-200',
      Shopping: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Personal Care': 'bg-teal-50 text-teal-700 border-teal-200',
      Travel: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
      Other: 'bg-gray-50 text-gray-700 border-gray-200',
      default: 'bg-gray-50 text-gray-700 border-gray-200'
    };
    return colors[category] || colors.default;
  };

  const totalExpenses = filteredExpenses(expenses, searchTerm).reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-gray-700 font-medium shadow-sm border border-gray-200 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 group"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
              Back to Dashboard
            </button>
            <div className="text-center sm:text-right">
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Expense Management</h1>
              <p className="text-gray-600">Track and manage all your expenses in one place</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-gray-900">{symbol}{totalExpenses.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredExpenses(expenses, searchTerm).length}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                  <Filter className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average per Transaction</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredExpenses(expenses, searchTerm).length > 0 
                      ? `${symbol}${(totalExpenses / filteredExpenses(expenses, searchTerm).length).toFixed(2)}`
                      : `${symbol}0.00`
                    }
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">₹</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search expenses by description or category..."
              className="w-full pl-12 pr-12 py-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 shadow-sm text-gray-900 placeholder-gray-500 transition-all duration-200"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        
        {/* Minimize Toggle Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-700 font-medium shadow-sm border border-gray-200 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
          >
            {isMinimized ? (
              <>
                <ChevronDown className="h-5 w-5" />
                Show Expense Details
              </>
            ) : (
              <>
                <ChevronUp className="h-5 w-5" />
                Minimize Expense List
              </>
            )}
          </button>
        </div>

        {/* Expenses List */}
        {!isMinimized && (
          <>
            {expensesError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Expenses</h3>
            <p className="text-red-600">{expensesError}</p>
          </div>
        ) : filteredExpenses(expenses, searchTerm).length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No expenses found</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {searchTerm ? `No expenses match your search for "${searchTerm}". Try adjusting your search terms.` : 'Start adding expenses to see them appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExpenses(expenses, searchTerm).map((expense) => (
              <div key={expense.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200">
                {editingId === expense.id ? (
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                        <input
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                          value={editForm.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Enter description"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                        <input
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                          type="number"
                          value={editForm.amount}
                          onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                      {expense.is_recurring && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Recurring End Date</label>
                          <input
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                            type="date"
                            value={editForm.recurring_end_date || ''}
                            onChange={e => setEditForm(f => ({ ...f, recurring_end_date: e.target.value }))}
                          />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button
                          className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-sm hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2"
                          onClick={() => handleSaveEdit(expense.id)}
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </button>
                        <button
                          className="px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2"
                          onClick={() => setEditingId(null)}
                        >
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                        <div className={`${getCategoryColor(expense.category)} px-4 py-2.5 rounded-full text-sm font-semibold border flex items-center gap-2`}>
                          <span>{expense.category}</span>
                          {expense.is_recurring && (
                            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">
                              Recurring
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">
                            {expense.description || 'No description'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(expense.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                                 <div className="text-right">
                           <p className="text-lg font-bold text-gray-900">{symbol}{expense.amount.toLocaleString()}</p>
                         </div>
                                                 <div className="flex gap-2">
                           <button
                             className="p-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-gray-900 shadow-sm hover:from-amber-500 hover:to-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-200"
                             onClick={() => handleStartEdit(expense)}
                             title="Edit expense"
                           >
                             <Edit3 className="h-4 w-4" />
                           </button>
                           <button
                             className="p-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                             onClick={() => handleDeleteExpense(expense.id)}
                             title="Delete expense"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                         </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
          </>
        )}

        {/* Minimized Summary View */}
        {isMinimized && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Expense Summary</h3>
                <p className="text-sm text-gray-600">Click below to view detailed expenses</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{filteredExpenses(expenses, searchTerm).length}</p>
                <p className="text-sm text-gray-600">Total Transactions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{symbol}{totalExpenses.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Amount</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {filteredExpenses(expenses, searchTerm).length > 0 
                    ? `${symbol}${(totalExpenses / filteredExpenses(expenses, searchTerm).length).toFixed(2)}`
                    : `${symbol}0.00`
                  }
                </p>
                <p className="text-sm text-gray-600">Average</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllExpenses; 