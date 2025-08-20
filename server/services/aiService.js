const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    
    // Initialize Google's Generative AI with the API key
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
      apiVersion: 'v1'  // Specify the API version
    });
    
    // Use the latest stable model
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro-latest"  // Updated model name
    });
    
    this.budgetCategories = [
      'Food', 'Transportation and Fuel', 'Entertainment', 'Housing',
      'Utilities', 'Grocery', 'Healthcare', 'Education', 'Shopping',
      'Personal Care', 'Travel', 'Other'
    ];
  }

  // Helper method to make API calls with retries
  async withRetry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} of ${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);
        
        // If we have retries left, wait and try again
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError; // If all retries failed, throw the last error
  }

  async processBudgetPrompt(prompt, currentBudgetData) {
    try {
      const systemPrompt = `
You are a budget management AI assistant. Your job is to analyze user prompts and extract budget-related information to update their budget.

Current budget data:
${JSON.stringify(currentBudgetData, null, 2)}

Available budget categories: ${this.budgetCategories.join(', ')}

User prompt: "${prompt}"

Analyze the prompt and extract any budget changes. Return a JSON response with the following structure:
{
  "action": "update_budget" | "add_expense" | "set_goal" | "unknown",
  "changes": {
    "monthly_budget_total": number | null,
    "categories": {
      "Food": number | null,
      "Transportation and Fuel": number | null,
      "Entertainment": number | null,
      "Housing": number | null,
      "Utilities": number | null,
      "Grocery": number | null,
      "Healthcare": number | null,
      "Education": number | null,
      "Shopping": number | null,
      "Personal Care": number | null,
      "Travel": number | null,
      "Other": number | null
    },
    "monthly_savings_goal": number | null,
    "monthly_investment_goal": number | null,
    "achievable_goal": string | null,
    "months_to_achieve_goal": number | null
  },
  "expenses": [
    {
      "category": "category_name",
      "amount": number,
      "description": "expense description"
    }
  ],
  "message": "A friendly response explaining what changes were made or what was understood"
}

Rules:
1. Only include fields that should be updated (set others to null)
2. For budget updates, extract amounts and match them to appropriate categories
3. For expense additions, create expense objects
4. If the prompt is unclear, set action to "unknown" and ask for clarification
5. Be smart about interpreting natural language (e.g., "food budget" = Food category)
6. Handle currency symbols and convert to numbers
7. Respond ONLY with valid JSON - no explanatory text before or after
8. Do not wrap the JSON in markdown code blocks
9. Ensure all JSON is properly formatted and valid

IMPORTANT: Your response must be ONLY the JSON object, nothing else.

Examples:
- "Set my food budget to 500" → update Food category to 500
- "I spent 50 on groceries today" → add expense to Grocery category
- "Change my monthly budget to 3000" → update monthly_budget_total to 3000
- "My shopping budget should be 200 and entertainment 150" → update both categories
`;

      const result = await this.withRetry(async () => {
        const result = await this.model.generateContent(systemPrompt);
        return result.response;
      });
      const response = await result;
      const text = await response.text();
      
      console.log('Raw AI response:', text);
      
      // Clean the response text to extract JSON
      let cleanedText = text.trim();
      
      // Remove markdown code blocks if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Try to find JSON in the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      // Try to parse the JSON response
      try {
        const parsedResponse = JSON.parse(cleanedText);
        return parsedResponse;
      } catch (parseError) {
        console.error('Failed to parse AI response:', cleanedText);
        console.error('Parse error:', parseError.message);
        
        // Return a fallback response
        return {
          action: "unknown",
          changes: {},
          expenses: [],
          message: "I'm having trouble processing your request. Could you please try rephrasing it more simply?"
        };
      }
    } catch (error) {
      console.error('AI Service Error:', error);
      return {
        action: "unknown",
        changes: {},
        expenses: [],
        message: "Sorry, I'm having trouble processing your request right now. Please try again."
      };
    }
  }

  async processExpensePrompt(prompt) {
    try {
      const systemPrompt = `
You are a budget management AI assistant. Analyze the user's prompt and extract expense information.

Available categories: ${this.budgetCategories.join(', ')}

User prompt: "${prompt}"

Extract expense information and return a JSON response:
{
  "expenses": [
    {
      "category": "category_name",
      "amount": number,
      "description": "expense description"
    }
  ],
  "message": "Confirmation message"
}

Rules:
1. Match expenses to the closest available category
2. Extract amounts (handle currency symbols)
3. Create meaningful descriptions
4. If unclear, ask for clarification

Examples:
- "I spent 25 on lunch" → {"category": "Food", "amount": 25, "description": "lunch"}
- "Paid 100 for gas" → {"category": "Transportation and Fuel", "amount": 100, "description": "gas"}
`;

      const result = await this.withRetry(async () => {
        const result = await this.model.generateContent(systemPrompt);
        return result.response;
      });
      const response = await result;
      const text = await response.text();
      
      try {
        return JSON.parse(text);
      } catch (parseError) {
        return {
          expenses: [],
          message: "I couldn't understand your expense. Could you please be more specific?"
        };
      }
    } catch (error) {
      console.error('AI Expense Service Error:', error);
      return {
        expenses: [],
        message: "Sorry, I'm having trouble processing your expense right now."
      };
    }
  }

  async scanReceiptBase64({ base64Data, mimeType }) {
    try {
      const prompt = `
      Analyze this receipt image and extract the following information in JSON format:
      - Total amount (just the number)
      - Date (in ISO format)
      - Description or items purchased (brief summary)
      - Merchant/store name
      - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense)

      Only respond with valid JSON in this exact format:
      {
        "amount": number,
        "date": "ISO date string",
        "description": "string",
        "merchantName": "string",
        "category": "string"
      }

      If it's not a receipt, return {} only.
      `;

      const result = await this.withRetry(async () => {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        return model.generateContent([
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || 'image/jpeg',
            },
          },
          prompt,
        ]);
      });

      const response = await result.response;
      let text = response.text();
      // Clean fenced code blocks if any
      text = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();

      let parsed = {};
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // Try to extract JSON object substring
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          return {};
        }
      }

      // Normalize and coerce types
      const amount = parsed.amount != null ? Number(parsed.amount) : null;
      const dateIso = parsed.date ? new Date(parsed.date).toISOString() : null;
      const description = parsed.description || '';
      const merchantName = parsed.merchantName || '';
      const category = parsed.category || '';

      return {
        amount,
        date: dateIso,
        description,
        merchantName,
        category,
      };
    } catch (error) {
      console.error('scanReceiptBase64 error:', error);
      return {};
    }
  }

  async generateBudgetSuggestion(prompt, budgetData, financialOverview) {
    // Enhanced validation function to check if prompt is meaningful
    const isValidFinancialGoal = (prompt) => {
      if (!prompt || prompt.length < 10) return false;
      
      // Check for financial keywords
      const financialKeywords = [
        'buy', 'save', 'invest', 'budget', 'goal', 'money', 'expense', 'income',
        'debt', 'loan', 'house', 'car', 'education', 'travel', 'wedding', 'business',
        'retirement', 'emergency', 'fund', 'purchase', 'afford', 'cost', 'price',
        'lakh', 'crore', 'thousand', 'million', 'billion', 'rs', 'rupees', 'dollars'
      ];
      
      const promptLower = prompt.toLowerCase();
      const hasFinancialKeyword = financialKeywords.some(keyword => promptLower.includes(keyword));
      
      // Check for amount patterns
      const hasAmount = /\d+/.test(prompt);
      
      // Check for time references
      const hasTimeReference = /(?:in|for|within|by|months?|years?|yrs?|mos?)/i.test(prompt);
      
      return hasFinancialKeyword && hasAmount && hasTimeReference;
    };

    // Helper function to extract amount and time period from prompt
    const extractGoalDetails = (prompt) => {
      if (!prompt) return { amount: 0, months: 24, isValid: false };
      
      // First validate if this is a meaningful financial goal
      if (!isValidFinancialGoal(prompt)) {
        return { amount: 0, months: 24, isValid: false, reason: 'Not a meaningful financial goal' };
      }
      
      // Match patterns like "5 cr", "300k", "5000" etc.
      const amountMatch = prompt.match(/(\d+(?:\.\d+)?)(?:\s*(?:lakhs?|cr(?:ores?)?|k|thousand|million|mn|m|billion|bn|b)|\s*[a-z]*)/i);
      // Match time periods like "in 24 months", "for 1 year", "in 6 months" etc.
      const timeMatch = prompt.match(/(?:in|for)\s*(\d+)\s*(months?|years?|yrs?|mos?)/i);
      
      let amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
      let timeValue = timeMatch ? parseInt(timeMatch[1]) : 24;
      let timeUnit = timeMatch ? timeMatch[2].toLowerCase() : 'months';
      
      // Convert amount to base units (e.g., 5 cr -> 50000000, 300k -> 300000)
      if (amountMatch) {
        const unit = amountMatch[2]?.toLowerCase() || '';
        if (unit.includes('cr') || unit.includes('crore')) amount *= 10000000;
        else if (unit.includes('lakh')) amount *= 100000;
        else if (unit === 'k' || unit.includes('thousand')) amount *= 1000;
        else if (unit === 'm' || unit.includes('million') || unit === 'mn') amount *= 1000000;
        else if (unit === 'b' || unit.includes('billion') || unit === 'bn') amount *= 1000000000;
      }
      
      // Convert years to months for consistent calculation
      if (timeUnit.startsWith('year') || timeUnit.startsWith('yr')) {
        timeValue *= 12;
      }
      
      return { 
        amount: Math.round(amount), 
        months: timeValue,
        originalPrompt: prompt,
        isValid: true
      };
    };

    // Helper function to format currency with Indian Rupee symbol
    const formatCurrency = (amount) => {
      if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
      return `₹${amount.toLocaleString('en-IN')}`;
    };

    // Helper function for detailed fallback analysis
    const generateDetailedFallback = (prompt, income, savings, expenses, goalAmount, goalMonths) => {
      const monthlySavingsNeeded = goalAmount > 0 ? Math.ceil(goalAmount / goalMonths) : 0;
      const disposableIncome = income - expenses;
      const isFeasible = disposableIncome >= monthlySavingsNeeded;
      const shortfall = isFeasible ? 0 : monthlySavingsNeeded - disposableIncome;
      
      let feasibilityAnalysis = '';
      if (income <= 0) {
        feasibilityAnalysis = "**Status:** ⚠️ Income data unavailable. Please update your financial profile for personalized advice.";
      } else if (monthlySavingsNeeded === 0) {
        feasibilityAnalysis = "**Status:** ℹ️ Please specify both target amount and time frame for specific recommendations.";
      } else {
        feasibilityAnalysis = isFeasible
          ? `**Status:** ✅ **ACHIEVABLE!** Your goal requires saving ${formatCurrency(monthlySavingsNeeded)}/month, which is within your current disposable income of ${formatCurrency(disposableIncome)}/month.`
          : `**Status:** ⚠️ **CHALLENGING** - Your goal requires saving ${formatCurrency(monthlySavingsNeeded)}/month, but you only have ${formatCurrency(disposableIncome)} available after expenses. **Income gap:** ${formatCurrency(shortfall)}/month.`;
      }

      return `# Financial Goal Analysis: ${prompt}

## 📊 Goal Feasibility Assessment
${feasibilityAnalysis}

## 💰 Current Financial Snapshot
| Metric | Amount | Status |
|--------|--------|--------|
| **Monthly Income** | ${formatCurrency(income)} | ${income > 0 ? '✅' : '⚠️'} |
| **Monthly Expenses** | ${formatCurrency(expenses)} | ${expenses > 0 ? '✅' : '⚠️'} |
| **Disposable Income** | ${formatCurrency(Math.max(0, disposableIncome))}/month | ${disposableIncome > 0 ? '✅' : '⚠️'} |
| **Current Savings** | ${formatCurrency(savings)} | ${savings > 0 ? '✅' : '⚠️'} |
| **Required Monthly Savings** | ${formatCurrency(monthlySavingsNeeded)} | ${monthlySavingsNeeded > 0 ? '🎯' : 'ℹ️'} |

## 🎯 Strategic Recommendations

### Immediate Actions (This Month)
1. **📱 Expense Tracking**: Use a budgeting app to monitor all spending
2. **🏦 Emergency Fund**: Target 3-6 months of expenses (${formatCurrency(expenses * 3)} - ${formatCurrency(expenses * 6)})
3. **💳 Debt Review**: List all debts by interest rate, prioritize high-interest ones
4. **💰 Savings Automation**: Set up auto-transfer of ${formatCurrency(Math.min(monthlySavingsNeeded, disposableIncome))}/month

### Medium-term Actions (3-6 months)
- **📊 Budget Optimization**: Identify 2-3 expense categories to reduce by 15-20%
- **💼 Income Enhancement**: Explore side gigs, freelance, or skill development
- **🏠 Expense Reduction**: Review subscriptions, utilities, and recurring costs

## 📈 Progress Tracking
- **Monthly Check-ins**: Review progress every 30 days
- **Milestone Celebrations**: Acknowledge achievements at 25%, 50%, 75%
- **Adjustment Points**: Reassess timeline if income/expenses change significantly

## ⚠️ Risk Considerations
- **Income Volatility**: Have backup plans for income fluctuations
- **Emergency Expenses**: Maintain separate emergency fund
- **Market Conditions**: Consider inflation impact on goal amount

---
*This analysis is based on current financial data. For investment advice, consult a certified financial planner. Update your financial profile regularly for more accurate recommendations.*`;
    };

    try {
      console.log('Generating budget suggestion...');
      const goalDetails = extractGoalDetails(prompt);
      
      // Check if the prompt is a valid financial goal
      if (!goalDetails.isValid) {
        return `I couldn't understand your financial goal. Please provide a more specific goal like:

**Examples of good financial goals:**
- "I want to save ₹5 lakhs for a house down payment in 2 years"
- "I need to buy a car worth ₹8 lakhs in 18 months"
- "I want to save ₹2 crores for retirement in 20 years"
- "I need ₹50,000 for emergency fund in 6 months"

**Your input was:** "${prompt}"

**What to include:**
✅ Specific amount (e.g., ₹5 lakhs, $10,000)
✅ Time frame (e.g., in 2 years, within 6 months)
✅ Financial context (e.g., save for, buy, invest in)

Please try again with a clearer financial goal!`;
      }
      
      const { amount: goalAmount, months: goalMonths } = goalDetails;
      const monthlyIncome = financialOverview?.total_monthly_income || 0;
      const currentSavings = financialOverview?.total_savings || 0;
      const monthlyExpenses = financialOverview?.total_expenses || 0;
      
      // Calculate basic financial metrics
      const monthlySavingsNeeded = goalAmount > 0 ? Math.ceil(goalAmount / goalMonths) : 0;
      const currentSavingsRate = monthlyIncome > 0 
        ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 
        : 0;
      const requiredSavingsRate = monthlyIncome > 0 
        ? (monthlySavingsNeeded / monthlyIncome) * 100 
        : 0;

      // Create a more intelligent and professional prompt
      const systemPrompt = `You are a certified financial advisor with expertise in personal finance and budgeting. You are analyzing a user's financial situation to help them achieve a specific goal.

**IMPORTANT RULES:**
1. Always provide professional, actionable financial advice
2. Use clear, structured formatting with proper headers
3. Include specific numbers and percentages
4. Be encouraging but realistic about goals
5. Focus on practical steps the user can take immediately
6. Use professional financial terminology
7. Format currency as ₹X,XXX (Indian Rupees)

**Current Financial Status:**
- Monthly Income: ${formatCurrency(monthlyIncome)}
- Current Savings: ${formatCurrency(currentSavings)}
- Monthly Expenses: ${formatCurrency(monthlyExpenses)}
- Current Savings Rate: ${currentSavingsRate.toFixed(1)}% of income
- Disposable Income: ${formatCurrency(Math.max(0, monthlyIncome - monthlyExpenses))}/month

**User's Financial Goal:**
- Goal Description: "${prompt}"
- Target Amount: ${formatCurrency(goalAmount)}
- Time Frame: ${goalMonths} months
- Required Monthly Savings: ${formatCurrency(monthlySavingsNeeded)}
- Required Savings Rate: ${requiredSavingsRate.toFixed(1)}% of monthly income

**Provide a comprehensive financial analysis with these sections:**

## 1. Goal Feasibility Assessment
- **Realistic Assessment:** Is this goal achievable given current finances?
- **Savings Analysis:** Required vs. current savings rate comparison
- **Risk Factors:** What could prevent goal achievement?

## 2. Financial Health Analysis
- **Current Standing:** Assessment of income, expenses, and savings
- **Gap Analysis:** What needs to change to reach the goal?
- **Emergency Fund Status:** Current vs. recommended emergency fund

## 3. Strategic Recommendations
- **Expense Optimization:** Specific categories to reduce (with amounts)
- **Income Enhancement:** Realistic ways to increase monthly income
- **Savings Strategy:** Optimal savings allocation and automation

## 4. Action Plan
- **Monthly Targets:** Specific savings and spending targets
- **Timeline Adjustments:** If needed, realistic timeline modifications
- **Milestone Tracking:** Key checkpoints to measure progress

## 5. Risk Mitigation
- **Contingency Plans:** What if income decreases or expenses increase?
- **Insurance Considerations:** Protection for financial goals
- **Investment Strategy:** Safe investment options for savings

Format your response professionally with clear headers, bullet points, and actionable advice. Be specific with numbers and percentages.`;

      try {
        // Try to get AI response
        const result = await this.withRetry(async () => {
          const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
          });
          return result.response;
        }, 3, 2000);

        const text = await result.text();
        console.log('Successfully generated AI suggestion');
        return text;
      } catch (error) {
        console.error('AI API Error:', {
          message: error.message,
          status: error.status,
          code: error.code
        });
        
        // Fallback to detailed analysis if AI fails
        return generateDetailedFallback(
          prompt,
          monthlyIncome,
          currentSavings,
          monthlyExpenses,
          goalAmount,
          goalMonths
        );
      }
    } catch (error) {
      console.error('Error in generateBudgetSuggestion:', {
        message: error.message,
        stack: error.stack
      });
      
      // Return a helpful error message with guidance
      return `# Financial Analysis Service Temporarily Unavailable

## ⚠️ What Happened
We're experiencing technical difficulties with our AI financial analysis service.

## 🔧 What You Can Do
1. **Try Again**: Wait a few minutes and try your request again
2. **Check Your Data**: Ensure your financial profile is complete and up-to-date
3. **Use Manual Planning**: Use the budget settings below to plan manually
4. **Contact Support**: If the issue persists, please report it

## 📝 Your Goal
**Goal:** "${prompt}"
**Status:** Pending analysis

## 💡 Alternative Planning
While we resolve this issue, you can:
- Set your monthly budget manually in the settings below
- Use the 50/30/20 rule (50% needs, 30% wants, 20% savings)
- Aim for saving 20-30% of your monthly income
- Build an emergency fund of 3-6 months of expenses

---
*We apologize for the inconvenience. Our team is working to restore full service.*`;
    }
  }
}

module.exports = AIService;
