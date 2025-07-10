import React, { useState } from 'react';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Brain } from 'lucide-react';

const Upload = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);

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

  const handleChange = (e) => {
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Expenses</h1>
        <p className="text-gray-600">Upload your expense data and let AI categorize them automatically</p>
      </div>

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
              onChange={handleChange}
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
  );
};

export default Upload;