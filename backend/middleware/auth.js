// middleware/auth.js
// Single-user login. There's only ever one password (yours), set via
// an environment variable, never stored in code or in the database in
// plain text. A successful login returns a signed token; every other
// route in the app requires that token.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '30d'; // stay logged in for a month at a time

function signToken() {
  return jwt.sign({ user: 'owner' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const token = header.replace('Bearer ', '');
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again.' });
  }
}

module.exports = { signToken, requireAuth };
