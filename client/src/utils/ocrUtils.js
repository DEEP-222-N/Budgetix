import { createWorker } from 'tesseract.js';

// Helper function to clean and normalize text
const cleanText = (text) => {
  if (!text) return '';
  // Replace multiple spaces with single space and trim
  return text.replace(/\s+/g, ' ').trim();
};

// Helper function to extract amount from text
const extractAmount = (text) => {
  if (!text) return null;
  
    // Split text into lines and clean them
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // First pass: Look for exact "Total" pattern like in the receipt
  for (const line of lines) {
    // Look for patterns like "Total 1,354.00" or "Total : 1,354.00"
    const totalMatch = line.match(/total\s*[:\-]?\s*[₹$€£]?\s*(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?)/i);
    if (totalMatch) {
      const amount = parseAmount(totalMatch[1]);
      if (amount) {
        console.log('Found total amount:', amount, 'from line:', line);
        return amount;
      }
    }
    
    // Look for amounts in words (e.g., 'Two Hundred Only')
    const wordAmountMatch = line.match(/(?:rs\.?|inr|₹)\s*([A-Za-z\s-]+?)(?:\s+only)?\s*$/i);
    if (wordAmountMatch) {
      const amountInWords = wordAmountMatch[1].trim();
      const amount = wordsToNumber(amountInWords);
      if (amount) {
        console.log('Found amount in words:', amount, 'from:', wordAmountMatch[0]);
        return amount;
      }
    }
  }
  
  // Second pass: Look for amounts near total keywords
  const totalKeywords = [
    'total', 'net', 'grand total', 'final amount', 'amount payable', 
    'payable amount', 'balance due', 'bill amount', 'amount', 'rs.',
    'subtotal', 'gross amount', 'total amount', 'total due'
  ];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check if this line contains any of our total keywords
    const hasKeyword = totalKeywords.some(keyword => lowerLine.includes(keyword));
    
    if (hasKeyword) {
      console.log('Found line with total keyword:', line);
      
      // Look for amounts in this line (with or without currency symbol)
      // First try with currency symbol
      let amountMatch = line.match(/[₹$€£]\s*(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?)/);
      
      // If no match with currency symbol, try without
      if (!amountMatch) {
        amountMatch = line.match(/(?:^|\s)(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?)(?:\s|$)/);
      }
      
      if (amountMatch) {
        const amount = parseAmount(amountMatch[1] || amountMatch[0]);
        if (amount && amount >= 10) {
          console.log('Found amount:', amount, 'in line:', line.trim());
          return amount;
        }
      }
      
      // If no amount with currency symbol, look for any number that could be an amount
      const anyNumberMatch = line.match(/(?:^|\s)(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?)(?:\s|$)/);
      if (anyNumberMatch) {
        const amount = parseAmount(anyNumberMatch[1]);
        if (amount && amount >= 10) {
          console.log('Found amount without currency symbol:', amount, 'in line:', line.trim());
          return amount;
        }
      }
    }
  }
  
  // Second pass: Look for common total patterns
  const totalPatterns = [
    // Look for "Total" followed by an amount
    /(?:^|\s)(?:total|net|grand total|final amount|amount payable|balance due)\s*[^\w]\s*[₹$€£]?\s*(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?)/gi,
    // Look for amounts at the end of lines (common for totals)
    /[₹$€£]\s*(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?)\s*$/gm,
    // Look for amounts after common payment terms
    /(?:amount|balance|due|payment|amt|rs|inr|usd|eur|gbp|gst|g\.tot|gross)[^\d]*[₹$€£]?\s*(\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?)/gi,
  ];
  
  // Try to find the total amount first
  for (const pattern of totalPatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const amountStr = match[1] || match[0].replace(/[^\d.,-]/g, '');
      const amount = parseAmount(amountStr);
      if (amount && amount > 0) {
        console.log('Found total amount:', amount, 'using pattern:', pattern);
        return amount;
      }
    }
  }
  
  // If no total found in the first pass, look for all potential amounts
  const potentialAmounts = [];
  
  for (const line of lines) {
    // Skip empty lines
    if (line.trim().length === 0) continue;
    
    // Look for numbers that might be amounts
    const amountMatches = line.match(/[₹$€£]?\s*\d{1,3}(?:[.,]?\d{3})*(?:[.,]\d{1,2})?/g) || [];
    
    for (const match of amountMatches) {
      const amount = parseAmount(match);
      
      // Only consider amounts in a reasonable range for a receipt
      if (amount && amount >= 10 && amount < 100000) {
        // Skip numbers that look like dates, phone numbers, etc.
        if (!isLikelyNotAnAmount(match, line)) {
          // Calculate priority:
          // 3: Amount is on its own line (likely a total)
          // 2: Amount is with currency symbol
          // 1: Regular amount
          let priority = 1;
          const trimmedLine = line.trim();
          
          if (trimmedLine === match.trim()) {
            priority = 3; // Amount is the only thing on the line
          } else if (/[₹$€£]/.test(match)) {
            priority = 2; // Amount has a currency symbol
          }
          
          potentialAmounts.push({ amount, priority, line: line.trim() });
        }
      }
    }
  }
  
  // Sort by priority (highest first) and then by amount (largest first)
  potentialAmounts.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.amount - a.amount;
  });
  
  // Log all potential amounts with their details for debugging
  console.log('Potential amounts found:');
  potentialAmounts.forEach((item, index) => {
    console.log(`  ${index + 1}. Amount: ${item.amount}, Priority: ${item.priority}, Line: "${item.line}"`);
  });
  
  // Extract just the amounts
  const sortedAmounts = potentialAmounts.map(item => item.amount);
  
  console.log('Potential amounts found:', sortedAmounts);
  
  // If we found potential amounts, return the highest priority one (or largest if same priority)
  if (sortedAmounts.length > 0) {
    console.log('Using amount:', sortedAmounts[0]);
    return sortedAmounts[0];
  }
  
  return null;
};

