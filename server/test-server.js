// Simple test to check if the server and AI service work
require('dotenv').config();

console.log('=== SERVER TEST ===');
console.log('Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');

// Test AI Service
try {
  const AIService = require('./services/aiService');
  const aiService = new AIService();
  console.log('✅ AI Service loaded successfully');
  
  // Test a simple prompt
  aiService.processBudgetPrompt('Set my food budget to 500', {})
    .then(response => {
      console.log('✅ AI Service test successful:', response);
    })
    .catch(error => {
      console.log('❌ AI Service test failed:', error.message);
    });
    
} catch (error) {
  console.log('❌ Failed to load AI Service:', error.message);
}

// Test Express server
try {
  const express = require('express');
  const cors = require('cors');
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Simple test route
  app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!', timestamp: new Date() });
  });
  
  // Test AI route
  app.post('/api/ai/test', (req, res) => {
    res.json({ 
      message: 'AI endpoint is working!', 
      body: req.body,
      timestamp: new Date() 
    });
  });
  
  const PORT = 5001; // Use different port to avoid conflicts
  app.listen(PORT, () => {
    console.log(`✅ Test server running on port ${PORT}`);
    console.log(`Test it: http://localhost:${PORT}/test`);
  });
  
} catch (error) {
  console.log('❌ Failed to start test server:', error.message);
}
