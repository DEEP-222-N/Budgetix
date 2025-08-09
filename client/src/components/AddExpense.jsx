import React, { useRef, useState } from 'react';
import './AddExpense.css';
import { useAuth } from '../context/AuthContext';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Brain, X } from 'lucide-react';


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

  // Upload component states
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [showUploadSection, setShowUploadSection] = useState(false);
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

  // Upload handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    setUploadedFile(file);
    setIsProcessing(true);
    
    // Simulate AI processing
    setTimeout(() => {
      setIsProcessing(false);
      setProcessedData({
        totalExpenses: 15,
        categorized: {
          Food: 8,
          Transport: 3,
          Entertainment: 2,
          Utilities: 1,
          Healthcare: 1
        },
        totalAmount: 1240.50,
        confidence: 94
      });
    }, 3000);
  };

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
        <div className="flex items-center justify-between mb-3">
          <div />
          <div className="flex items-center gap-2">
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              onChange={onScanInputChange}
              className="hidden"
            />
            <button
              type="button"
              className="px-3 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-60"
              onClick={() => scanInputRef.current && scanInputRef.current.click()}
              disabled={isScanningReceipt}
            >
              {isScanningReceipt ? 'Scanning…' : 'Scan Receipt'}
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

      {/* Upload Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Upload Expenses</h2>
          <button
            type="button"
            onClick={() => setShowUploadSection(!showUploadSection)}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {showUploadSection ? 'Hide Upload' : 'Show Upload'}
          </button>
        </div>
        
        {showUploadSection && (
          <div className="space-y-6">
            <p className="text-gray-600">Upload your expense data and let AI categorize them automatically</p>

            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
              <form
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className="space-y-6"
              >
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <UploadIcon className="h-8 w-8 text-blue-600" />
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Drop your expense file here
                      </h3>
                      <p className="text-gray-600 mb-4">
                        or <span className="text-blue-600 font-medium">browse</span> to choose a file
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports CSV, Excel, and PDF files up to 10MB
                      </p>
                    </div>
                  </div>
                </div>

                {uploadedFile && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      {isProcessing ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-blue-600">Processing...</span>
                        </div>
                      ) : processedData ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <AlertCircle className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>

            {isProcessing && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <Brain className="h-6 w-6 text-purple-600" />
                  <h3 className="text-lg font-semibold">AI Processing Your Data...</h3>
                </div>
                <p className="text-gray-600">
                  Our AI is analyzing your expenses and categorizing them automatically. This may take a few moments.
                </p>
              </div>
            )}

            {processedData && (
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center space-x-2 mb-6">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <h3 className="text-lg font-semibold">Processing Complete!</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Expenses Found:</span>
                      <span className="font-semibold text-gray-900">{processedData.totalExpenses}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-semibold text-gray-900">${processedData.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">AI Confidence:</span>
                      <span className="font-semibold text-green-600">{processedData.confidence}%</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Categorization Results:</h4>
                    <div className="space-y-2">
                      {Object.entries(processedData.categorized).map(([category, count]) => (
                        <div key={category} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">{category}:</span>
                          <span className="font-medium">{count} expenses</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-200">
                    Import to Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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