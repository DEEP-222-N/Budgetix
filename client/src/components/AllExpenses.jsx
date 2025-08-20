import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, Search, X, TrendingUp, Filter, Edit3, Trash2, ArrowLeft, Save, XCircle, ChevronUp, ChevronDown, DollarSign, Receipt } from 'lucide-react';

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
    // Validate input data
    if (!editForm.description || !editForm.description.trim()) {
      alert('Please enter a description for the expense.');
      return;
    }
    
    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    const updateData = {
      description: editForm.description.trim(),
      amount: amount
    };
    
    if (editForm.recurring_end_date !== undefined && editForm.recurring_end_date !== '') {
      updateData.recurring_end_date = editForm.recurring_end_date;
    }

    try {
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
        console.error('Supabase update error:', error);
        alert(`Failed to update expense: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Exception during update:', error);
      alert(`Failed to update expense: ${error.message || 'Unknown error'}`);
    }
  }

  // Check if all data is loaded (after all hooks)
  const isDataLoaded = !expensesLoading && user;

  // Show loading screen until all data is ready
  if (!isDataLoaded) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center min-h-screen">
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
      Food: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200',
      Grocery: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700 border-amber-200',
      Education: 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border-blue-200',
      'Transportation and Fuel': 'bg-gradient-to-br from-cyan-50 to-cyan-100 text-cyan-700 border-cyan-200',
      Transportation: 'bg-gradient-to-br from-cyan-50 to-cyan-100 text-cyan-700 border-cyan-200',
      Entertainment: 'bg-gradient-to-br from-violet-50 to-violet-100 text-violet-700 border-violet-200',
      Housing: 'bg-gradient-to-br from-rose-50 to-rose-100 text-rose-700 border-rose-200',
      Utilities: 'bg-gradient-to-br from-orange-50 to-orange-100 text-orange-700 border-orange-200',
      Healthcare: 'bg-gradient-to-br from-red-50 to-red-100 text-red-700 border-red-200',
      Shopping: 'bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200',
      'Personal Care': 'bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 border-teal-200',
      Travel: 'bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
      Other: 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 border-gray-200',
      default: 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 border-gray-200'
    };
    return colors[category] || colors.default;
  };

  const totalExpenses = filteredExpenses(expenses, searchTerm).reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-gray-700 font-medium shadow-md border border-gray-200 hover:bg-gray-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-200 group"
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

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Expenses</p>
                  <p className="text-2xl font-bold text-gray-900">{symbol}{totalExpenses.toLocaleString()}</p>
                  <p className="text-xs text-red-600 font-medium">All Time</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredExpenses(expenses, searchTerm).length}</p>
                  <p className="text-xs text-blue-600 font-medium">Records</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                  <Filter className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Average per Transaction</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredExpenses(expenses, searchTerm).length > 0 
                      ? `${symbol}${(totalExpenses / filteredExpenses(expenses, searchTerm).length).toFixed(2)}`
                      : `${symbol}0.00`
                    }
                  </p>
                  <p className="text-xs text-green-600 font-medium">Per Record</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

                {/* Enhanced Search Section */}
        <div className="bg-gradient-to-br from-white via-gray-50/50 to-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/20 via-transparent to-blue-50/20 pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-100/20 to-transparent rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Search Expenses</h3>
              <p className="text-sm text-gray-600">Find specific expenses quickly</p>
            </div>
            
            <div className="relative max-w-2xl mx-auto">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-purple-500" />
              </div>
              <input
                type="text"
                placeholder="Search expenses by description or category..."
                className="w-full pl-14 pr-14 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 bg-white shadow-sm text-gray-900 placeholder-gray-500 transition-all duration-300 text-base"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-400 hover:text-purple-600 transition-colors duration-200"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-5 w-6 hover:scale-110 transition-transform duration-200" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Enhanced Minimize Toggle Button */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 text-white font-semibold shadow-xl hover:shadow-2xl hover:from-purple-700 hover:via-purple-600 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1"
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              
              {/* Icon with animation */}
              <div className="relative z-10">
                {isMinimized ? (
                  <ChevronDown className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                ) : (
                  <ChevronUp className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                )}
              </div>
              
              {/* Text */}
              <span className="relative z-10">
                {isMinimized ? 'Show Expense Details' : 'Minimize Expense List'}
              </span>
              
              {/* Subtle glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400/20 via-transparent to-purple-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </button>
          </div>
        </div>

        {/* Enhanced Expenses List */}
        {!isMinimized && (
          <>
            {expensesError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center shadow-lg">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Expenses</h3>
                <p className="text-red-600">{expensesError}</p>
              </div>
            ) : filteredExpenses(expenses, searchTerm).length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-lg border border-gray-100">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No expenses found</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  {searchTerm ? `No expenses match your search for "${searchTerm}". Try adjusting your search terms.` : 'Start adding expenses to see them appear here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4 bg-gradient-to-br from-gray-50/50 via-white to-purple-50/30 p-6 rounded-2xl border border-gray-100 shadow-sm">
                {filteredExpenses(expenses, searchTerm).map((expense) => (
                   <div key={expense.id} className="bg-gradient-to-br from-white via-gray-50 to-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl hover:scale-[1.01] hover:border-purple-300 transition-all duration-300 transform hover:-translate-y-1 relative group">
                     {/* Enhanced top accent line with gradient */}
                     <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getCategoryColor(expense.category).replace('bg-gradient-to-br from-', 'from-').replace(' to-', ' to-')} opacity-90`}></div>
                     
                     {/* Subtle background pattern */}
                     <div className="absolute inset-0 bg-gradient-to-br from-purple-50/20 via-transparent to-blue-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                     
                     {editingId === expense.id ? (
                       <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 relative z-10">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-2">
                               Description <span className="text-red-500">*</span>
                             </label>
                             <input
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all duration-200 text-sm"
                               value={editForm.description}
                               onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                               placeholder="Enter description"
                               required
                               minLength={1}
                             />
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-2">
                               Amount <span className="text-red-500">*</span>
                             </label>
                             <input
                               className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all duration-200 text-sm"
                               type="number"
                               value={editForm.amount}
                               onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                               placeholder="0.00"
                               required
                               min="0.01"
                               step="0.01"
                             />
                           </div>
                           {expense.is_recurring && (
                             <div>
                               <label className="block text-sm font-medium text-gray-700 mb-2">Recurring End Date</label>
                               <input
                                 className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all duration-200 text-sm"
                                 type="date"
                                 value={editForm.recurring_end_date || ''}
                                 onChange={e => setEditForm(f => ({ ...f, recurring_end_date: e.target.value }))}
                               />
                             </div>
                           )}
                           <div className="flex gap-2">
                             <button
                               className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-sm hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                               onClick={() => handleSaveEdit(expense.id)}
                               disabled={!editForm.description?.trim() || !editForm.amount || parseFloat(editForm.amount) <= 0}
                             >
                               <Save className="h-4 w-4" />
                               Save
                             </button>
                             <button
                               className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2"
                               onClick={() => setEditingId(null)}
                             >
                               <XCircle className="h-4 w-4" />
                               Cancel
                             </button>
                           </div>
                         </div>
                       </div>
                     ) : (
                       <div className="p-4 relative z-10">
                         {/* Top Row - Category Badge and Amount */}
                         <div className="flex items-center justify-between mb-3">
                           {/* Enhanced Category Badge */}
                           <div className={`${getCategoryColor(expense.category)} px-3 py-2 rounded-xl text-sm font-semibold border-2 shadow-lg flex items-center gap-2 w-fit group-hover:shadow-xl transition-all duration-300`}>
                             <div className="w-2 h-2 rounded-full bg-current opacity-70"></div>
                             <span>{expense.category}</span>
                             {expense.is_recurring && (
                               <span className="px-2 py-1 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 text-white text-xs font-bold border-0 shadow-md">
                                 Recurring
                               </span>
                             )}
                           </div>
                           
                           {/* Enhanced Amount */}
                           <div className="text-right">
                             <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 group-hover:from-purple-700 group-hover:to-blue-700 transition-all duration-300">
                               {symbol}{expense.amount.toLocaleString()}
                             </p>
                             <div className="flex items-center gap-2 text-xs text-red-600 font-bold">
                               <div className="w-2 h-2 bg-gradient-to-r from-red-400 to-red-500 rounded-full shadow-sm"></div>
                               <span>EXPENSE</span>
                             </div>
                           </div>
                         </div>
                         
                         {/* Middle Row - Description */}
                         <div className="mb-3">
                           <h3 className="font-semibold text-gray-900 text-base leading-relaxed group-hover:text-purple-700 transition-colors duration-300">
                             {expense.description || 'No description'}
                           </h3>
                         </div>
                         
                         {/* Bottom Row - Date, Payment Method, and Actions */}
                         <div className="flex items-center justify-between">
                           {/* Left side - Date and Payment Method */}
                           <div className="flex items-center gap-3">
                             <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-xs text-gray-600">
                               <Calendar className="h-3.5 w-3.5 text-purple-500" />
                               <span className="font-medium">{new Date(expense.date).toLocaleDateString('en-GB', {
                                 day: '2-digit',
                                 month: 'short',
                                 year: 'numeric'
                               })}</span>
                             </div>
                             <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 text-xs">
                               <span className="text-blue-700 font-medium">Payment Method</span>
                             </div>
                           </div>
                           
                           {/* Right side - Action Buttons */}
                           <div className="flex gap-2">
                             <button
                               className="p-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-lg hover:from-amber-500 hover:to-amber-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-110"
                               onClick={() => handleStartEdit(expense)}
                               title="Edit expense"
                             >
                               <Edit3 className="h-4 w-4" />
                             </button>
                             <button
                               className="p-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:from-red-600 hover:to-red-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-110"
                               onClick={() => handleDeleteExpense(expense.id)}
                               title="Delete expense"
                             >
                               <Trash2 className="h-4 w-4" />
                             </button>
                           </div>
                         </div>
                         
                         {/* Bottom accent line */}
                         <div className="mt-3 pt-3 border-t border-gradient-to-r from-purple-100 via-transparent to-blue-100"></div>
                       </div>
                     )}
                     
                     {/* Hover indicator */}
                     <div className="absolute bottom-2 right-2 w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 transform scale-0 group-hover:scale-100"></div>
                   </div>
                 ))}
              </div>
            )}
          </>
        )}

        {/* Enhanced Minimized Summary View */}
        {isMinimized && (
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 text-center hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl flex items-center justify-center">
                <Receipt className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Expense Summary</h3>
                <p className="text-sm text-gray-600">Click below to view detailed expenses</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{filteredExpenses(expenses, searchTerm).length}</p>
                <p className="text-sm text-gray-600 font-medium">Total Transactions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{symbol}{totalExpenses.toLocaleString()}</p>
                <p className="text-sm text-gray-600 font-medium">Total Amount</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {filteredExpenses(expenses, searchTerm).length > 0 
                    ? `${symbol}${(totalExpenses / filteredExpenses(expenses, searchTerm).length).toFixed(2)}`
                    : `${symbol}0.00`
                  }
                </p>
                <p className="text-sm text-gray-600 font-medium">Average</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllExpenses; 