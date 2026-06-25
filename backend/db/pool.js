// db/pool.js
// Single shared connection pool to the Supabase/Postgres database.
// All queries in the app go through this — one place to configure,
// one place to fix if the connection setup ever needs to change.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  // Log instead of crashing the whole server on a dropped connection.
  console.error('Unexpected database pool error:', err.message);
});

module.exports = pool;
