# NCS Operations System — React + Supabase edition

A React + Vite port of the original NCS-board app (kept untouched at
`../NCS-board`). Same boards, columns, cards, drag-and-drop, and dashboard —
Supabase (Postgres + Auth + Storage) replaces the Express server, so this app
deploys as a static site (e.g. Netlify) with no backend to run.

## 1. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com). From
**Project Settings → API** grab:
- Project URL
- `anon` `public` key
- `service_role` `secret` key (only used by local scripts — never deploy this)

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (both safe to expose
to the browser — that's what Supabase's Row Level Security is for). Fill in
`SUPABASE_SERVICE_ROLE_KEY` only if you'll run `npm run add-user` or
`npm run migrate` locally.

## 3. Set up the database

Open your Supabase project's **SQL Editor** and run the entire contents of
[`supabase/schema.sql`](supabase/schema.sql). This creates the `profiles`,
`cards`, and `counters` tables, the `next_job_id` function, Row Level
Security policies, and the private `attachments` Storage bucket. Safe to
re-run if you need to.

## 4. Install and run

```bash
npm install
npm run dev
```

Opens at http://localhost:5173.

## 5. Create your first login

There's no self-serve signup (matches the original app). Create team logins
with:

```bash
npm run add-user -- "zack" "a-strong-password" "Zack"
```

Team members sign in with just the username (`zack`) + password — under the
hood this maps to a synthetic email (`zack@ncs.local`) via Supabase Auth.
Re-running `add-user` for an existing username resets their password.

## 6. Migrating your existing data

Once you've confirmed the app works end-to-end against Supabase, import the
real data from the original app:

```bash
npm run migrate
```

This reads `../NCS-board/data/db.json` (read-only) and:
- creates a Supabase Auth user per existing username (with a **new temporary
  password** — bcrypt hashes can't be imported, so passwords can't carry
  over; the script prints the temp passwords to share with your team)
- seeds the Job ID counters so new jobs continue the existing numbering
- copies every card (fields, notes, attachments, activity) as-is
- uploads every referenced file in `../NCS-board/uploads/` into the Supabase
  Storage `attachments` bucket

Run it once. It's safe to re-run (upserts), but re-running `add-user`-style
account creation will still mint fresh temp passwords for anyone who already
has an account, so only re-run the whole script if you mean to.

## 7. Deploy to Netlify

- Push this folder to its own Git repo (or connect the monorepo with
  `NCS-Board-React` as the base directory).
- In Netlify: **New site from Git**, build command `npm run build`, publish
  directory `dist` (already configured in `netlify.toml`).
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Site settings
  → Environment variables**. Never add the service role key to Netlify.

## Architecture notes

- No Express/Node backend — the browser talks to Supabase directly using the
  public anon key. Postgres Row Level Security enforces "must be signed in."
- File attachments live in a **private** Storage bucket; the app requests
  short-lived signed URLs to display them rather than baking permanent
  public links into card data.
- `fields`, `notes`, `attachments`, and `activity` are stored as JSONB on the
  `cards` table — a 1:1 mirror of the original `data/db.json` card shape.
- Job ID generation (`APP-0001`, `EST-0001`, `PAY-0001`...) is atomic via the
  `next_job_id()` Postgres function, since there's no single server left to
  serialize requests.
