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
            <ExpenseCard key={expense.id} expense={expense} />
          ))
        )}
      </div>
    </div>
  );
};

export default AllExpenses; 