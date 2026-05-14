import { createWorker } from 'tesseract.js';

// Helper function to clean and normalize text (preserves newlines for line-by-line parsing)
const cleanText = (text) => {
  if (!text) return '';
  return text
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const extractAmountFromLine = (line) => {
  // Try currency symbol followed by amount first
  const withSymbol = line.match(/[₹$€£]\s*(\d[\d,.]*\d)/);
  if (withSymbol) return parseAmount(withSymbol[1]);
  // Try amount with decimal (like 5445.30)
  const withDecimal = line.match(/(\d{1,3}(?:[,]\d{3})*\.\d{1,2})\b/);
  if (withDecimal) return parseAmount(withDecimal[1]);
  // Try any number with commas (like 5,445)
  const withComma = line.match(/(\d{1,3}(?:,\d{3})+)/);
  if (withComma) return parseAmount(withComma[1]);
  // Plain number (at least 2 digits)
  const plain = line.match(/\b(\d{2,})\b/);
  if (plain) return parseAmount(plain[1]);
  return null;
};

const extractAmount = (text) => {
  if (!text) return null;

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Tier 1: "Grand Total" or "Total" that is NOT "Sub-Total" — scan bottom-up
  // The final total on a receipt is almost always near the bottom.
  for (let i = lines.length - 1; i >= 0; i--) {
    const lower = lines[i].toLowerCase();
    if (/\b(?:grand\s*total|total\s*amount|amount\s*payable|payable\s*amount|balance\s*due|bill\s*amount|final\s*amount|net\s*payable)\b/.test(lower)) {
      const amt = extractAmountFromLine(lines[i]);
      if (amt && amt >= 1) {
        console.log('Tier1 (grand total):', amt, 'from:', lines[i]);
        return amt;
      }
    }
  }

  // Tier 2: Line with "Total" but NOT "Sub-Total"/"Subtotal" — bottom-up
  for (let i = lines.length - 1; i >= 0; i--) {
    const lower = lines[i].toLowerCase();
    if (/\btotal\b/.test(lower) && !/\bsub[-\s]?total\b/.test(lower)) {
      const amt = extractAmountFromLine(lines[i]);
      if (amt && amt >= 1) {
        console.log('Tier2 (total):', amt, 'from:', lines[i]);
        return amt;
      }
    }
  }

  // Tier 3: Sub-Total as fallback
  for (let i = lines.length - 1; i >= 0; i--) {
    const lower = lines[i].toLowerCase();
    if (/\bsub[-\s]?total\b/.test(lower)) {
      const amt = extractAmountFromLine(lines[i]);
      if (amt && amt >= 1) {
        console.log('Tier3 (sub-total):', amt, 'from:', lines[i]);
        return amt;
      }
    }
  }

  // Tier 4: Lines with amount/payment keywords
  const kwRe = /\b(?:amount|rs\.?|inr|net|due|payment|amt)\b/i;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (kwRe.test(lines[i])) {
      const amt = extractAmountFromLine(lines[i]);
      if (amt && amt >= 10) {
        console.log('Tier4 (keyword):', amt, 'from:', lines[i]);
        return amt;
      }
    }
  }

  // Tier 5: Amount in words (e.g., "Rs Two Hundred Only")
  for (const line of lines) {
    const wordMatch = line.match(/(?:rs\.?|inr|₹)\s*([A-Za-z\s-]+?)(?:\s+only)?\s*$/i);
    if (wordMatch) {
      const amt = wordsToNumber(wordMatch[1].trim());
      if (amt) {
        console.log('Tier5 (words):', amt, 'from:', line);
        return amt;
      }
    }
  }

  // Tier 6: Last resort — find the largest currency-prefixed amount
  const allAmounts = [];
  for (const line of lines) {
    const matches = line.match(/[₹$€£]\s*\d[\d,. ]*/g) || [];
    for (const m of matches) {
      const amt = parseAmount(m);
      if (amt && amt >= 10 && amt < 1000000 && !isLikelyNotAnAmount(m, line)) {
        allAmounts.push(amt);
      }
    }
  }
  if (allAmounts.length > 0) {
    const largest = Math.max(...allAmounts);
    console.log('Tier6 (largest currency amount):', largest);
    return largest;
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

const pad2 = (n) => String(n).padStart(2, '0');

const extractDate = (text) => {
  if (!text) return null;

  const months = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12
  };

  const tryFormat = (d, m, y) => {
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  };

  const lines = text.split('\n');

  const parseDateFromLine = (line) => {
    // YYYY-MM-DD (unambiguous)
    const iso = line.match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
    if (iso) {
      const r = tryFormat(+iso[3], +iso[2], +iso[1]);
      if (r) return r;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = line.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (dmy) {
      const a = +dmy[1], b = +dmy[2], y = +dmy[3];
      if (a > 12) return tryFormat(a, b, y);
      if (b > 12) return tryFormat(b, a, y);
      return tryFormat(a, b, y); // default DD/MM/YYYY
    }

    // "Jan 01, 2023"
    const mdy = line.match(/([A-Za-z]{3,9})\s+(\d{1,2})[,.]?\s+(\d{4})/);
    if (mdy) {
      const m = months[mdy[1].toLowerCase()];
      if (m) return tryFormat(+mdy[2], m, +mdy[3]);
    }

    // "01 Jan 2023"
    const dmn = line.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
    if (dmn) {
      const m = months[dmn[2].toLowerCase()];
      if (m) return tryFormat(+dmn[1], m, +dmn[3]);
    }

    return null;
  };

  // First pass: prefer lines that contain a "date" keyword
  for (const line of lines) {
    if (/\bdate\b/i.test(line)) {
      const d = parseDateFromLine(line);
      if (d) return d;
    }
  }

  // Second pass: any line with a date
  for (const line of lines) {
    const d = parseDateFromLine(line);
    if (d) return d;
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
      
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
      });
      
      console.log('Processing image...');
      
      // Process the image with error handling
      let text = '';
      
      try {
        const result = await worker.recognize(processedImageUrl, {
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
          
          const result = await worker.recognize(imageDataUrl);
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
