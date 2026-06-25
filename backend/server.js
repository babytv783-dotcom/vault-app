// server.js
// Entry point. Wires together auth, accounts, screens, and chat routes
// behind the single-login middleware.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const screensRoutes = require('./routes/screens');
const chatRoutes = require('./routes/chat');

const app = express();
app.use(cors());
app.use(express.json());

// Health check — used by uptime monitoring (the "alert me if it goes down" piece).
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Login is the only unauthenticated route.
app.use('/api', authRoutes);

// Everything else requires a valid login token.
app.use('/api/accounts', requireAuth, accountsRoutes);
app.use('/api/screens', requireAuth, screensRoutes);
app.use('/api/chat', requireAuth, chatRoutes);

// Catch-all error handler so a bug in one request never crashes the
// whole server (directly addresses "I don't want any bugs/resets").
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server. Your data was not affected.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Vault backend running on port ${PORT}`);
});
