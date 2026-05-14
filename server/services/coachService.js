// server/services/coachService.js
// OpenAI-powered "Financial Coach" — streaming chat with function calling,
// predictive forecasting, anomaly detection, smart categorization, subscription detection.

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const CATEGORIES = [
  'Food', 'Transportation and Fuel', 'Entertainment', 'Housing', 'Utilities',
  'Grocery', 'Healthcare', 'Education', 'Shopping', 'Personal Care', 'Travel',
  'Insurance', 'Other'
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
}

function categoryToColumn(cat) {
  const map = {
    'Food': 'food',
    'Transportation and Fuel': 'transportation_and_fuel',
    'Entertainment': 'entertainment',
    'Housing': 'housing',
    'Utilities': 'utilities',
    'Grocery': 'grocery',
    'Healthcare': 'healthcare',
    'Education': 'education',
    'Shopping': 'shopping',
    'Personal Care': 'personal_care',
    'Travel': 'travel',
    'Other': 'other'
  };
  return map[cat] || cat.toLowerCase().replace(/ /g, '_');
}

async function fetchUserContext(userId) {
  const supabase = getSupabase();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [expensesRes, budgetRes, overviewRes] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', userId).gte('date', ninetyDaysAgo).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', userId).eq('budget_month', MONTH_NAMES[now.getMonth()]).eq('budget_year', now.getFullYear()).limit(1),
    supabase.from('financial_overview').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
  ]);

  const expenses = expensesRes.data || [];
  const budget = (budgetRes.data && budgetRes.data[0]) || null;
  const overview = (overviewRes.data && overviewRes.data[0]) || null;

  const thisMonthExpenses = expenses.filter(e => e.date >= monthStart);
  const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const categoryTotalsThisMonth = {};
  thisMonthExpenses.forEach(e => {
    const c = e.category || 'Other';
    categoryTotalsThisMonth[c] = (categoryTotalsThisMonth[c] || 0) + Number(e.amount || 0);
  });

  return {
    now,
    monthStart,
    expenses,           // last 90 days
    thisMonthExpenses,
    thisMonthTotal,
    categoryTotalsThisMonth,
    budget,
    overview
  };
}

// =========================================================================
// PREDICTIVE FORECAST — project month-end spending per category from current pace
// =========================================================================
async function computeForecast(userId) {
  const ctx = await fetchUserContext(userId);
  const now = ctx.now;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  // Total forecast
  const dailyPace = dayOfMonth > 0 ? ctx.thisMonthTotal / dayOfMonth : 0;
  const projectedTotal = ctx.thisMonthTotal + dailyPace * daysRemaining;
  const monthlyBudget = Number(ctx.budget?.monthly_budget_total || 0);

  // Per-category forecast
  const categoryForecasts = [];
  for (const cat of CATEGORIES) {
    const spent = ctx.categoryTotalsThisMonth[cat] || 0;
    const dailyCat = dayOfMonth > 0 ? spent / dayOfMonth : 0;
    const projected = spent + dailyCat * daysRemaining;
    const col = categoryToColumn(cat);
    const catBudget = Number(ctx.budget?.[col] || 0);
    if (spent === 0 && catBudget === 0) continue; // skip unused
    const overBy = projected - catBudget;
    categoryForecasts.push({
      category: cat,
      spentSoFar: Math.round(spent * 100) / 100,
      projectedTotal: Math.round(projected * 100) / 100,
      categoryBudget: catBudget,
      willOverBudget: catBudget > 0 && projected > catBudget,
      overByAmount: Math.round(Math.max(0, overBy) * 100) / 100,
      dailyPace: Math.round(dailyCat * 100) / 100
    });
  }
  categoryForecasts.sort((a, b) => b.overByAmount - a.overByAmount);

  return {
    asOf: now.toISOString(),
    daysElapsed: dayOfMonth,
    daysRemaining,
    spentSoFar: Math.round(ctx.thisMonthTotal * 100) / 100,
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    monthlyBudget,
    willOverBudget: monthlyBudget > 0 && projectedTotal > monthlyBudget,
    overByAmount: Math.round(Math.max(0, projectedTotal - monthlyBudget) * 100) / 100,
    categoryForecasts
  };
}

