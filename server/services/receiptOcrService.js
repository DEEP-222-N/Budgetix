// server/services/receiptOcrService.js
// Robust receipt OCR with a 3-tier fallback chain:
//   1. Asprise OCR  — specialized receipt API, extracts line items + tax + merchant + payment method
//   2. Gemini       — general-purpose vision model (existing implementation in aiService)
//   3. (last)       — return a minimal-data result so the caller can fall back to client-side Tesseract
//
// The exported scanReceipt() returns a single normalized shape so the route + frontend
// don't need to know which provider succeeded.

const axios = require('axios');
const FormData = require('form-data');

const ASPRISE_ENDPOINT = 'https://ocr.asprise.com/api/v1/receipt';
const ASPRISE_TIMEOUT_MS = 25000;
const MAX_BASE64_BYTES = 12 * 1024 * 1024; // ~9MB image cap before decode

// Approximate mapping from Asprise's category guesses (which are free-form) → Budgetix categories.
// Asprise itself does not return a category; we infer from merchant/items via simple heuristics.
function inferCategoryFromText(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  const rules = [
    ['Food',                     ['restaurant', 'cafe', 'bistro', 'kitchen', 'pizzeria', 'diner', 'starbucks', 'mcdonald', 'kfc', 'subway', 'chipotle', 'lunch', 'dinner']],
    ['Grocery',                  ['grocer', 'supermarket', 'mart', 'walmart', 'kroger', 'big bazaar', 'reliance fresh', 'dmart', 'spencer']],
    ['Transportation and Fuel',  ['uber', 'ola', 'lyft', 'taxi', 'cab', 'fuel', 'petrol', 'gas station', 'shell', 'hp ', 'indian oil', 'bp ']],
    ['Healthcare',               ['pharmacy', 'apollo', 'medplus', 'hospital', 'clinic', 'medic', 'lab ']],
    ['Utilities',                ['electric', 'utility', 'water bill', 'gas bill', 'internet', 'broadband', 'wifi', 'telecom']],
    ['Shopping',                 ['amazon', 'flipkart', 'myntra', 'mall', 'apparel', 'fashion', 'store', 'retail']],
    ['Entertainment',            ['cinema', 'pvr', 'inox', 'theatre', 'netflix', 'spotify', 'concert', 'amusement']],
    ['Travel',                   ['airline', 'flight', 'hotel', 'airbnb', 'booking.com', 'irctc', 'railway']],
    ['Education',                ['school', 'college', 'tuition', 'course', 'udemy', 'coursera']],
    ['Personal Care',            ['salon', 'spa', 'barber', 'beauty']],
  ];
  for (const [cat, kws] of rules) {
    if (kws.some(k => t.includes(k))) return cat;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1) Asprise OCR
// ---------------------------------------------------------------------------
async function scanWithAsprise(buffer, mimeType) {
  const form = new FormData();
  form.append('api_key', process.env.ASPRISE_API_KEY || 'TEST');
  form.append('recognizer', process.env.ASPRISE_RECOGNIZER || 'auto');
  form.append('ref_no', `budgetix_${Date.now()}`);
  form.append('file', buffer, {
    filename: 'receipt.' + (mimeType === 'image/png' ? 'png' : 'jpg'),
    contentType: mimeType || 'image/jpeg'
  });

  const response = await axios.post(ASPRISE_ENDPOINT, form, {
    headers: form.getHeaders(),
    timeout: ASPRISE_TIMEOUT_MS,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    // Asprise returns JSON on success and JSON on failure (with success:false).
    validateStatus: () => true
  });

  if (response.status >= 500) {
    throw new Error(`Asprise upstream error ${response.status}`);
  }

  const body = response.data;
  if (!body || body.success === false) {
    throw new Error(body?.message || 'Asprise returned no result');
  }

  const receipts = Array.isArray(body.receipts) ? body.receipts : [];
  if (receipts.length === 0) {
    throw new Error('Asprise found no receipts in image');
  }

  // Use the first detected receipt
  const r = receipts[0];
  const items = Array.isArray(r.items)
    ? r.items.map(it => ({
        description: (it.description || '').trim(),
        amount: typeof it.amount === 'number' ? it.amount : null,
        qty: typeof it.qty === 'number' ? it.qty : null
      })).filter(it => it.description || it.amount != null)
    : [];

  const amount = typeof r.total === 'number' ? r.total
    : typeof r.subtotal === 'number' ? r.subtotal
    : null;

  // Asprise returns date as a string; try to normalize to ISO YYYY-MM-DD
  let dateIso = null;
  if (r.date) {
    const d = new Date(r.date);
    if (!isNaN(d.getTime())) dateIso = d.toISOString().split('T')[0];
  }

  const merchantName = r.merchant_name || r.merchant_address || '';
  const description = items.length > 0
    ? items.slice(0, 3).map(it => it.description).filter(Boolean).join(', ')
    : (merchantName ? `Purchase at ${merchantName}` : '');

  const inferred = inferCategoryFromText(`${merchantName} ${items.map(i => i.description).join(' ')}`);

  if (amount == null && items.length === 0) {
    throw new Error('Asprise returned an empty receipt');
  }

  return {
    source: 'asprise',
    amount,
    date: dateIso,
    merchantName,
    description,
    category: inferred,
    items,
    tax: typeof r.tax === 'number' ? r.tax : null,
    subtotal: typeof r.subtotal === 'number' ? r.subtotal : null,
    paymentMethod: r.payment_method || null,
    currency: r.currency || null
  };
}

// ---------------------------------------------------------------------------
// 2) Gemini fallback — defer to existing aiService.scanReceiptBase64
// ---------------------------------------------------------------------------
async function scanWithGemini(buffer, mimeType) {
  // Lazy-require to avoid a hard dependency cycle and to keep aiService cold if not used.
  const AIService = require('./aiService');
  const ai = new AIService();
  const base64 = buffer.toString('base64');
  const result = await ai.scanReceiptBase64({ base64Data: base64, mimeType });

  if (!result || (result.amount == null && !result.description && !result.merchantName)) {
    throw new Error('Gemini returned an empty receipt');
  }

  return {
    source: 'gemini',
    amount: typeof result.amount === 'number' ? result.amount : null,
    date: result.date ? new Date(result.date).toISOString().split('T')[0] : null,
    merchantName: result.merchantName || '',
    description: result.description || (result.merchantName ? `Purchase at ${result.merchantName}` : ''),
    category: result.category || inferCategoryFromText(`${result.merchantName || ''} ${result.description || ''}`),
    items: [],
    tax: null,
    subtotal: null,
    paymentMethod: null,
    currency: null
  };
}

// ---------------------------------------------------------------------------
// Public entry point — try each provider in order, collecting per-tier errors.
// ---------------------------------------------------------------------------
async function scanReceipt({ base64Data, mimeType }) {
  if (!base64Data) {
    return { success: false, error: 'No image data provided', attempts: [] };
  }

  // Guard against absurdly large payloads BEFORE decoding (decoded size is ~75% of base64 length).
  if (base64Data.length > MAX_BASE64_BYTES * 1.34) {
    return { success: false, error: 'Image too large (max ~9MB)', attempts: [] };
  }

  let buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch (err) {
    return { success: false, error: 'Invalid base64 image data', attempts: [] };
  }

  if (!buffer || buffer.length < 100) {
    return { success: false, error: 'Image data appears empty or corrupted', attempts: [] };
  }

  const attempts = [];

  // Tier 1: Asprise
  try {
    console.log('[receipt-ocr] Trying Asprise…');
    const result = await scanWithAsprise(buffer, mimeType);
    console.log('[receipt-ocr] Asprise OK', { amount: result.amount, items: result.items.length });
    return { success: true, data: result, attempts: [...attempts, { provider: 'asprise', ok: true }] };
  } catch (err) {
    console.warn('[receipt-ocr] Asprise failed:', err.message);
    attempts.push({ provider: 'asprise', ok: false, error: err.message });
  }

  // Tier 2: Gemini
  try {
    console.log('[receipt-ocr] Trying Gemini…');
    const result = await scanWithGemini(buffer, mimeType);
    console.log('[receipt-ocr] Gemini OK', { amount: result.amount });
    return { success: true, data: result, attempts: [...attempts, { provider: 'gemini', ok: true }] };
  } catch (err) {
    console.warn('[receipt-ocr] Gemini failed:', err.message);
    attempts.push({ provider: 'gemini', ok: false, error: err.message });
  }

  // All server-side providers exhausted — signal the client to fall back to Tesseract.
  return {
    success: false,
    error: 'Server-side OCR providers exhausted; client should fall back to local OCR.',
    attempts
  };
}

module.exports = { scanReceipt, inferCategoryFromText };
