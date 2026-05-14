// Simple working AI server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// CORS setup
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

app.use(express.json());

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date(),
    env: {
      supabase: !!process.env.SUPABASE_URL,
      gemini: !!process.env.GEMINI_API_KEY
    }
  });
});

// Simple AI endpoint
app.post('/api/ai/process-prompt', async (req, res) => {
  console.log('🤖 AI endpoint hit!');
  console.log('Request body:', req.body);
  
  try {
    const { prompt, userId } = req.body;
    
    if (!prompt || !userId) {
      return res.status(400).json({ error: 'Missing prompt or userId' });
    }
    
    console.log('Processing prompt:', prompt);
    
    // Simple AI processing
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const aiPrompt = `You are a budget assistant. The user said: "${prompt}"
    
    Respond with ONLY a JSON object in this format:
    {
      "type": "budget_update",
      "changes": {
        "food": 500
      },
      "message": "I've set your food budget to $500"
    }
    
    OR for expenses:
    {
      "type": "expense",
      "expenses": [
        {
          "category": "Food",
          "amount": 25.50,
          "description": "Lunch"
        }
      ],
      "message": "I've added your expense"
    }`;
    
    const result = await model.generateContent(aiPrompt);
    const response = result.response;
    let aiText = response.text();
    
    console.log('AI Response:', aiText);
    
    // Clean up the response
    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let aiResponse;
    try {
      aiResponse = JSON.parse(aiText);
    } catch (e) {
      // Fallback response
      aiResponse = {
        type: "message",
        message: "I received your request but couldn't process it properly. Please try again."
      };
    }
    
    console.log('Parsed AI Response:', aiResponse);
    
    // Handle budget updates
    if (aiResponse.type === 'budget_update' && aiResponse.changes) {
      console.log('Updating budget...');
      
      const { error } = await supabase
        .from('budgets')
        .update(aiResponse.changes)
        .eq('user_id', userId);
        
      if (error) {
        console.error('Budget update error:', error);
        return res.status(500).json({ error: 'Failed to update budget' });
      }
    }
    
    // Handle expense additions
    if (aiResponse.type === 'expense' && aiResponse.expenses) {
      console.log('Adding expenses...');
      
      for (const expense of aiResponse.expenses) {
        const { error } = await supabase
          .from('expenses')
          .insert({
            user_id: userId,
            category: expense.category,
            amount: expense.amount,
            description: expense.description,
            date: new Date().toISOString().split('T')[0]
          });
          
        if (error) {
          console.error('Expense add error:', error);
        }
      }
    }
    
    res.json({
      success: true,
      response: aiResponse
    });
    
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ 
      error: 'AI processing failed',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Simple AI Server running on port ${PORT}`);
  console.log(`Test: http://localhost:${PORT}/api/test`);
  console.log('Environment check:');
  console.log('- Supabase URL:', !!process.env.SUPABASE_URL);
  console.log('- Supabase Key:', !!process.env.SUPABASE_ANON_KEY);
  console.log('- Gemini Key:', !!process.env.GEMINI_API_KEY);
});
