-- =========================================================
-- Vault — database schema
-- One owner (you). Everything below belongs to that one user.
-- =========================================================

-- Each game account = one entry. Matched by email/username.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  email text,                 -- nullable: some accounts are username-only
  username text,
  game text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, game),
  unique (username, game)
);

-- Flexible key/value fields per account (status, rank, currency, notes...).
-- This is what lets every game track different things without a rigid schema.
create table if not exists account_fields (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  field_key text not null,     -- e.g. "status", "rank", "currency"
  field_value text not null,
  updated_at timestamptz not null default now(),
  unique (account_id, field_key)
);

-- History log — old values are kept here when a field is overwritten.
-- Lets you ask "what was this before?" later, without cluttering current state.
create table if not exists account_field_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  field_key text not null,
  old_value text,
  new_value text not null,
  changed_at timestamptz not null default now()
);

-- Screens — user-created tables or notes, each with its own name.
create table if not exists screens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('table', 'notes')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table screens: columns are stored as an ordered list so they can be
-- renamed / added / removed (the editable headers + "+" column feature).
create table if not exists screen_columns (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references screens(id) on delete cascade,
  column_name text not null,
  position int not null
);

-- Table screens: rows are stored as JSON keyed by column id, so adding a
-- column never requires a migration — it's just a new key in the JSON.
create table if not exists screen_rows (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references screens(id) on delete cascade,
  row_data jsonb not null default '{}'::jsonb,
  position int not null
);

-- Notes screens: simple free-text cards.
create table if not exists screen_notes (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references screens(id) on delete cascade,
  title text,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chat messages — permanent memory, never deleted.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_account_fields_account on account_fields(account_id);
create index if not exists idx_history_account on account_field_history(account_id);
create index if not exists idx_screen_columns_screen on screen_columns(screen_id);
create index if not exists idx_screen_rows_screen on screen_rows(screen_id);
create index if not exists idx_screen_notes_screen on screen_notes(screen_id);
create index if not exists idx_chat_created on chat_messages(created_at);
