const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    // You'll need to get a free API key from https://makersuite.google.com/app/apikey
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    
    this.budgetCategories = [
      'Food',
      'Transportation and Fuel',
      'Entertainment',
      'Housing',
      'Utilities',
      'Grocery',
      'Healthcare',
      'Education',
      'Shopping',
      'Personal Care',
      'Travel',
      'Other'
    ];
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

      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();
      
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

      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();
      
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
}

module.exports = AIService;
