import React from 'react';
import { Calendar, Tag } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

const ExpenseCard = ({ expense }) => {
  const { symbol } = useCurrency();
  const getCategoryColor = (category) => {
    const colors = {
      Food: 'bg-green-100 text-green-800',
      Transport: 'bg-blue-100 text-blue-800',
      Entertainment: 'bg-purple-100 text-purple-800',
      Utilities: 'bg-orange-100 text-orange-800',
      Healthcare: 'bg-red-100 text-red-800',
      default: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.default;
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center space-x-3">
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(expense.category)}`}>
          {expense.category}
        </div>
        <div>
          <p className="font-medium text-gray-900">{expense.description}</p>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>{new Date(expense.date).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold text-gray-900">{symbol}{expense.amount.toLocaleString()}</p>
      </div>
    </div>
  );
};

export default ExpenseCard;