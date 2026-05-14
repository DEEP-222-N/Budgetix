// server/routes/coachRoutes.js
const express = require('express');
const router = express.Router();
const coach = require('../services/coachService');

// POST /api/coach/chat  — Server-Sent Events streaming chat with function calling
// Body: { userId, messages: [{role, content}, ...] }
router.post('/chat', async (req, res) => {
  const { userId, messages } = req.body;
  if (!userId || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'userId and messages[] are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let closed = false;
  res.on('close', () => { closed = true; });

  try {
    for await (const event of coach.streamChat(userId, messages)) {
      if (closed) break;
      send(event);
    }
  } catch (err) {
    console.error('Coach chat error:', err);
    if (!closed) send({ type: 'error', message: err.message || 'Chat failed' });
  } finally {
    if (!closed) res.end();
  }
});

// GET /api/coach/forecast/:userId
router.get('/forecast/:userId', async (req, res) => {
  try {
    const forecast = await coach.computeForecast(req.params.userId);
    res.json({ success: true, forecast });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/coach/anomalies/:userId
router.get('/anomalies/:userId', async (req, res) => {
  try {
    const anomalies = await coach.detectAnomalies(req.params.userId);
    res.json({ success: true, anomalies });
  } catch (err) {
    console.error('Anomalies error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/coach/subscriptions/:userId
router.get('/subscriptions/:userId', async (req, res) => {
  try {
    const subscriptions = await coach.detectSubscriptions(req.params.userId);
    res.json({ success: true, subscriptions });
  } catch (err) {
    console.error('Subscriptions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/coach/categorize  Body: { userId, description, amount? }
router.post('/categorize', async (req, res) => {
  try {
    const { userId, description, amount } = req.body;
    if (!userId || !description) {
      return res.status(400).json({ error: 'userId and description are required' });
    }
    const suggestion = await coach.suggestCategory(userId, description, amount);
    res.json({ success: true, suggestion });
  } catch (err) {
    console.error('Categorize error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
