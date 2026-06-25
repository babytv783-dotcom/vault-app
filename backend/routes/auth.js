// routes/auth.js
// One route: POST /api/login. Checks the password against the hash
// stored in an environment variable (set during deployment), and
// returns a token if correct.

const express = require('express');
const bcrypt = require('bcryptjs');
const { signToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const storedHash = process.env.OWNER_PASSWORD_HASH;
  if (!storedHash) {
    return res.status(500).json({ error: 'Server is not configured with a password yet.' });
  }

  const matches = await bcrypt.compare(password, storedHash);
  if (!matches) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const token = signToken();
  res.json({ token });
});

module.exports = router;
