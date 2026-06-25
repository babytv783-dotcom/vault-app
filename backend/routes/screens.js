// routes/screens.js
// Multiple named screens, each either a table or a notes screen.
// Tables support adding/renaming/removing columns and editing cells
// directly (the spreadsheet-like behavior from the confirmed mockup).

const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/screens — list all screens (just name/type/id, for the sidebar).
router.get('/', async (req, res) => {
  const result = await pool.query(
    `select id, name, type, updated_at from screens order by created_at asc`
  );
  res.json(result.rows);
});

// POST /api/screens — create a new named screen.
// Body: { name: "Game accounts", type: "table" | "notes" }
router.post('/', async (req, res) => {
  const { name, type } = req.body;
  if (!name || !['table', 'notes'].includes(type)) {
    return res.status(400).json({ error: 'name and a valid type ("table" or "notes") are required.' });
  }

  const created = await pool.query(
    `insert into screens (name, type) values ($1, $2) returning *`,
    [name, type]
  );
  const screen = created.rows[0];

  if (type === 'table') {
    // every new table starts with one default column so it's not empty
    await pool.query(
      `insert into screen_columns (screen_id, column_name, position) values ($1, $2, 0)`,
      [screen.id, 'Column 1']
    );
  }

  res.json(screen);
});

// DELETE /api/screens/:id
router.delete('/:id', async (req, res) => {
  await pool.query(`delete from screens where id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// ---------- TABLE SCREEN CONTENT ----------

// GET /api/screens/:id/table — full table contents (columns + rows).
router.get('/:id/table', async (req, res) => {
  const columns = await pool.query(
    `select * from screen_columns where screen_id = $1 order by position asc`,
    [req.params.id]
  );
  const rows = await pool.query(
    `select * from screen_rows where screen_id = $1 order by position asc`,
    [req.params.id]
  );
  res.json({ columns: columns.rows, rows: rows.rows });
});

// POST /api/screens/:id/columns — add a new column.
// Body: { name: "Platform" }
router.post('/:id/columns', async (req, res) => {
  const { name } = req.body;
  const screenId = req.params.id;

  const maxPos = await pool.query(
    `select coalesce(max(position), -1) as max from screen_columns where screen_id = $1`,
    [screenId]
  );
  const nextPos = maxPos.rows[0].max + 1;

  const created = await pool.query(
    `insert into screen_columns (screen_id, column_name, position) values ($1, $2, $3) returning *`,
    [screenId, name || 'New column', nextPos]
  );

  res.json(created.rows[0]);
});

// PATCH /api/screens/columns/:columnId — rename a column.
router.patch('/columns/:columnId', async (req, res) => {
  const { name } = req.body;
  const updated = await pool.query(
    `update screen_columns set column_name = $1 where id = $2 returning *`,
    [name, req.params.columnId]
  );
  res.json(updated.rows[0]);
});

// DELETE /api/screens/columns/:columnId — remove a column.
router.delete('/columns/:columnId', async (req, res) => {
  await pool.query(`delete from screen_columns where id = $1`, [req.params.columnId]);
  res.json({ ok: true });
});

// POST /api/screens/:id/rows — add a new row.
// Body: { row_data: { "<columnId>": "value", ... } }
router.post('/:id/rows', async (req, res) => {
  const { row_data = {} } = req.body;
  const screenId = req.params.id;

  const maxPos = await pool.query(
    `select coalesce(max(position), -1) as max from screen_rows where screen_id = $1`,
    [screenId]
  );
  const nextPos = maxPos.rows[0].max + 1;

  const created = await pool.query(
    `insert into screen_rows (screen_id, row_data, position) values ($1, $2, $3) returning *`,
    [screenId, row_data, nextPos]
  );

  res.json(created.rows[0]);
});

// PATCH /api/screens/rows/:rowId — edit a row's cell data.
// Body: { row_data: { "<columnId>": "new value", ... } } (merged, not replaced)
router.patch('/rows/:rowId', async (req, res) => {
  const { row_data = {} } = req.body;

  const existing = await pool.query(`select row_data from screen_rows where id = $1`, [req.params.rowId]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Row not found.' });
  }
  const merged = { ...existing.rows[0].row_data, ...row_data };

  const updated = await pool.query(
    `update screen_rows set row_data = $1 where id = $2 returning *`,
    [merged, req.params.rowId]
  );
  res.json(updated.rows[0]);
});

// DELETE /api/screens/rows/:rowId
router.delete('/rows/:rowId', async (req, res) => {
  await pool.query(`delete from screen_rows where id = $1`, [req.params.rowId]);
  res.json({ ok: true });
});

// ---------- NOTES SCREEN CONTENT ----------

// GET /api/screens/:id/notes
router.get('/:id/notes', async (req, res) => {
  const notes = await pool.query(
    `select * from screen_notes where screen_id = $1 order by created_at desc`,
    [req.params.id]
  );
  res.json(notes.rows);
});

// POST /api/screens/:id/notes — add a note card.
router.post('/:id/notes', async (req, res) => {
  const { title, body } = req.body;
  const created = await pool.query(
    `insert into screen_notes (screen_id, title, body) values ($1, $2, $3) returning *`,
    [req.params.id, title || null, body || '']
  );
  res.json(created.rows[0]);
});

// PATCH /api/screens/notes/:noteId — edit a note.
router.patch('/notes/:noteId', async (req, res) => {
  const { title, body } = req.body;
  const updated = await pool.query(
    `update screen_notes set title = coalesce($1, title), body = coalesce($2, body), updated_at = now()
     where id = $3 returning *`,
    [title, body, req.params.noteId]
  );
  res.json(updated.rows[0]);
});

// DELETE /api/screens/notes/:noteId
router.delete('/notes/:noteId', async (req, res) => {
  await pool.query(`delete from screen_notes where id = $1`, [req.params.noteId]);
  res.json({ ok: true });
});

module.exports = router;
