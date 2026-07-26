-- Logs AI injury/rehab searches run by club medical staff, so past searches
-- can be reviewed later. Rows are written server-side (via the service role
-- key, from app/api/ai-injury-search) after a successful AI response.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists ai_search_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete set null,
  query text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

alter table ai_search_logs enable row level security;

drop policy if exists "ai_search_logs_select_authenticated" on ai_search_logs;
create policy "ai_search_logs_select_authenticated" on ai_search_logs for select using (auth.role() = 'authenticated');

-- No insert/update/delete policy for regular clients: rows are only ever
-- written by the /api/ai-injury-search server route using the service role
-- key, which bypasses RLS entirely.