// =========================================================================
// ANOMALY DETECTION — flag unusual expenses vs 90-day baseline per category
// =========================================================================
async function detectAnomalies(userId) {
  const ctx = await fetchUserContext(userId);

  // Group expenses by category
  const byCat = {};
  ctx.expenses.forEach(e => {
    const c = e.category || 'Other';
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(Number(e.amount || 0));
  });

  // Stats per category
  const stats = {};
  for (const [cat, amounts] of Object.entries(byCat)) {
    if (amounts.length < 5) continue; // need a baseline
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((s, x) => s + (x - mean) ** 2, 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    const sorted = [...amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    stats[cat] = { mean, stddev, median, count: amounts.length };
  }

  // Find anomalies in the last 14 days
  const fourteenDaysAgo = new Date(ctx.now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentExpenses = ctx.expenses.filter(e => e.date >= fourteenDaysAgo);

  const anomalies = [];
  for (const e of recentExpenses) {
    const cat = e.category || 'Other';
    const stat = stats[cat];
    if (!stat) continue;
    const amt = Number(e.amount || 0);
    const z = stat.stddev > 0 ? (amt - stat.mean) / stat.stddev : 0;
    const multipleOfMedian = stat.median > 0 ? amt / stat.median : 0;
    if (z > 2 || multipleOfMedian > 3) {
      anomalies.push({
        id: e.id,
        category: cat,
        amount: amt,
        description: e.description || '(no description)',
        date: e.date,
        zScore: Math.round(z * 100) / 100,
        multipleOfMedian: Math.round(multipleOfMedian * 100) / 100,
        baselineMedian: Math.round(stat.median * 100) / 100,
        baselineMean: Math.round(stat.mean * 100) / 100,
        reason: multipleOfMedian > 3
          ? `${multipleOfMedian.toFixed(1)}× your typical ${cat} expense`
          : `${z.toFixed(1)} standard deviations above your usual ${cat} spending`
      });
    }
  }
  anomalies.sort((a, b) => b.amount - a.amount);
  return anomalies.slice(0, 10);
}

// =========================================================================
// SMART CATEGORIZATION — given a description, pick a category, using
// the user's past similar expenses as in-context examples.
// =========================================================================
async function suggestCategory(userId, description, amount) {
  if (!description || description.trim().length < 2) return null;
  const supabase = getSupabase();
  const { data: past } = await supabase
    .from('expenses')
    .select('description, category, amount')
    .eq('user_id', userId)
    .not('description', 'is', null)
    .limit(200);

  // Find textually similar past expenses (cheap token-overlap)
  const tokens = (s) => (s || '').toLowerCase().match(/\w+/g) || [];
  const descTokens = new Set(tokens(description));
  const scored = (past || []).map(p => {
    const ptoks = new Set(tokens(p.description));
    const intersect = [...descTokens].filter(t => ptoks.has(t)).length;
    return { ...p, _score: intersect };
  }).filter(p => p._score > 0).sort((a, b) => b._score - a._score).slice(0, 5);

  // If a strong textual match exists with the same category, use it directly
  if (scored.length > 0 && scored[0]._score >= 2) {
    return { category: scored[0].category, confidence: 'high', source: 'history' };
  }

  // Otherwise ask GPT-4o-mini (cheap, fast)
  const examples = scored.length > 0
    ? '\n\nThe user previously categorized similar expenses:\n' +
      scored.map(s => `- "${s.description}" → ${s.category}`).join('\n')
    : '';

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You categorize a single expense into exactly one of these categories: ${CATEGORIES.join(', ')}.
Respond with JSON: {"category": "<one of the above>", "confidence": "high"|"medium"|"low"}.
Only the JSON, nothing else.${examples}`
      },
      {
        role: 'user',
        content: `Description: "${description}"${amount ? `\nAmount: ${amount}` : ''}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 60
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content);
    if (CATEGORIES.includes(parsed.category)) {
      return { category: parsed.category, confidence: parsed.confidence || 'medium', source: 'ai' };
    }
  } catch {}
  return null;
}

// =========================================================================
// SUBSCRIPTION DETECTION — find recurring charges in expense history
// =========================================================================
async function detectSubscriptions(userId) {
  const supabase = getSupabase();
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, description, amount, date, category')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500);

  if (!expenses || expenses.length === 0) return [];

  // Group by normalized description + similar amount
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const groups = {};
  for (const e of expenses) {
    const key = norm(e.description);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  const subscriptions = [];
  for (const [key, group] of Object.entries(groups)) {
    if (group.length < 3) continue;
    // Check amount stability
    const amounts = group.map(g => Number(g.amount));
    const amtMean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amtSpread = Math.max(...amounts) - Math.min(...amounts);
    const amountStable = amtMean > 0 && amtSpread / amtMean < 0.15;
    if (!amountStable) continue;

    // Check temporal cadence
    const dates = group.map(g => new Date(g.date)).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    if (gaps.length === 0) continue;
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    let cadence = null;
    if (avgGap >= 25 && avgGap <= 35) cadence = 'monthly';
    else if (avgGap >= 85 && avgGap <= 95) cadence = 'quarterly';
    else if (avgGap >= 360 && avgGap <= 370) cadence = 'yearly';
    else if (avgGap >= 6 && avgGap <= 8) cadence = 'weekly';
    if (!cadence) continue;

    subscriptions.push({
      name: group[0].description,
      averageAmount: Math.round(amtMean * 100) / 100,
      cadence,
      occurrences: group.length,
      lastCharged: group[0].date,
      category: group[0].category,
      monthlyEquivalent: cadence === 'monthly' ? amtMean
        : cadence === 'yearly' ? amtMean / 12
        : cadence === 'quarterly' ? amtMean / 3
        : cadence === 'weekly' ? amtMean * 4.33
        : amtMean
    });
  }

  subscriptions.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
  return subscriptions;
}

// =========================================================================
// CHAT — streaming chat with function calling.
// Tools the assistant can call to read & act on the user's finances.
// =========================================================================
const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_spending_summary',
      description: 'Get the user\'s spending breakdown for a time window (this month, last month, last 30 days).',
      parameters: {
        type: 'object',
        properties: {
          window: {
            type: 'string',
            enum: ['this_month', 'last_month', 'last_30_days', 'last_90_days'],
            description: 'Time window to summarize'
          }
        },
        required: ['window']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_forecast',
      description: 'Get a forward-looking projection of month-end spending based on the current pace.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_anomalies',
      description: 'Get a list of unusually large recent expenses (z-score or multiple-of-median outliers).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_subscriptions',
      description: 'Get the list of detected recurring charges / subscriptions.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_expense',
      description: 'Log a new expense for the user. Use this when the user explicitly says they spent money on something.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          category: { type: 'string', enum: CATEGORIES },
          description: { type: 'string' },
          date: { type: 'string', description: 'ISO date (YYYY-MM-DD). Defaults to today if omitted.' }
        },
        required: ['amount', 'category', 'description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_category_budget',
      description: 'Update the user\'s budget for a specific category in the current month.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          amount: { type: 'number' }
        },
        required: ['category', 'amount']
      }
    }
  }
];

