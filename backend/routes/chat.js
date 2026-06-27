// routes/chat.js
// The core AI loop, powered by Groq's free API (OpenAI-compatible format).
// Every message is saved permanently (memory that's always on, no
// toggle). The AI decides whether you're telling it something (create/
// update an account fact) or asking it something (answer from stored
// data) or asking it to refresh a screen (explicit only — screens
// never auto-update).

const express = require('express');
const Groq = require('groq-sdk');
const pool = require('../db/pool');
const { saveAccountToSheet } = require('../db/sheets');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';

// Tools the AI can call. Kept intentionally narrow — this assistant
// only organizes account info, it never logs into anything or takes
// outside action, matching the agreed scope.
const tools = [
  {
    type: 'function',
    function: {
      name: 'save_account_fact',
      description:
        'Create a new account entry or update a field on an existing one. ' +
        'Always match by email or username + game first — if a matching ' +
        'account already exists, this updates it rather than creating a duplicate.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Account email, if known.' },
          username: { type: 'string', description: 'Account username, if known (use if no email).' },
          game: { type: 'string', description: 'The game this account belongs to.' },
          fields: {
            type: 'object',
            description: 'Key/value fields to set, e.g. {"status": "deleted", "rank": "Gold 2"}',
          },
        },
        required: ['game', 'fields'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_all_accounts',
      description: 'Retrieve every stored account and its current fields, to answer a question.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'refresh_screen',
      description:
        'Rebuild a named screen (table or notes) from the latest account data. ' +
        'Only call this when the user EXPLICITLY asks to update/refresh a specific screen by name — never automatically.',
      parameters: {
        type: 'object',
        properties: {
          screen_name: { type: 'string' },
        },
        required: ['screen_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_to_sheet',
      description:
        'Write an account\'s data into the connected Google Sheet. ' +
        'Only call this when the user EXPLICITLY asks to save/sync something to the sheet — ' +
        'never automatically after save_account_fact. Matches existing rows by email/username + game, ' +
        'updating in place rather than duplicating.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Account email, if known.' },
          username: { type: 'string', description: 'Account username, if known.' },
          game: { type: 'string', description: 'The game this account belongs to.' },
          fields: {
            type: 'object',
            description: 'Key/value fields to write, e.g. {"status": "deleted", "notes": "..."}',
          },
        },
        required: ['game'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_account_by_email',
      description:
        'Look up a single account directly by its email address (or username). ' +
        'Faster and more precise than get_all_accounts when the user gives a specific ' +
        'email/username to look up — use this instead of get_all_accounts whenever ' +
        'the user mentions a specific email or username.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'The email to search for.' },
          username: { type: 'string', description: 'The username to search for, if no email given.' },
        },
      },
    },
  },
];

async function getAllAccounts() {
  const accounts = await pool.query(`select * from accounts`);
  const fields = await pool.query(`select * from account_fields`);
  const byAccount = {};
  for (const f of fields.rows) {
    if (!byAccount[f.account_id]) byAccount[f.account_id] = {};
    byAccount[f.account_id][f.field_key] = f.field_value;
  }
  return accounts.rows.map((a) => ({ ...a, fields: byAccount[a.id] || {} }));
}

// Direct lookup by email or username — only fetches the matching
// account(s) instead of pulling every account, so this stays fast
// no matter how many accounts are stored.
async function findAccountByEmail({ email, username }) {
  if (!email && !username) {
    return { found: false, error: 'No email or username given.' };
  }
  const accounts = await pool.query(
    `select * from accounts where
       (email is not null and email = $1) or (username is not null and username = $2)`,
    [email || null, username || null]
  );
  if (accounts.rows.length === 0) {
    return { found: false };
  }
  const accountIds = accounts.rows.map((a) => a.id);
  const fields = await pool.query(
    `select * from account_fields where account_id = any($1::uuid[])`,
    [accountIds]
  );
  const byAccount = {};
  for (const f of fields.rows) {
    if (!byAccount[f.account_id]) byAccount[f.account_id] = {};
    byAccount[f.account_id][f.field_key] = f.field_value;
  }
  return {
    found: true,
    accounts: accounts.rows.map((a) => ({ ...a, fields: byAccount[a.id] || {} })),
  };
}

async function saveAccountFact({ email, username, game, fields }) {
  const existing = await pool.query(
    `select * from accounts where game = $1 and (
       (email is not null and email = $2) or (username is not null and username = $3)
     ) limit 1`,
    [game, email || null, username || null]
  );

  let account;
  if (existing.rows.length > 0) {
    account = existing.rows[0];
  } else {
    const created = await pool.query(
      `insert into accounts (email, username, game) values ($1, $2, $3) returning *`,
      [email || null, username || null, game]
    );
    account = created.rows[0];
  }

  for (const [key, value] of Object.entries(fields || {})) {
    const prior = await pool.query(
      `select field_value from account_fields where account_id = $1 and field_key = $2`,
      [account.id, key]
    );
    if (prior.rows.length > 0) {
      if (prior.rows[0].field_value !== String(value)) {
        await pool.query(
          `insert into account_field_history (account_id, field_key, old_value, new_value) values ($1,$2,$3,$4)`,
          [account.id, key, prior.rows[0].field_value, String(value)]
        );
      }
      await pool.query(
        `update account_fields set field_value = $1, updated_at = now() where account_id = $2 and field_key = $3`,
        [String(value), account.id, key]
      );
    } else {
      await pool.query(
        `insert into account_fields (account_id, field_key, field_value) values ($1,$2,$3)`,
        [account.id, key, String(value)]
      );
    }
  }
  await pool.query(`update accounts set updated_at = now() where id = $1`, [account.id]);
  return { ok: true, account_id: account.id };
}