// Helper to parse amount string to number
function parseAmount(str) {
  if (!str) return null;
  
  // Clean the string - remove all non-numeric except decimal point and minus
  let cleaned = str.replace(/[^\d.,-]/g, '');
  
  // Handle European format (1.234,56)
  if (/\d+\.\d{3},\d{2}/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  
  // Handle US/International format (1,234.56)
  // First remove all non-numeric except last decimal point and minus
  const parts = cleaned.split('.');
  if (parts.length > 1) {
    // If there are multiple decimal points, keep only the last one
    cleaned = parts[0].replace(/[^\d-]/g, '') + '.' + parts.slice(1).join('').replace(/[^\d]/g, '');
  } else {
    // No decimal points, just clean all non-numeric
    cleaned = cleaned.replace(/[^\d-]/g, '');
  }
  
  const amount = parseFloat(cleaned);
  
  // Only return positive amounts (negative amounts are likely not valid for receipts)
  return !isNaN(amount) && amount > 0 ? amount : null;
}

// Helper to convert words to number (e.g., 'Two Hundred' -> 200)
function wordsToNumber(words) {
  if (!words) return null;
  
  const wordToNum = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60,
    'seventy': 70, 'eighty': 80, 'ninety': 90,
    'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'lac': 100000, 'crore': 10000000
  };
  
  // Clean and split the words
  const cleanWords = words.toLowerCase()
    .replace(/[^a-z\s-]/g, '') // Keep only letters, spaces, and hyphens
    .replace(/\s+/g, ' ')      // Replace multiple spaces with one
    .trim()
    .split(/\s+|-/);           // Split on spaces or hyphens
  
  let total = 0;
  let current = 0;
  
  for (const word of cleanWords) {
    const num = wordToNum[word];
    if (num === undefined) continue;
    
    if (num === 100) {
      current *= num;
    } else if (num >= 1000) {
      current *= num;
      total += current;
      current = 0;
    } else {
      current += num;
    }
  }
  
  total += current;
  return total > 0 ? total : null;
}

