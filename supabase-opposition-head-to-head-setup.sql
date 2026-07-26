-- Auto-researched head-to-head record + last meeting details per opponent,
-- kept up to date by asking Claude to search the web (see
-- app/api/opposition-head-to-head/route.ts). One row per opponent name.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists opposition_head_to_head (
  id uuid primary key default gen_random_uuid(),
  opponent_name text not null unique,
  played int,
  won int,
  drawn int,
  lost int,
  last_meeting_date text,
  last_meeting_venue text,
  last_meeting_competition text,
  last_meeting_result text,
  confidence text check (confidence in ('low', 'medium', 'high')),
  source_note text,
  updated_at timestamptz not null default now()
);

alter table opposition_head_to_head enable row level security;

drop policy if exists "opposition_h2h_select_authenticated" on opposition_head_to_head;
drop policy if exists "opposition_h2h_insert_authenticated" on opposition_head_to_head;
drop policy if exists "opposition_h2h_update_authenticated" on opposition_head_to_head;
drop policy if exists "opposition_h2h_delete_authenticated" on opposition_head_to_head;

create policy "opposition_h2h_select_authenticated" on opposition_head_to_head for select using (auth.role() = 'authenticated');
create policy "opposition_h2h_insert_authenticated" on opposition_head_to_head for insert with check (auth.role() = 'authenticated');
create policy "opposition_h2h_update_authenticated" on opposition_head_to_head for update using (auth.role() = 'authenticated');
create policy "opposition_h2h_delete_authenticated" on opposition_head_to_head for delete using (auth.role() = 'authenticated');
