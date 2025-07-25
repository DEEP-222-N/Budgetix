import React, { useState } from 'react';
import { Brain, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AIBudgetAdvisor = () => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5000/api/ai/suggest-budget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          userId: user.id
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get suggestion');
      }
      
      const data = await response.json();
      setSuggestion(data.suggestion);
    } catch (err) {
      console.error('Error getting AI suggestion:', err);
      setError('Failed to get suggestion. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center mb-4">
        <Brain className="h-6 w-6 text-indigo-600 mr-2" />
        <h2 className="text-xl font-semibold">AI Budget Advisor</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-2">
            What's your financial goal? (e.g., "I want to buy a $300k car in 24 months")
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="goal"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="I want to buy a $300k car in 24 months..."
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="-ml-1 mr-2 h-4 w-4" />
                  Get Suggestion
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      {suggestion && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">Your Personalized Budget Plan</h3>
          <div 
            className="prose max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ 
              __html: suggestion.replace(/\n/g, '<br />')
            }} 
          />
        </div>
      )}
    </div>
  );
};

export default AIBudgetAdvisor;
