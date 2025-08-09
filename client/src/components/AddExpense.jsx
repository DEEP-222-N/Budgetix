import React, { useRef, useState } from 'react';
import './AddExpense.css';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, AlertCircle, X, Scan } from 'lucide-react';


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
      const base64Data = await fileToBase64(file);
      const response = await fetch('http://localhost:5000/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType: file.type })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to scan receipt');
      }
      const r = data.data || {};
      const mappedCategory = mapAiCategoryToAppCategory(r.category);
      setFormData((prev) => ({
        ...prev,
        amount: r.amount != null && !Number.isNaN(Number(r.amount)) ? String(r.amount) : prev.amount,
        date: r.date ? new Date(r.date).toISOString().split('T')[0] : prev.date,
        category: mappedCategory || prev.category,
        description: (r.merchantName ? `${r.merchantName} - ` : '') + (r.description || prev.description || '')
      }));
    } catch (err) {
      console.error('Receipt scan failed:', err);
      setScanError(err.message || 'Failed to scan receipt');
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const onScanInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleScanReceiptFile(e.target.files[0]);
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
    <div className="add-expense-container">
      {/* Toast Notifications */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full flex justify-center pointer-events-none">
        <div className="w-full max-w-md">
          {showSuccessToast && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 shadow-lg mb-4 animate-fade-in pointer-events-auto transition-all duration-300">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">Transaction added successfully!</span>
              </div>
              <button onClick={() => setShowSuccessToast(false)} className="ml-4 text-green-700 hover:text-green-900 focus:outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          {showError && error && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 shadow-lg mb-4 animate-fade-in pointer-events-auto transition-all duration-300">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium">{error}</span>
              </div>
              <button onClick={() => setShowError(false)} className="ml-4 text-red-700 hover:text-red-900 focus:outline-none">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
      <h1>Add New Expense</h1>
      <p className="subtitle">Track your spending by adding manual expense entries</p>
      
      <form onSubmit={handleSubmit} className="expense-form">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="text-sm text-gray-600 order-2 sm:order-1">
            Tip: Use receipt scan to auto-fill amount, date, and category
          </div>
          <div className="order-1 sm:order-2">
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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-lg font-semibold shadow-md hover:shadow-lg hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition disabled:opacity-60"
              onClick={() => scanInputRef.current && scanInputRef.current.click()}
              disabled={isScanningReceipt}
            >
              {isScanningReceipt ? (
                'Scanning…'
              ) : (
                <>
                  <Scan className="h-6 w-6" />
                  <span>Scan Receipt</span>
                </>
              )}
            </button>
          </div>
        </div>
        {scanError && (
          <div className="mb-3 text-sm text-red-700 bg-red-100 rounded p-2">
            {scanError}
          </div>
        )}
        <div className="form-group">
          <label htmlFor="amount">
            <i className="fas fa-dollar-sign"></i> Amount <span style={{color: 'red'}}>*</span>
          </label>
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
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="date">
            <i className="far fa-calendar"></i> Date <span style={{color: 'red'}}>*</span>
          </label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="category">
            <i className="fas fa-tag"></i> Category <span style={{color: 'red'}}>*</span>
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            <option value="" disabled>Select Category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="paymentMethod">
            <i className="fas fa-credit-card"></i> Payment Method <span style={{color: 'red'}}>*</span>
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            value={formData.paymentMethod}
            onChange={handleChange}
            required
          >
            <option value="" disabled>Select Payment Method</option>
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="frequency">
            <i className="fas fa-clock"></i> Frequency
          </label>
          <select
            id="frequency"
            name="frequency"
            value={formData.frequency}
            onChange={handleChange}
            // required // Removed to make optional
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
            <label htmlFor="recurring_end_date">
              <i className="far fa-calendar-times"></i> Recurring End Date
            </label>
            <input
              type="date"
              id="recurring_end_date"
              name="recurring_end_date"
              value={formData.recurring_end_date}
              onChange={handleChange}
              min={formData.date}
            />
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="description">
            <i className="fas fa-align-left"></i> Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Add details about this expense..."
            rows="3"
          ></textarea>
        </div>
        
        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Adding...
            </>
          ) : (
            <>
              <i className="fas fa-plus-circle"></i> Add Expense
            </>
          )}
        </button>
      </form>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <h3 className="font-medium text-blue-900 mb-2">💡 Pro Tips:</h3>
        <ul className="text-blue-800 space-y-1">
          <li>• Be specific with descriptions for better categorization</li>
          <li>• Add expenses regularly to maintain accurate tracking</li>
          <li>• Use consistent category names for better analytics</li>
        </ul>
      </div>

      {/* Upload section removed as requested */}
      {/* Coin +1 Animation - bottom right */}
      {showSuccessToast && (
        <div className="fixed bottom-8 right-8 z-50 animate-coin-up bg-white border border-yellow-300 shadow-lg rounded-full flex items-center px-4 py-2 pointer-events-none">
          <span style={{fontSize: '2rem', marginRight: '0.5rem'}}>🪙</span>
          <span className="text-yellow-500 font-bold text-xl">+1</span>
        </div>
      )}
    </div>
  );
};



export default AddExpense;