import React from 'react';
import { Calendar, Tag, TrendingUp, TrendingDown, Clock, CreditCard, Wallet, Banknote } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

const ExpenseCard = ({ expense }) => {
  const { symbol } = useCurrency();
  
  const getCategoryColor = (category) => {
    const colors = {
      Food: 'bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 border-emerald-200',
      Grocery: 'bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-700 border-amber-200',
      Education: 'bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 border-blue-200',
      'Transportation and Fuel': 'bg-gradient-to-br from-cyan-50 to-teal-100 text-cyan-700 border-cyan-200',
      Entertainment: 'bg-gradient-to-br from-purple-50 to-violet-100 text-purple-700 border-purple-200',
      Housing: 'bg-gradient-to-br from-pink-50 to-rose-100 text-pink-700 border-pink-200',
      Utilities: 'bg-gradient-to-br from-orange-50 to-red-100 text-orange-700 border-orange-200',
      Healthcare: 'bg-gradient-to-br from-red-50 to-pink-100 text-red-700 border-red-200',
      Shopping: 'bg-gradient-to-br from-indigo-50 to-purple-100 text-indigo-700 border-indigo-200',
      'Personal Care': 'bg-gradient-to-br from-teal-50 to-green-100 text-teal-700 border-teal-200',
      Travel: 'bg-gradient-to-br from-fuchsia-50 to-purple-100 text-fuchsia-700 border-fuchsia-200',
      Other: 'bg-gradient-to-br from-gray-50 to-slate-100 text-gray-700 border-gray-200',
      default: 'bg-gradient-to-br from-gray-50 to-slate-100 text-gray-700 border-gray-200'
    };
    return colors[category] || colors.default;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      Food: '🍽️',
      Grocery: '🛒',
      Education: '📚',
      'Transportation and Fuel': '⛽',
      Entertainment: '🎬',
      Housing: '🏠',
      Utilities: '💡',
      Healthcare: '🏥',
      Shopping: '🛍️',
      'Personal Care': '💄',
      Travel: '✈️',
      Other: '📋'
    };
    return icons[category] || '📋';
  };

  const getPaymentMethodIcon = (method) => {
    const icons = {
      'credit_card': <CreditCard className="h-4 w-4" />,
      'debit_card': <CreditCard className="h-4 w-4" />,
      'cash': <Banknote className="h-4 w-4" />,
      'bank_transfer': <Wallet className="h-4 w-4" />,
      'digital_wallet': <CreditCard className="h-4 w-4" />,
      default: <Tag className="h-4 w-4" />
    };
    return icons[method] || icons.default;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className="group relative bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-2xl hover:border-purple-200 transition-all duration-500 transform hover:-translate-y-2 hover:scale-[1.02]">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-white to-purple-50/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-purple-400 to-purple-300 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      <div className="relative z-10">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-4">
          {/* Category Badge */}
          <div className="flex items-center space-x-3">
            <div className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-2 ${getCategoryColor(expense.category)} flex items-center space-x-2 shadow-sm`}>
              <span className="text-lg filter drop-shadow-sm">{getCategoryIcon(expense.category)}</span>
              <span className="font-medium">{expense.category}</span>
            </div>
            {expense.is_recurring && (
              <div className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 flex items-center space-x-1.5 shadow-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Recurring</span>
              </div>
            )}
          </div>
          
          {/* Amount */}
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 group-hover:text-purple-700 transition-colors duration-300 tracking-tight">
              {symbol}{expense.amount.toLocaleString()}
            </p>
            <div className="flex items-center justify-end space-x-1.5 mt-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs text-red-600 font-semibold uppercase tracking-wide">Expense</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p className="font-semibold text-gray-900 text-lg group-hover:text-gray-800 transition-colors duration-300 leading-relaxed">
            {expense.description || 'No description'}
          </p>
        </div>
        
        {/* Footer Row */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 group-hover:border-purple-100 transition-colors duration-300">
          {/* Date */}
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-2.5 rounded-xl shadow-sm">
              <Calendar className="h-4 w-4 text-gray-600" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-700">
                {formatDate(expense.date)}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(expense.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
          
          {/* Payment method */}
          {expense.payment_method && (
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <div className="bg-gradient-to-br from-purple-100 to-purple-200 p-2.5 rounded-xl shadow-sm">
                {getPaymentMethodIcon(expense.payment_method)}
              </div>
              <div className="flex flex-col items-end">
                <span className="font-semibold text-gray-700 capitalize">
                  {expense.payment_method.replace('_', ' ')}
                </span>
                <span className="text-xs text-gray-500">Payment Method</span>
              </div>
            </div>
          )}
        </div>

        {/* Hover indicator */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseCard;