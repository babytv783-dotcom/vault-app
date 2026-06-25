// routes/accounts.js
// Implements the "notebook" model:
//  - finding/creating an account by email or username + game
//  - setting fields on it (overwrites current value)
//  - logging the previous value to history before overwriting
//  - listing everything for chat context or screen-building

const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// Find an existing account by email/username + game, or create one.
// This is the core "is this the same account?" matching logic.
async function findOrCreateAccount({ email, username, game }) {
  const existing = await pool.query(
    `select * from accounts
     where game = $1 and (
       (email is not null and email = $2) or
       (username is not null and username = $3)
     )
     limit 1`,
    [game, email || null, username || null]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const created = await pool.query(
    `insert into accounts (email, username, game) values ($1, $2, $3) returning *`,
    [email || null, username || null, game]
  );
  return created.rows[0];
}

// Set a field on an account. If the field already exists with a
// different value, the old value is logged to history before the
// overwrite — this is the "before/after" behavior from the spec.
async function setField(accountId, fieldKey, fieldValue) {
  const existing = await pool.query(
    `select * from account_fields where account_id = $1 and field_key = $2`,
    [accountId, fieldKey]
  );

  if (existing.rows.length > 0) {
    const oldValue = existing.rows[0].field_value;
    if (oldValue !== fieldValue) {
      await pool.query(
        `insert into account_field_history (account_id, field_key, old_value, new_value)
         values ($1, $2, $3, $4)`,
        [accountId, fieldKey, oldValue, fieldValue]
      );
    }
    await pool.query(
      `update account_fields set field_value = $1, updated_at = now()
       where account_id = $2 and field_key = $3`,
      [fieldValue, accountId, fieldKey]
    );
  } else {
    await pool.query(
      `insert into account_fields (account_id, field_key, field_value) values ($1, $2, $3)`,
      [accountId, fieldKey, fieldValue]
    );
    await pool.query(
      `insert into account_field_history (account_id, field_key, old_value, new_value)
       values ($1, $2, null, $3)`,
      [accountId, fieldKey, fieldValue]
    );
  }

  await pool.query(`update accounts set updated_at = now() where id = $1`, [accountId]);
}

// GET /api/accounts — list every account with its current fields.
// Used both by the frontend and by the AI when it needs full context.
router.get('/', async (req, res) => {
  const accounts = await pool.query(`select * from accounts order by updated_at desc`);
  const fields = await pool.query(`select * from account_fields`);

  const fieldsByAccount = {};
  for (const f of fields.rows) {
    if (!fieldsByAccount[f.account_id]) fieldsByAccount[f.account_id] = {};
    fieldsByAccount[f.account_id][f.field_key] = f.field_value;
  }

  const result = accounts.rows.map((a) => ({
    ...a,
    fields: fieldsByAccount[a.id] || {},
  }));

  res.json(result);
});

// GET /api/accounts/:id/history — full change log for one account.
router.get('/:id/history', async (req, res) => {
  const history = await pool.query(
    `select * from account_field_history where account_id = $1 order by changed_at desc`,
    [req.params.id]
  );
  res.json(history.rows);
});

// POST /api/accounts/upsert — create or update an account + its fields.
// Body: { email?, username?, game, fields: { status: "deleted", ... } }
router.post('/upsert', async (req, res) => {
  const { email, username, game, fields = {} } = req.body;

  if (!game || (!email && !username)) {
    return res.status(400).json({ error: 'game and (email or username) are required.' });
  }

  const account = await findOrCreateAccount({ email, username, game });

  for (const [key, value] of Object.entries(fields)) {
    await setField(account.id, key, String(value));
  }

  const updatedFields = await pool.query(
    `select field_key, field_value from account_fields where account_id = $1`,
    [account.id]
  );
  const fieldMap = {};
  updatedFields.rows.forEach((f) => (fieldMap[f.field_key] = f.field_value));

  res.json({ ...account, fields: fieldMap });
});

// DELETE /api/accounts/:id — remove an account entirely (rare; most
// "deletions" should just be a status field change, not a real delete).
router.delete('/:id', async (req, res) => {
  await pool.query(`delete from accounts where id = $1`, [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
