import React from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

const BudgetProgress = ({ spent, budget }) => {
  const { symbol } = useCurrency();
  const percentage = (spent / budget) * 100;
  const isOverBudget = percentage > 100;
  const remaining = budget - spent;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Budget Progress</h3>
        <div className="flex items-center space-x-2">
          {isOverBudget ? (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          ) : (
            <TrendingUp className="h-5 w-5 text-green-600" />
          )}
          <span className={`text-sm font-medium ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
            {isOverBudget ? 'Over Budget' : 'On Track'}
          </span>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Spent: {symbol}{spent.toLocaleString()}</span>
          <span className="text-gray-600">Budget: {symbol}{budget.toLocaleString()}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${
              isOverBudget 
                ? 'bg-gradient-to-r from-red-500 to-red-600' 
                : 'bg-gradient-to-r from-blue-500 to-purple-600'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{percentage.toFixed(1)}% used</span>
          <span className={`text-sm font-medium ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {symbol}{Math.abs(remaining).toLocaleString()} {remaining >= 0 ? 'remaining' : 'over budget'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BudgetProgress;