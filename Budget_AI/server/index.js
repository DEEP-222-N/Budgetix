// server/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

require('./recurring-expenses'); // Automatically run recurring job

const authRoutes = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
