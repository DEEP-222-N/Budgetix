import React, { useState } from 'react';
import { Brain, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AIBudgetAdvisor = () => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [promptResponse, setPromptResponse] = useState(null);

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
        <>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2">Your Personalized Budget Plan</h3>
            <div 
              className="prose max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ 
                __html: suggestion.replace(/\n/g, '<br />')
              }} 
            />
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="mb-3 font-medium text-blue-900">Do you want the AI to build a customized AI budget?</p>
            <div className="flex gap-4">
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none"
                onClick={() => setPromptResponse('yes')}
                type="button"
              >
                Yes
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none"
                onClick={() => setPromptResponse('no')}
                type="button"
              >
                No
              </button>
            </div>
            {promptResponse === 'yes' && (
              <div className="mt-3 text-green-700 font-semibold">Great! The AI will help you build a customized budget.</div>
            )}
            {promptResponse === 'no' && (
              <div className="mt-3 text-red-700 font-semibold">No problem! You can always ask for help later.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AIBudgetAdvisor;
