-- Adds real injury tracking, linked to real players.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists injuries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  body_part text not null,
  injury text not null,
  severity text not null default 'amber' check (severity in ('amber','red')),
  date_occurred date,
  expected_return date,
  rehab_stage int not null default 0,
  notes text,
  status text not null default 'active' check (status in ('active','recovered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table injuries enable row level security;

drop policy if exists "injuries_select_authenticated" on injuries;
drop policy if exists "injuries_insert_authenticated" on injuries;
drop policy if exists "injuries_update_authenticated" on injuries;
drop policy if exists "injuries_delete_authenticated" on injuries;

create policy "injuries_select_authenticated" on injuries for select using (auth.role() = 'authenticated');
create policy "injuries_insert_authenticated" on injuries for insert with check (auth.role() = 'authenticated');
create policy "injuries_update_authenticated" on injuries for update using (auth.role() = 'authenticated');
create policy "injuries_delete_authenticated" on injuries for delete using (auth.role() = 'authenticated');