// Helper to identify numbers that are likely not amounts
function isLikelyNotAnAmount(num, fullText) {
  const lowerText = fullText.toLowerCase();
  const numValue = parseFloat(num.replace(/[^\d.-]/g, ''));
  
  // Common false positive patterns
  const falsePositives = [
    // Phone numbers
    /\d{3,}[- ]?\d{3,}[- ]?\d{4}/,
    // Dates
    /\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/,
    // Times (e.g., 12:30)
    /\d{1,2}:\d{2}/,
    // GSTIN, invoice numbers, etc.
    /gst|gstin|invoice|no\.?|#|qty|quantity|ph|tel|mobile|pcs|kg|ml|ltr|grm|gm|litre|litres|liter|liters/,
    // Single or double digits that aren't likely to be amounts
    /^\d{1,2}$/
  ];
  
  // Check if the number is part of any false positive pattern
  if (falsePositives.some(pattern => {
    if (pattern.test(lowerText)) {
      const match = lowerText.match(pattern)[0];
      const matchStart = lowerText.indexOf(match);
      const matchEnd = matchStart + match.length;
      const numStart = lowerText.indexOf(num);
      const numEnd = numStart + num.length;
      
      // Check if the number is within or adjacent to the false positive match
      return (numStart >= matchStart - 3 && numStart <= matchEnd) ||
             (numEnd >= matchStart && numEnd <= matchEnd + 3);
    }
    return false;
  })) {
    return true;
  }
  
  // Check the context around the number
  const context = lowerText.substring(
    Math.max(0, lowerText.indexOf(num) - 30),
    Math.min(lowerText.length, lowerText.indexOf(num) + num.length + 30)
  );
  
  // Additional context checks
  const contextChecks = [
    // Numbers near quantity indicators
    /(?:qty|quantity|pcs|kg|g|ml|ltr|grm|gm|litre|liters?|nos?)\.?\s*\d+/,
    // Numbers near phone/fax indicators
    /(?:phone|ph|tel|mobile|fax)[^\d]*\d+/,
    // Numbers near invoice/order numbers
    /(?:invoice|order|bill|no|#)[^\d]*\d+/,
    // Numbers near GSTIN/PAN
    /(?:gst|gstin|pan|aadhaar|aadhar)[^\d]*\d+/
  ];
  
  if (contextChecks.some(check => check.test(context))) {
    return true;
  }
  
  // If number is too small and not near currency symbols or amount indicators
  if (numValue < 50 && !/[₹$€£]\s*\d+/.test(context) && !/(?:total|amount|rs|inr|usd|eur|gbp)/.test(context)) {
    return true;
  }
  
  return false;
}

// Helper function to extract date from text
const extractDate = (text) => {
  if (!text) return null;
  
  // Common date formats in receipts
  const datePatterns = [
    // MM/DD/YYYY or DD/MM/YYYY
    /(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/,
    // YYYY-MM-DD
    /(\d{4}[-.]\d{1,2}[-.]\d{1,2})/,
    // Month DD, YYYY (Jan 01, 2023)
    /([A-Za-z]{3,9}\s+\d{1,2}[,.]?\s+\d{4})/,
    // DD Month YYYY (01 Jan 2023)
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let dateStr = match[0];
        // Clean up the date string
        dateStr = dateStr.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
        
        // Try parsing the date
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
  }
  
  return null;
};

// Helper function to extract merchant name
const extractMerchant = (text) => {
  if (!text) return 'Scanned Receipt';
  
  // Common receipt headers to ignore
  const ignorePatterns = [
    'receipt', 'invoice', 'bill', 'order', 'transaction', 'payment',
    'subtotal', 'total', 'tax', 'amount', 'date', 'time', 'qty', 'quantity',
    'description', 'item', 'price', 'discount', 'change', 'cash', 'card',
    'thank you', 'visa', 'mastercard', 'amex', 'credit', 'debit', 'balance'
  ];
  
  // Split text into lines and clean them
  const lines = text.split('\n')
    .map(line => cleanText(line))
    .filter(line => {
      // Filter out lines that are too short or too long
      if (line.length < 3 || line.length > 50) return false;
      
      // Filter out lines that contain common receipt headers
      const lower = line.toLowerCase();
      return !ignorePatterns.some(pattern => lower.includes(pattern));
    });
  
  // Look for common merchant patterns
  for (const line of lines) {
    // Check if line looks like a merchant name (starts with capital, has letters and maybe &, ', -)
    if (/^[A-Z][A-Za-z0-9\s&'.-]{2,}$/.test(line)) {
      return line;
    }
  }
  
  // If no good match found, return the first non-empty line or a default
  return lines[0] || 'Scanned Receipt';
};

// Helper function to convert file to data URL
const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

// Helper function to preprocess image before OCR
const preprocessImage = (imageDataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image on canvas
      ctx.drawImage(img, 0, 0);
      
      // Apply image processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convert to grayscale and increase contrast
      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale using luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Increase contrast
        const factor = 1.5;
        const newValue = ((gray / 255 - 0.5) * factor + 0.5) * 255;
        
        // Set RGB to the new value (grayscale)
        data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, newValue));
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      // Convert back to data URL
      const processedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(processedImageUrl);
    };
    
    img.src = imageDataUrl;
  });
};

