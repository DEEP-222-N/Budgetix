import React, { useRef, useState } from 'react';
import './AddExpense.css';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, AlertCircle, X, Scan, Loader2 } from 'lucide-react';
import { processReceipt } from '../utils/ocrUtils';


const AddExpense = () => {
  // Get user and supabase client from AuthContext
  const { user, supabase } = useAuth();

  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    frequency: '', // Add frequency to form state
    recurring_end_date: '' // Add recurring_end_date to form state
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Removed upload component states
  // Receipt scan states
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanError, setScanError] = useState('');
  const scanInputRef = useRef(null);

  // Toast logic
  const [showError, setShowError] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  React.useEffect(() => {
    if (showSuccess) {
      setShowSuccessToast(true);
      const timer = setTimeout(() => setShowSuccessToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  React.useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const categories = [
    'Food',
    'Transportation and Fuel',
    'Entertainment',
    'Housing',
    'Utilities',
    'Grocery',
    'Healthcare',
    'Education',
    'Shopping',
    'Insurance',
    'Travel',
    'Other'
  ];

  const paymentMethods = [
    'Credit Card',
    'Debit Card',
    'Cash',
    'Bank Transfer',
    'Mobile Payment',
    'Other'
  ];

  const frequencyOptions = [
    'Daily',
    'Weekly',
    'Monthly',
    'Quarterly',
    '6 Months',
    'Yearly'
  ];

  function getNextDate(last, frequency) {
    const date = new Date(last);
    switch (frequency) {
      case 'Daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'Weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'Monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'Quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case '6 Months':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'Yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        break;
    }
    return date.toISOString().split('T')[0];
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Map AI category to app category list
  const mapAiCategoryToAppCategory = (aiCategoryRaw) => {
    if (!aiCategoryRaw) return '';
    const ai = aiCategoryRaw.toLowerCase().trim();
    if (ai.includes('food') || ai.includes('restaurant') || ai.includes('dining')) return 'Food';
    if (ai.includes('transport') || ai.includes('fuel') || ai.includes('gas') || ai.includes('cab') || ai.includes('uber') || ai.includes('ola')) return 'Transportation and Fuel';
    if (ai.includes('entertain')) return 'Entertainment';
    if (ai.includes('hous') || ai.includes('rent') || ai.includes('mortgage')) return 'Housing';
    if (ai.includes('utilit') || ai.includes('electric') || ai.includes('water') || ai.includes('internet') || ai.includes('wifi') || ai.includes('bills')) return 'Utilities';
    if (ai.includes('grocery') || ai.includes('grocer') || ai.includes('supermarket')) return 'Grocery';
    if (ai.includes('health') || ai.includes('medical') || ai.includes('pharma') || ai.includes('doctor')) return 'Healthcare';
    if (ai.includes('educat') || ai.includes('tuition') || ai.includes('course')) return 'Education';
    if (ai.includes('shop') || ai.includes('retail') || ai.includes('clothes') || ai.includes('apparel')) return 'Shopping';
    if (ai.includes('insur')) return 'Insurance';
    if (ai.includes('travel') || ai.includes('flight') || ai.includes('hotel') || ai.includes('trip')) return 'Travel';
    return 'Other';
  };

  // Convert File to base64 (without data URL prefix)
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // result is like: data:<mime>;base64,<data>
      const commaIndex = typeof result === 'string' ? result.indexOf(',') : -1;
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleScanReceiptFile = async (file) => {
    try {
      setScanError('');
      setIsScanningReceipt(true);
      
      // Process the receipt using Tesseract.js
      const result = await processReceipt(file);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process receipt');
      }
      
      const { amount, date, merchantName, description } = result.data;
      
      // Map merchant name to category
      const category = mapAiCategoryToAppCategory(merchantName);
      
      // Update form with extracted data
      setFormData(prev => ({
        ...prev,
        amount: amount ? String(amount) : prev.amount,
        date: date || prev.date,
        description: description || prev.description,
        category: category || prev.category
      }));
      
      setShowSuccess(true);
    } catch (error) {
      console.error('Error processing receipt:', error);
      let errorMessage = 'Failed to scan receipt. ';
      if (error.message.includes('Tesseract')) {
        errorMessage += 'Please ensure the image is clear and well-lit.';
      } else {
        errorMessage += 'Please try again with a clearer image.';
      }
      setScanError(errorMessage);
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const onScanInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleScanReceiptFile(file);
      // Reset the input so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  // Removed upload handlers

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if user is authenticated
      if (!user) {
        throw new Error('You must be logged in to add expenses');
      }
      
      // Prepare data for Supabase expenses table
      const isRecurring = formData.frequency !== '';
      // Use the chosen expense date as the anchor for recurrence, not today's date
      const anchorDate = formData.date;
      const expenseData = {
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description || '',
        date: formData.date,
        payment_method: formData.paymentMethod,
        frequency: formData.frequency,
        is_recurring: isRecurring,
        recurring_start_date: isRecurring ? anchorDate : null,
        last_occurred: isRecurring ? anchorDate : null,
        recurring_next_date: isRecurring ? getNextDate(anchorDate, formData.frequency) : null,
        recurring_end_date: isRecurring && formData.recurring_end_date ? formData.recurring_end_date : null,
        user_id: user.id // Use the authenticated user's ID from AuthContext
      };
      
      console.log('Sending expense data to Supabase:', expenseData);
      
      // Insert into the expenses table
      const { data, error } = await supabase
        .from('expenses')
        .insert([expenseData]);
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Transaction saved successfully:', data);
      
      // Call the direct update function to update total expenses in financial_overview
      try {
        const { data: updatedData, error: updateError } = await supabase
          .rpc('update_total_expenses', { user_id_param: user.id });
          
        if (updateError) {
          console.error('Error updating total expenses:', updateError);
          // Continue even if this fails, as the main expense was saved
        } else {
          console.log('Total expenses updated successfully:', updatedData);
        }
      } catch (updateError) {
        console.error('Error calling update_total_expenses function:', updateError);
        // Continue even if this fails, as the main expense was saved
      }

      // Increment BudgeXP points by 1 (fetch, increment, update)
      try {
        // Fetch current points
        const { data: xpData, error: xpFetchError } = await supabase
          .from('financial_overview')
          .select('budgexp_points')
          .eq('user_id', user.id)
          .single();
        if (xpFetchError) {
          console.error('Error fetching BudgeXP points:', xpFetchError);
        } else {
          const currentXP = xpData?.budgexp_points || 0;
          const { error: xpUpdateError } = await supabase
            .from('financial_overview')
            .update({ budgexp_points: currentXP + 1 })
            .eq('user_id', user.id);
          if (xpUpdateError) {
            console.error('Error updating BudgeXP points:', xpUpdateError);
          }
        }
      } catch (xpError) {
        console.error('Error incrementing BudgeXP points:', xpError);
      }
      
      // Show success message
      setShowSuccess(true);
      
      // Reset form
      setFormData({
        amount: '',
        category: 'Food',
        description: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Credit Card',
        frequency: '',
        recurring_end_date: ''
      });
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError('Failed to add transaction: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen py-6">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Toast Notifications */}
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full flex justify-center pointer-events-none">
          <div className="w-full max-w-md">
            {showSuccessToast && (
              <div className="flex items-center justify-between bg-white border border-green-200 text-green-800 rounded-lg p-3 shadow-lg mb-4 animate-bounce-in pointer-events-auto transition-all duration-300">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-green-100 rounded-full">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="font-medium text-sm">Transaction added successfully!</span>
                </div>
                <button onClick={() => setShowSuccessToast(false)} className="ml-3 p-1 text-green-700 hover:text-green-900 hover:bg-green-100 rounded-full transition-colors duration-200 focus:outline-none">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {showError && error && (
              <div className="flex items-center justify-between bg-white border border-red-200 text-red-800 rounded-lg p-3 shadow-lg mb-4 animate-bounce-in pointer-events-auto transition-all duration-300">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-red-100 rounded-full">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="font-medium text-sm">{error}</span>
                </div>
                <button onClick={() => setShowError(false)} className="ml-3 p-1 text-red-700 hover:text-red-900 hover:bg-red-100 rounded-full transition-colors duration-200 focus:outline-none">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact Header Section */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-white border border-gray-200 rounded-full text-gray-700 shadow-sm mb-4">
            <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">+</span>
            </div>
            <span className="font-medium text-sm">Add New Expense</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Track Your Spending</h1>
          <p className="text-sm text-gray-600 max-w-xl mx-auto">Add detailed expense entries to maintain accurate financial tracking</p>
        </div>
        
        {/* Compact Form Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Receipt Upload Section */}
          <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 p-5 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Quick Receipt Processing</h3>
                <p className="text-sm text-gray-600">Upload a receipt image to automatically fill amount, date, and category fields</p>
              </div>
              <div className="flex-shrink-0">
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onScanInputChange}
                  className="hidden"
                />
                <button
                  type="button"
                  title="Scan a receipt image to auto-fill fields"
                  aria-label="Scan receipt to auto-fill"
                  className="group relative inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white text-base font-medium shadow-md hover:shadow-lg hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                  onClick={() => scanInputRef.current && scanInputRef.current.click()}
                  disabled={isScanningReceipt}
                >
                  {isScanningReceipt ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <div className="p-1 bg-white/20 rounded-md group-hover:bg-white/30 transition-colors duration-200">
                        <Scan className="h-4 w-4" />
                      </div>
                      <span>Upload Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Scan Error Display */}
            {scanError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="font-medium">Receipt Processing Error:</span>
                  <span>{scanError}</span>
                </div>
              </div>
            )}
          </div>

          {/* Compact Form Content */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Form Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              {/* Amount Field */}
              <div className="form-group">
                <label htmlFor="amount" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></div>
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 bg-white text-gray-900 placeholder-gray-500 transition-all duration-200 text-base font-medium shadow-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <span className="text-gray-400 font-semibold">$</span>
                  </div>
                </div>
              </div>
              
              {/* Date Field */}
              <div className="form-group">
                <label htmlFor="date" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 bg-white text-gray-900 transition-all duration-200 text-base font-medium shadow-sm"
                />
              </div>
              
              {/* Category Field */}
              <div className="form-group">
                <label htmlFor="category" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 bg-white text-gray-900 transition-all duration-200 text-base font-medium appearance-none cursor-pointer shadow-sm"
                >
                  <option value="" disabled>Select Category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              {/* Payment Method Field */}
              <div className="form-group">
                <label htmlFor="paymentMethod" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 bg-white text-gray-900 transition-all duration-200 text-base font-medium appearance-none cursor-pointer shadow-sm"
                >
                  <option value="" disabled>Select Payment Method</option>
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Compact Recurring Expense Section */}
            <div className="bg-gradient-to-r from-gray-50 to-purple-50/40 rounded-xl p-5 mb-6 border border-gray-200">
              <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                Recurring Expense Settings
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="form-group">
                  <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <select
                    id="frequency"
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 bg-white text-gray-900 transition-all duration-200 text-base font-medium appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="" disabled>Select Frequency</option>
                    {frequencyOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                
                {/* Recurring End Date Picker - only show if frequency is selected */}
                {formData.frequency && (
                  <div className="form-group">
                    <label htmlFor="recurring_end_date" className="block text-sm font-medium text-gray-700 mb-2">
                      Recurring End Date
                    </label>
                    <input
                      type="date"
                      id="recurring_end_date"
                      name="recurring_end_date"
                      value={formData.recurring_end_date}
                      onChange={handleChange}
                      min={formData.date}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 bg-white text-gray-900 transition-all duration-200 text-base font-medium shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Description Field */}
            <div className="form-group mb-6">
              <label htmlFor="description" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-teal-500 rounded-full"></div>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add details about this expense..."
                rows="3"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-500 bg-white text-gray-900 placeholder-gray-500 transition-all duration-200 text-base font-medium resize-none shadow-sm"
              ></textarea>
            </div>
            
            {/* Compact Submit Button */}
            <button 
              type="submit" 
              className="group relative w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold text-lg rounded-lg shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Adding Expense...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-md group-hover:bg-white/30 transition-colors duration-200">
                    <span className="text-lg font-bold">+</span>
                  </div>
                  <span>Add Expense</span>
                </div>
              )}
            </button>
          </form>
        </div>
        
        {/* Compact Tips Section */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-5 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">i</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Tips for Better Tracking</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
              <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mb-2">
                <span className="text-blue-600 text-xs font-bold">1</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-1 text-sm">Detailed Descriptions</h4>
              <p className="text-xs text-gray-600">Be specific with descriptions for better categorization</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
              <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mb-2">
                <span className="text-blue-600 text-xs font-bold">2</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-1 text-sm">Regular Updates</h4>
              <p className="text-xs text-gray-600">Add expenses consistently for accurate tracking</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
              <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center mb-2">
                <span className="text-blue-600 text-xs font-bold">3</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-1 text-sm">Consistent Categories</h4>
              <p className="text-xs text-gray-600">Use standard category names for better insights</p>
            </div>
          </div>
        </div>

        {/* Compact BudgeXP Animation */}
        {showSuccessToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-coin-up bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 shadow-lg rounded-full flex items-center px-5 py-2 pointer-events-none">
            <span className="text-yellow-600 font-bold text-base">+1 BudgeXP</span>
          </div>
        )}
      </div>
    </div>
  );
};



export default AddExpense;