async function executeTool(userId, name, args) {
  const supabase = getSupabase();
  if (name === 'get_spending_summary') {
    const now = new Date();
    let start;
    if (args.window === 'this_month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (args.window === 'last_month') start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    else if (args.window === 'last_30_days') start = new Date(now.getTime() - 30 * 86400000);
    else start = new Date(now.getTime() - 90 * 86400000);
    let end = now;
    if (args.window === 'last_month') end = new Date(now.getFullYear(), now.getMonth(), 0);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    const { data } = await supabase.from('expenses').select('amount, category, description, date')
      .eq('user_id', userId).gte('date', startStr).lte('date', endStr);
    const items = data || [];
    const total = items.reduce((s, e) => s + Number(e.amount || 0), 0);
    const byCat = {};
    items.forEach(e => {
      const c = e.category || 'Other';
      byCat[c] = (byCat[c] || 0) + Number(e.amount || 0);
    });
    return { window: args.window, total: Math.round(total * 100) / 100, transactionCount: items.length, byCategory: byCat };
  }
  if (name === 'get_forecast') return await computeForecast(userId);
  if (name === 'get_anomalies') return await detectAnomalies(userId);
  if (name === 'get_subscriptions') return await detectSubscriptions(userId);
  if (name === 'add_expense') {
    const row = {
      user_id: userId,
      amount: args.amount,
      category: args.category,
      description: args.description || '',
      date: args.date || new Date().toISOString().split('T')[0],
      payment_method: 'Other',
      is_recurring: false
    };
    const { data, error } = await supabase.from('expenses').insert([row]).select();
    if (error) return { ok: false, error: error.message };
    return { ok: true, expense: data && data[0] };
  }
  if (name === 'update_category_budget') {
    const now = new Date();
    const col = categoryToColumn(args.category);
    const { data: existing } = await supabase.from('budgets').select('id')
      .eq('user_id', userId)
      .eq('budget_month', MONTH_NAMES[now.getMonth()])
      .eq('budget_year', now.getFullYear()).limit(1);
    if (existing && existing[0]) {
      const { error } = await supabase.from('budgets').update({ [col]: args.amount }).eq('id', existing[0].id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from('budgets').insert([{
        user_id: userId,
        budget_month: MONTH_NAMES[now.getMonth()],
        budget_year: now.getFullYear(),
        monthly_budget_total: 0,
        [col]: args.amount
      }]);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, category: args.category, newAmount: args.amount };
  }
  return { error: `Unknown tool: ${name}` };
}

async function buildSystemPrompt(userId) {
  const ctx = await fetchUserContext(userId);
  const monthBudget = ctx.budget?.monthly_budget_total ?? 'not set';
  return `You are Budgetix Coach — a sharp, honest, encouraging personal finance assistant for this specific user. You give specific, numeric, actionable advice. You always speak in the user's currency context (Indian Rupees ₹ by default unless told otherwise).

CURRENT SNAPSHOT (as of ${ctx.now.toISOString().split('T')[0]}):
- Spent this month: ₹${ctx.thisMonthTotal.toFixed(2)} (${ctx.thisMonthExpenses.length} transactions)
- Monthly budget: ₹${monthBudget}
- Top categories this month: ${Object.entries(ctx.categoryTotalsThisMonth).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,v])=>`${c} ₹${v.toFixed(0)}`).join(', ') || 'none yet'}
- Monthly income: ₹${ctx.overview?.total_monthly_income || 'unknown'}
- Current savings: ₹${ctx.overview?.total_savings || 'unknown'}

HOW YOU WORK:
1. When the user asks about their finances, CALL THE RELEVANT TOOL first to get fresh data — never make up numbers.
2. When the user says they spent money ("I spent 200 on coffee", "paid 5000 rent yesterday"), call add_expense. Confirm what you logged.
3. When the user asks to change a budget ("bump my food budget to 8000"), call update_category_budget.
4. Be concise. Use short paragraphs and bullets. No corporate fluff.
5. If a goal is unrealistic given the data, say so kindly with a specific reason.
6. Format currency as ₹X,XXX.

You can chain tool calls — e.g., check the forecast, then suggest a category-budget change, then call update_category_budget if the user agrees.`;
}

async function* streamChat(userId, messages) {
  const openai = getOpenAI();
  const systemPrompt = await buildSystemPrompt(userId);
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  // Loop until the model stops calling tools
  for (let hop = 0; hop < 5; hop++) {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: fullMessages,
      tools: CHAT_TOOLS,
      tool_choice: 'auto',
      stream: true,
      temperature: 0.4
    });

    let assistantContent = '';
    const toolCallsAccum = {}; // index -> { id, name, arguments }
    let finishReason = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (choice.finish_reason) finishReason = choice.finish_reason;

      if (delta.content) {
        assistantContent += delta.content;
        yield { type: 'token', content: delta.content };
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallsAccum[idx]) toolCallsAccum[idx] = { id: tc.id || '', name: '', arguments: '' };
          if (tc.id) toolCallsAccum[idx].id = tc.id;
          if (tc.function?.name) toolCallsAccum[idx].name += tc.function.name;
          if (tc.function?.arguments) toolCallsAccum[idx].arguments += tc.function.arguments;
        }
      }
    }

    const toolCalls = Object.values(toolCallsAccum);

    if (finishReason === 'tool_calls' && toolCalls.length > 0) {
      // Echo to client and execute each tool
      const assistantMsg = {
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id, type: 'function',
          function: { name: tc.name, arguments: tc.arguments || '{}' }
        }))
      };
      fullMessages.push(assistantMsg);

      for (const tc of toolCalls) {
        let parsedArgs = {};
        try { parsedArgs = JSON.parse(tc.arguments || '{}'); } catch {}
        yield { type: 'tool_call', name: tc.name, args: parsedArgs };
        let result;
        try {
          result = await executeTool(userId, tc.name, parsedArgs);
        } catch (err) {
          result = { error: err.message };
        }
        yield { type: 'tool_result', name: tc.name, result };
        fullMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        });
      }
      // continue loop — model will now incorporate tool results
      continue;
    }

    // No more tool calls — done
    yield { type: 'done' };
    return;
  }
  yield { type: 'done' };
}

module.exports = {
  CATEGORIES,
  fetchUserContext,
  computeForecast,
  detectAnomalies,
  suggestCategory,
  detectSubscriptions,
  streamChat
};
