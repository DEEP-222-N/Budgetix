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

  async generateBudgetSuggestion(prompt, budgetData, financialOverview) {
    // Helper function to extract amount and time period from prompt
    const extractGoalDetails = (prompt) => {
      if (!prompt) return { amount: 0, months: 24 };
      
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
        originalPrompt: prompt
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
        feasibilityAnalysis = "We couldn't determine your income. Please ensure your financial details are up to date.";
      } else if (monthlySavingsNeeded === 0) {
        feasibilityAnalysis = "Please specify both a target amount and time frame for more specific advice.";
      } else {
        feasibilityAnalysis = isFeasible
          ? `Your goal is achievable by saving ${formatCurrency(monthlySavingsNeeded)}/month.`
          : `Your goal requires saving ${formatCurrency(monthlySavingsNeeded)}/month, but you only have ${formatCurrency(disposableIncome)} available after expenses. You would need to either increase your income by ${formatCurrency(shortfall)}/month or adjust your goal.`;
      }

      return `## Financial Analysis: ${prompt}

### 1. Goal Feasibility
${feasibilityAnalysis}

### 2. Current Financial Snapshot
- **Monthly Income:** ${formatCurrency(income)}
- **Monthly Expenses:** ${formatCurrency(expenses)}
- **Disposable Income:** ${formatCurrency(Math.max(0, disposableIncome))}/month
- **Current Savings:** ${formatCurrency(savings)}
- **Required Monthly Savings:** ${formatCurrency(monthlySavingsNeeded)}

### 3. Recommended Actions
1. **Track Expenses**: Closely monitor all spending for the next month
2. **Emergency Fund**: Aim for 3-6 months of expenses (${formatCurrency(expenses * 3)} - ${formatCurrency(expenses * 6)})
3. **Debt Management**: Focus on paying down high-interest debts first
4. **Savings Automation**: Set up automatic transfers to a separate savings account

### 4. Next Steps
For a more detailed, personalized plan, please try the AI advisor again when available. In the meantime, consider:
- Reviewing recurring subscriptions and memberships
- Comparing utility providers for better rates
- Exploring ways to increase your income through side gigs or upskilling

*Note: This is a general analysis. For specific investment advice, please consult with a certified financial planner.*`;
    };

    try {
      console.log('Generating budget suggestion...');
      const { amount: goalAmount, months: goalMonths } = extractGoalDetails(prompt);
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

      // Create a more intelligent prompt
      const systemPrompt = `You are a financial advisor analyzing a user's budget. Consider their current financial situation:

Current Financial Status:
- Monthly Income: ${formatCurrency(monthlyIncome)}
- Current Savings: ${formatCurrency(currentSavings)}
- Monthly Expenses: ${formatCurrency(monthlyExpenses)}
- Current Savings Rate: ${currentSavingsRate.toFixed(1)}% of income

User's Goal: ${prompt}
- Target Amount: ${formatCurrency(goalAmount)}
- Time Frame: ${goalMonths} months
- Required Monthly Savings: ${formatCurrency(monthlySavingsNeeded)} (${requiredSavingsRate.toFixed(1)}% of income)

Please provide a detailed analysis with the following sections:

1. **Goal Feasibility Assessment**
   - Is this goal realistic given the user's current financial situation?
   - What percentage of their income would need to be saved?
   - How does this compare to their current savings rate?

2. **Category-Specific Recommendations**
   - Analyze their current spending in key categories
   - Suggest specific, realistic reductions in 2-3 categories
   - Recommend target percentages for each major expense category

3. **Action Plan**
   - Monthly savings target breakdown
   - Suggested timeline adjustments if needed
   - Recommended emergency fund level

4. **Additional Tips**
   - Ways to increase income
   - Tax optimization strategies
   - Investment options for the savings

Format the response in clear markdown with appropriate headers and bullet points.`;

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
      
      // Return a basic error message if something goes wrong
      return "I'm having trouble analyzing your financial situation right now. Please try again later or check your financial data.";
    }
  }
}

module.exports = AIService;
