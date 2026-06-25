# Vault — setup & deployment guide

This is your personal game-account assistant. Everything is already built —
this guide is what we'll follow tomorrow to put it online, 24/7.

## What you'll need (free accounts, no payment required)
1. A **Supabase** account — https://supabase.com (database + backups)
2. A **Render** account — https://render.com (runs the app continuously)
3. A **Groq API key** — https://console.groq.com/keys (powers the AI, free, no credit card)

## Step 1 — Create the database (Supabase)
1. Create a new Supabase project.
2. Open the SQL editor and run everything in `backend/db/schema.sql` — this
   creates all the tables (accounts, fields, screens, chat memory, etc).
3. Supabase takes automatic daily backups on its own — nothing extra to set up.
4. Copy your database connection string (Settings → Database → Connection string).

## Step 2 — Set your password
1. In `backend/`, run: `node generate-password-hash.js yourpassword`
2. Copy the output line into your `.env` file as `OWNER_PASSWORD_HASH`.
   This means your real password is never stored anywhere, only a hash of it.

## Step 3 — Fill in environment variables
Copy `backend/.env.example` to `backend/.env` and fill in:
- `DATABASE_URL` — from Supabase, step 1
- `JWT_SECRET` — any long random string (we'll generate one together)
- `OWNER_PASSWORD_HASH` — from step 2
- `GROQ_API_KEY` — from console.groq.com/keys

## Step 4 — Deploy the backend (Render)
1. Push this project to a GitHub repo (private is fine).
2. In Render: New → Web Service → connect the repo → root directory `backend`.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the same environment variables from your `.env` file in Render's dashboard.
5. Render gives you a permanent URL like `https://vault-backend.onrender.com`.

## Step 5 — Deploy the frontend (Render)
1. In Render: New → Static Site → same repo → root directory `frontend`.
2. Build command: `npm install && npm run build`. Publish directory: `dist`.
3. Update the frontend's API calls to point at your backend URL from step 4
   (we'll do this together — one line change in `vite.config.js`/build settings).

## Step 6 — Turn on uptime monitoring
Use a free service like UptimeRobot (https://uptimerobot.com) pointed at
`https://your-backend-url/api/health` — it will email you if the app ever
goes offline.

## After that
- Open your frontend's permanent URL from any device, log in with your password,
  and it's the same app we tested — now live 24/7.
- Daily backups, the login screen, and uptime alerts are all already active
  with no further setup.

---

We will walk through all six steps together — this file is just so nothing
gets lost between sessions.
