// server/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import recurring expenses processing
const recurringExpenses = require('./recurring-expenses');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase body size limits to support base64-encoded images from receipt scans
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Starting recurring expenses processing...');
  
  // Run recurring expenses processing after server starts
  setTimeout(() => {
    console.log('Recurring expenses processing started');
  }, 1000);
});
