import React, { useState } from 'react';
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
    frequency: '' // Add frequency to form state
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
      const today = new Date().toISOString().split('T')[0];
      const expenseData = {
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description || '',
        date: formData.date,
        payment_method: formData.paymentMethod,
        frequency: formData.frequency,
        is_recurring: isRecurring,
        recurring_start_date: isRecurring ? today : null,
        last_occurred: isRecurring ? today : null,
        recurring_next_date: isRecurring ? getNextDate(today, formData.frequency) : null,
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
      
      // Show success message
      setShowSuccess(true);
      
      // Reset form
      setFormData({
        amount: '',
        category: 'Food',
        description: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Credit Card',
        frequency: ''
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
        <div className="form-group">
          <label htmlFor="amount">
            <i className="fas fa-dollar-sign"></i> Amount
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
            <i className="far fa-calendar"></i> Date
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
            <i className="fas fa-tag"></i> Category
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
            <i className="fas fa-credit-card"></i> Payment Method
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
    </div>
  );
};



export default AddExpense;