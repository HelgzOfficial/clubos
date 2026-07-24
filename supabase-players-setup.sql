-- Run this once in Supabase: left sidebar -> SQL Editor -> New query -> paste this in -> Run.
-- It creates the players table and locks it down so only signed-in ClubOS staff can see or edit it.

create extension if not exists pgcrypto;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  squad_number int not null,
  position text not null,
  position_group text not null check (position_group in ('GK','DEF','MID','FWD')),
  nationality text not null default '',
  dob date,
  pitch_x double precision not null default 50,
  pitch_y double precision not null default 50,
  availability text not null default 'green' check (availability in ('green','amber','red')),
  availability_note text not null default 'Available',
  appearances int not null default 0,
  minutes int not null default 0,
  goals int not null default 0,
  assists int not null default 0,
  gps jsonb not null default '{"distanceKm":0,"topSpeedKph":0,"sprints":0}'::jsonb,
  injury_history jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  clips jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table players enable row level security;

drop policy if exists "players_select_authenticated" on players;
drop policy if exists "players_insert_authenticated" on players;
drop policy if exists "players_update_authenticated" on players;
drop policy if exists "players_delete_authenticated" on players;

create policy "players_select_authenticated" on players
  for select using (auth.role() = 'authenticated');

create policy "players_insert_authenticated" on players
  for insert with check (auth.role() = 'authenticated');

create policy "players_update_authenticated" on players
  for update using (auth.role() = 'authenticated');

create policy "players_delete_authenticated" on players
  for delete using (auth.role() = 'authenticated');