// Main OCR processing function
export const processReceipt = async (file) => {
  console.log('Starting receipt processing...');
  
  if (!file) {
    console.error('No file provided');
    return {
      success: false,
      error: 'No file provided. Please select an image file.'
    };
  }
  
  // Check if file is an image
  if (!file.type.match('image.*')) {
    console.error('File is not an image:', file.type);
    return {
      success: false,
      error: 'Please upload an image file (JPEG, PNG, etc.)'
    };
  }
  
  try {
    // Convert file to data URL
    const imageDataUrl = await fileToDataUrl(file);
    
    // Preprocess the image
    const processedImageUrl = await preprocessImage(imageDataUrl);
    
    // Initialize Tesseract worker with English language
    const worker = await createWorker({
      logger: m => console.log(m), // Log progress
      errorHandler: err => console.error('Tesseract error:', err)
    });
    
    try {
      // Load languages with error handling
      try {
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
      } catch (langError) {
        console.error('Language loading error, trying with default settings...', langError);
        await worker.initialize();
      }
      
      // Set worker parameters for better recognition
      await worker.setParameters({
        tessedit_pageseg_mode: '6', // Assume a single uniform block of text
        tessedit_ocr_engine_mode: '1', // LSTM only (more reliable)
        tessedit_char_whitelist: '0123456789$€£₹., /-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz&\'\n',
        preserve_interword_spaces: '1',
        tessedit_pageseg_autoscale: '1',
        tessedit_pageseg_apply_margin: '1',
        tessedit_pageseg_apply_justify: '1',
        textord_debug_tabfind: '0',
        textord_tabfind_vertical_text: '1',
        textord_tabfind_vertical_horizontal_mix: '1',
        textord_tabfind_vertical_text_ratio: '0.5',
        textord_tabfind_vertical_writing: '1',
        textord_tabfind_vertical_h_mixing: '1',
        textord_tabfind_vertical_h_mixing_ratio: '1.0',
        textord_tabfind_vertical_box_ratio: '0.25',
        textord_tabfind_vertical_text_ratio: '0.5',
        textord_tabfind_vertical_ratio: '1.0',
        textord_tabfind_vertical_ratio_range: '0.5',
        textord_tabfind_vertical_text_ratio: '0.5',
        textord_tabfind_vertical_text_ratio_range: '0.5',
        textord_tabfind_vertical_text_ratio_range2: '0.5',
        textord_tabfind_vertical_text_ratio_range3: '0.5',
        textord_tabfind_vertical_text_ratio_range4: '0.5',
        textord_tabfind_vertical_text_ratio_range5: '0.5',
        textord_tabfind_vertical_text_ratio_range6: '0.5',
        textord_tabfind_vertical_text_ratio_range7: '0.5',
        textord_tabfind_vertical_text_ratio_range8: '0.5',
        textord_tabfind_vertical_text_ratio_range9: '0.5',
        textord_tabfind_vertical_text_ratio_range10: '0.5',
        textord_tabfind_vertical_text_ratio_range11: '0.5',
        textord_tabfind_vertical_text_ratio_range12: '0.5',
        textord_tabfind_vertical_text_ratio_range13: '0.5',
        textord_tabfind_vertical_text_ratio_range14: '0.5',
        textord_tabfind_vertical_text_ratio_range15: '0.5',
        textord_tabfind_vertical_text_ratio_range16: '0.5',
        textord_tabfind_vertical_text_ratio_range17: '0.5',
        textord_tabfind_vertical_text_ratio_range18: '0.5',
        textord_tabfind_vertical_text_ratio_range19: '0.5',
        textord_tabfind_vertical_text_ratio_range20: '0.5',
        tessedit_create_hocr: '0',
        tessedit_create_tsv: '0',
        tessedit_create_pdf: '0',
        tessedit_create_box: '0',
        tessedit_create_txt: '1',
        tessedit_write_images: '0'
      });
      
      console.log('Processing image...');
      
      // Process the image with error handling
      let text = '';
      
      try {
        // First try with the processed image
        const result = await worker.recognize(processedImageUrl, {
          rectangle: { top: 0, left: 0, width: 1000, height: 2000 },
          rotateAuto: true
        });
        text = result.data.text;
      } catch (firstPassError) {
        console.log('First pass failed, trying with original image...', firstPassError);
        // If first pass fails, try with original image and simpler parameters
        try {
          await worker.setParameters({
            tessedit_pageseg_mode: '6',
            tessedit_ocr_engine_mode: '1',
            preserve_interword_spaces: '1'
          });
          
          const result = await worker.recognize(imageDataUrl, {
            rectangle: null,
            rotateAuto: false
          });
          text = result.data.text;
        } catch (secondPassError) {
          console.error('Second pass failed:', secondPassError);
          throw new Error('Failed to process receipt. The image might be too blurry or contain no text.');
        }
      }
      
      // Clean up the extracted text
      text = cleanText(text);
      
      if (!text || text.trim().length < 10) {
        throw new Error('Unable to extract text from the image. Please ensure the receipt is clear and well-lit.');
      }
      
      console.log('Extracted text:', text);
      
      // Extract information with improved parsing
      const amount = extractAmount(text);
      const date = extractDate(text);
      const merchant = extractMerchant(text);
      
      console.log('Extracted data:', { amount, date, merchant });
      
      return {
        success: true,
        data: {
          amount: amount,
          date: date || new Date().toISOString().split('T')[0],
          merchantName: merchant,
          description: merchant ? `Purchase at ${merchant}` : 'Scanned receipt',
          rawText: text
        }
      };
    } finally {
      try {
        await worker.terminate();
      } catch (terminateError) {
        console.error('Error terminating worker:', terminateError);
      }
    }
  } catch (error) {
    console.error('Error processing receipt:', error);
    return {
      success: false,
      error: error.message || 'Failed to process receipt. Please try again with a clearer image.'
    };
  }
};
