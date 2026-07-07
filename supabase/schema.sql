-- NCS Operations System (React + Supabase edition) — schema
-- Run this once in your Supabase project's SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: everything is guarded with "if not exists" / "or replace".

create extension if not exists pgcrypto;

-- ============================================================================
-- profiles — one row per team member, mirrors the old data/db.json "users"
-- array. id is the same uuid as the Supabase Auth user. No public signup —
-- rows are created by scripts/add-user.mjs or scripts/migrate-from-json.mjs.
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

-- Auto-create a profile row when an auth user is created with username/name
-- in its metadata (both add-user.mjs and migrate-from-json.mjs set this).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- cards — one row per job, across all three boards. fields/notes/attachments/
-- activity stay as JSONB, mirroring the shape of the old db.json cards[]
-- entries exactly (see NCS-board/CLAUDE.md "Data Model" section).
-- ============================================================================
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('appraisal', 'estimate', 'payment')),
  job_id text,
  status text not null,
  priority text not null default 'medium',
  assigned_to text not null default '',
  next_step text not null default '',
  latest_update text not null default '',
  date_updated date not null default current_date,
  fields jsonb not null default '{}'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  activity jsonb not null default '[]'::jsonb,
  "order" numeric not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_board_status_idx on public.cards (board, status);
create unique index if not exists cards_board_job_id_idx on public.cards (board, job_id) where job_id is not null;

alter table public.cards enable row level security;

drop policy if exists "cards_all_authenticated" on public.cards;
create policy "cards_all_authenticated" on public.cards
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================================
-- counters — atomic per-board Job ID sequence (APP-0001, EST-0001, PAY-0001...).
-- The table itself is locked down; all access goes through next_job_id() below,
-- which runs as owner (security definer) so the increment is atomic even with
-- many browser clients creating cards at once — no client ever reads/writes
-- this table directly.
-- ============================================================================
create table if not exists public.counters (
  id text primary key,
  value integer not null default 0
);

alter table public.counters enable row level security;
-- Intentionally no policies — nobody can select/insert/update this table
-- directly; only next_job_id() (security definer) can touch it.

create or replace function public.next_job_id(prefix text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  key text := lower(prefix);
  next_value integer;
begin
  insert into public.counters (id, value) values (key, 1)
  on conflict (id) do update set value = public.counters.value + 1
  returning value into next_value;

  return prefix || '-' || lpad(next_value::text, 4, '0');
end;
$$;

revoke all on function public.next_job_id(text) from public;
grant execute on function public.next_job_id(text) to authenticated;

-- ============================================================================
-- Storage — private "attachments" bucket for file uploads (replaces the old
-- local /uploads + multer). The app requests short-lived signed URLs to
-- display/download files rather than relying on a public bucket.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments_read_authenticated" on storage.objects;
create policy "attachments_read_authenticated" on storage.objects
  for select using (bucket_id = 'attachments' and auth.role() = 'authenticated');

drop policy if exists "attachments_write_authenticated" on storage.objects;
create policy "attachments_write_authenticated" on storage.objects
  for insert with check (bucket_id = 'attachments' and auth.role() = 'authenticated');

drop policy if exists "attachments_delete_authenticated" on storage.objects;
create policy "attachments_delete_authenticated" on storage.objects
  for delete using (bucket_id = 'attachments' and auth.role() = 'authenticated');