async function refreshScreen(screenName) {
  const screenRes = await pool.query(`select * from screens where name ilike $1`, [screenName]);
  if (screenRes.rows.length === 0) {
    return { ok: false, error: `No screen named "${screenName}" exists.` };
  }
  const screen = screenRes.rows[0];

  if (screen.type !== 'table') {
    return { ok: false, error: `"${screenName}" is a notes screen, not a table — refresh only applies to tables.` };
  }

  const accounts = await getAllAccounts();

  const fieldKeys = new Set(['email', 'username', 'game']);
  accounts.forEach((a) => Object.keys(a.fields).forEach((k) => fieldKeys.add(k)));
  const orderedKeys = Array.from(fieldKeys);

  await pool.query(`delete from screen_columns where screen_id = $1`, [screen.id]);
  await pool.query(`delete from screen_rows where screen_id = $1`, [screen.id]);

  const colIdByKey = {};
  for (let i = 0; i < orderedKeys.length; i++) {
    const colRes = await pool.query(
      `insert into screen_columns (screen_id, column_name, position) values ($1,$2,$3) returning id`,
      [screen.id, orderedKeys[i], i]
    );
    colIdByKey[orderedKeys[i]] = colRes.rows[0].id;
  }

  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    const rowData = {};
    for (const key of orderedKeys) {
      const value = key === 'email' ? a.email : key === 'username' ? a.username : key === 'game' ? a.game : a.fields[key];
      if (value !== undefined && value !== null) rowData[colIdByKey[key]] = value;
    }
    await pool.query(
      `insert into screen_rows (screen_id, row_data, position) values ($1,$2,$3)`,
      [screen.id, rowData, i]
    );
  }

  await pool.query(`update screens set updated_at = now() where id = $1`, [screen.id]);
  return { ok: true, screen_name: screen.name, rows_written: accounts.length };
}

const systemPrompt = `You are Vault, a personal assistant that ONLY organizes the user's game account information — you never log into anything, never take real actions inside any game or account, and never browse the web. You just remember what the user tells you and answer questions about it.

Rules:
- When the user tells you a NEW fact or a CHANGE about an account, call save_account_fact. Match accounts by email or username + game — if it already exists, this updates it, it does not duplicate it.
- When the user only asks a question and gives no new information, call get_all_accounts and answer in plain text — do NOT call save_account_fact in this case, even if you're restating fields that already exist.
- If the user asks about a SPECIFIC email or username (e.g. "tell me about abcd@gmail.com"), call find_account_by_email instead of get_all_accounts — it's faster and more precise for a single lookup.
- Never call save_account_fact with a value that's identical to what's already stored — only call it when something is actually new or different.
- Only call refresh_screen if the user explicitly names a screen and asks you to update/refresh it. Never call it automatically after saving a fact.
- Only call save_to_sheet if the user explicitly asks to save/sync something to "the sheet" or "Google Sheet". Never call it automatically — saving to the database (save_account_fact) and saving to the sheet (save_to_sheet) are always separate, explicit actions.
- Keep answers short and direct.`;

router.post('/', async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  // Save the user's message immediately — memory is permanent and unconditional.
  await pool.query(`insert into chat_messages (role, content) values ('user', $1)`, [message]);

  // Pull recent history for context (small dataset for a personal tool,
  // so a simple "last N messages" window is enough — no vector search needed).
  const history = await pool.query(
    `select role, content from chat_messages order by created_at desc limit 30`
  );
  const recentMessages = history.rows.reverse().map((m) => ({ role: m.role, content: m.content }));

  let messages = [{ role: 'system', content: systemPrompt }, ...recentMessages];
  let finalText = '';
  let toolNotices = [];

  // Loop to allow multiple tool calls in one turn (e.g. save then confirm).
  for (let i = 0; i < 4; i++) {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages,
      tools,
    });

    const choice = response.choices[0];
    const msg = choice.message;
    finalText = msg.content || finalText;

    if (!msg.tool_calls || msg.tool_calls.length === 0) break;

    messages.push(msg);

    for (const toolCall of msg.tool_calls) {
      const name = toolCall.function.name;
      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }

      let result;
      if (name === 'save_account_fact') {
        result = await saveAccountFact(args);
        toolNotices.push(`Saved: ${args.game} — ${Object.keys(args.fields || {}).join(', ')}`);
      } else if (name === 'get_all_accounts') {
        result = await getAllAccounts();
      } else if (name === 'find_account_by_email') {
        result = await findAccountByEmail(args);
      } else if (name === 'refresh_screen') {
        result = await refreshScreen(args.screen_name);
        if (result.ok) toolNotices.push(`Screen "${result.screen_name}" refreshed`);
      } else if (name === 'save_to_sheet') {
        try {
          result = await saveAccountToSheet(args);
          toolNotices.push(`Saved to Google Sheet: ${args.game}`);
        } catch (err) {
          result = { ok: false, error: `Could not write to the sheet: ${err.message}` };
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  await pool.query(`insert into chat_messages (role, content) values ('assistant', $1)`, [finalText]);

  res.json({ reply: finalText, notices: toolNotices });
});

// GET /api/chat/history — full chat memory, for loading the chat view.
router.get('/history', async (req, res) => {
  const result = await pool.query(`select role, content, created_at from chat_messages order by created_at asc`);
  res.json(result.rows);
});

module.exports = router;
