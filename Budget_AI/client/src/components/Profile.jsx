import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { UserCircle, Save, Lock, Unlock } from 'lucide-react';

const Profile = () => {
  const { user, login } = useAuth();
  const { symbol, currency, setCurrency } = useCurrency();
  const [formData, setFormData] = useState({
    monthlyIncome: '',
    totalInvestments: '',
    totalSavings: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [locked, setLocked] = useState(true);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // On mount, load from localStorage if available
  React.useEffect(() => {
    const stored = localStorage.getItem('profileFinancialInfo');
    if (stored) {
      setFormData(JSON.parse(stored));
    }
  }, []);

  if (!user) return <div className="max-w-xl mx-auto p-8">No user info available.</div>;

  // Prefer username from user_metadata if available
  const usernameFromMetadata = user?.user_metadata?.username;
  let displayName = '';
  if (usernameFromMetadata && usernameFromMetadata.trim() !== '') {
    displayName = usernameFromMetadata;
  } else {
    // Extract username from email and remove numeric characters
    const userEmail = user.email || '';
    const username = userEmail.split('@')[0].replace(/[0-9]/g, '');
    displayName = username.charAt(0).toUpperCase() + username.slice(1);
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem('profileFinancialInfo', JSON.stringify(formData));
      // Dispatch custom event for other components
      window.dispatchEvent(new Event('profileUpdated'));
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile data:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleUnlockClick = () => {
    setShowPasswordPrompt(true);
    setPassword('');
    setPasswordError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsVerifying(true);
    setPasswordError('');
    try {
      const result = await login(user.email, password);
      if (result.success) {
        setLocked(false);
        setShowPasswordPrompt(false);
        setPasswordError('');
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setPasswordError('An error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="flex flex-col items-center mb-8">
        <UserCircle className="h-20 w-20 text-purple-600 mb-2" />
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayName}</h1>
        <p className="text-gray-500">{user.email}</p>
      </div>

      <div className="space-y-6">
        {/* Currency Selection - always visible */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:border-blue-400 transition"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="JPY">JPY (¥)</option>
            <option value="CAD">CAD (C$)</option>
            <option value="INR">INR (₹)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Choose the currency you want to use for your budget.</p>
        </div>

        {/* Financial Overview - locked/blurred if needed */}
        <div className="bg-gray-50 p-6 rounded-lg relative overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            Financial Overview
            {locked ? <Lock className="h-5 w-5 text-gray-400" /> : <Unlock className="h-5 w-5 text-green-500" />}
            {/* Lock Button when unlocked */}
            {!locked && (
              <button
                onClick={() => setLocked(true)}
                className="ml-auto flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 text-xs font-medium"
                title="Lock Financial Info"
                style={{ marginLeft: 'auto' }}
              >
                <Lock className="h-4 w-4 text-gray-500" />
                Lock
              </button>
            )}
          </h2>

          {/* Blurred Financial Info Section */}
          <div className={locked ? "pointer-events-none filter blur-sm opacity-60 select-none" : ""}>
            <div className="space-y-4">
              {/* Monthly Total Income */}
              <div>
                <label htmlFor="monthlyIncome" className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Total Income
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    id="monthlyIncome"
                    name="monthlyIncome"
                    value={formData.monthlyIncome}
                    onChange={handleInputChange}
                    placeholder="Enter your monthly income"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                ) : (
                  <div className="text-lg font-medium text-gray-900">
                    {symbol}{formData.monthlyIncome || '0'}
                  </div>
                )}
              </div>

              {/* Total Investments */}
              <div>
                <label htmlFor="totalInvestments" className="block text-sm font-medium text-gray-700 mb-2">
                  Total Investments (Stocks, Crypto, etc.)
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    id="totalInvestments"
                    name="totalInvestments"
                    value={formData.totalInvestments}
                    onChange={handleInputChange}
                    placeholder="Enter your total investments"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                ) : (
                  <div className="text-lg font-medium text-gray-900">
                    {symbol}{formData.totalInvestments || '0'}
                  </div>
                )}
              </div>

              {/* Total Overall Savings */}
              <div>
                <label htmlFor="totalSavings" className="block text-sm font-medium text-gray-700 mb-2">
                  Total Overall Savings
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    id="totalSavings"
                    name="totalSavings"
                    value={formData.totalSavings}
                    onChange={handleInputChange}
                    placeholder="Enter your total savings"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                ) : (
                  <div className="text-lg font-medium text-gray-900">
                    {symbol}{formData.totalSavings || '0'}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Edit Financial Info
                </button>
              )}
            </div>
          </div>

          {/* Overlay for Locked State */}
          {locked && (
            <div className="absolute inset-0 bg-white bg-opacity-60 z-10 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center">
                <Lock className="h-10 w-10 text-purple-500 mb-4" />
                <button
                  onClick={handleUnlockClick}
                  className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 text-base font-medium shadow-md"
                >
                  Unlock Financial Info
                </button>
              </div>
            </div>
          )}

          {/* Password Prompt Modal */}
          {showPasswordPrompt && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
              <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center w-full max-w-xs">
                <h3 className="text-lg font-semibold mb-2">Enter Password to Unlock</h3>
                <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col items-center gap-2">
                  <input
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isVerifying}
                  />
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    disabled={isVerifying}
                  >
                    {isVerifying ? 'Verifying...' : 'Submit'}
                  </button>
                  {passwordError && <div className="text-red-500 text-sm mt-1">{passwordError}</div>}
                </form>
                <button
                  onClick={() => setShowPasswordPrompt(false)}
                  className="mt-2 text-xs text-gray-500 hover:underline"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-gray-600">
          <p>Welcome to your profile page!</p>
          <p className="mt-2 text-sm">You can view and edit your financial information here.</p>
        </div>
      </div>
    </div>
  );
};

export default Profile; 