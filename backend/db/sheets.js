// db/sheets.js
// Connects to a single Google Sheet using a service account, and writes
// account data into it. Sync only happens when explicitly requested
// (from chat, via the save_to_sheet tool) — never automatic, same
// philosophy as the in-app "screens" refresh behavior.

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function getAuth() {
  // The service account's credentials are stored as a single JSON
  // string in an environment variable (GOOGLE_SERVICE_ACCOUNT_JSON),
  // rather than a file on disk, since Render's environment doesn't
  // give us a persistent place to keep a credentials file.
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

// Reads the current contents of the sheet so we can match existing
// rows (by email + game) instead of always appending duplicates.
async function readSheet() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:Z',
  });
  return res.data.values || [];
}

// Writes one account's data into the sheet. Matches an existing row by
// email + game (columns A and B); if found, updates that row in place.
// If not found, appends a new row. Headers in row 1 are read dynamically
// so the sheet's columns can be reordered or renamed without breaking this.
async function saveAccountToSheet({ email, username, game, fields }) {
  const sheets = await getSheetsClient();
  const rows = await readSheet();

  const headers = rows[0] || ['Email', 'Game', 'Status', 'Notes'];
  const headerIndex = {};
  headers.forEach((h, i) => (headerIndex[h.toLowerCase()] = i));

  // Build the row's values for whatever columns already exist in the
  // sheet, mapping our known fields onto matching header names.
  const rowValues = new Array(headers.length).fill('');
  const setIfPresent = (key, value) => {
    if (value === undefined || value === null) return;
    const idx = headerIndex[key.toLowerCase()];
    if (idx !== undefined) rowValues[idx] = String(value);
  };

  setIfPresent('email', email);
  setIfPresent('username', username);
  setIfPresent('game', game);
  for (const [key, value] of Object.entries(fields || {})) {
    setIfPresent(key, value);
  }

  // Find an existing row matching this email/username + game.
  const emailCol = headerIndex['email'];
  const usernameCol = headerIndex['username'];
  const gameCol = headerIndex['game'];

  let matchRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sameGame = gameCol !== undefined && row[gameCol] === game;
    const sameEmail = emailCol !== undefined && email && row[emailCol] === email;
    const sameUsername = usernameCol !== undefined && username && row[usernameCol] === username;
    if (sameGame && (sameEmail || sameUsername)) {
      matchRowIndex = i;
      break;
    }
  }

  if (matchRowIndex >= 0) {
    // Merge: keep existing values for any column we didn't just set.
    const existingRow = rows[matchRowIndex];
    const merged = headers.map((_, i) => (rowValues[i] !== '' ? rowValues[i] : existingRow[i] || ''));
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Sheet1!A${matchRowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [merged] },
    });
    return { ok: true, action: 'updated', row: matchRowIndex + 1 };
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:Z',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowValues] },
    });
    return { ok: true, action: 'appended' };
  }
}

module.exports = { saveAccountToSheet, readSheet };
