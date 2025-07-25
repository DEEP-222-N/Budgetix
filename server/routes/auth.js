// server/routes/auth.js
const express = require('express');
const router = express.Router();
const { signUp, signIn } = require('../controllers/authController');

router.post('/signup', signUp);
router.post('/login', signIn);

module.exports = router;
