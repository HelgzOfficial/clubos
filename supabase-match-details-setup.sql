-- Adds match detail tables: starting XI / subs bench, goals, and substitutions.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists match_lineup (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  is_starting boolean not null default true,
  shirt_number int,
  player_name text not null,
  position text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists match_goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  minute int,
  team text not null default 'us' check (team in ('us','opponent')),
  scorer text not null,
  assist text,
  created_at timestamptz not null default now()
);

create table if not exists match_substitutions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  minute int,
  player_off text not null,
  player_on text not null,
  created_at timestamptz not null default now()
);

alter table match_lineup enable row level security;
alter table match_goals enable row level security;
alter table match_substitutions enable row level security;

drop policy if exists "match_lineup_select_authenticated" on match_lineup;
drop policy if exists "match_lineup_insert_authenticated" on match_lineup;
drop policy if exists "match_lineup_update_authenticated" on match_lineup;
drop policy if exists "match_lineup_delete_authenticated" on match_lineup;
create policy "match_lineup_select_authenticated" on match_lineup for select using (auth.role() = 'authenticated');
create policy "match_lineup_insert_authenticated" on match_lineup for insert with check (auth.role() = 'authenticated');
create policy "match_lineup_update_authenticated" on match_lineup for update using (auth.role() = 'authenticated');
create policy "match_lineup_delete_authenticated" on match_lineup for delete using (auth.role() = 'authenticated');

drop policy if exists "match_goals_select_authenticated" on match_goals;
drop policy if exists "match_goals_insert_authenticated" on match_goals;
drop policy if exists "match_goals_update_authenticated" on match_goals;
drop policy if exists "match_goals_delete_authenticated" on match_goals;
create policy "match_goals_select_authenticated" on match_goals for select using (auth.role() = 'authenticated');
create policy "match_goals_insert_authenticated" on match_goals for insert with check (auth.role() = 'authenticated');
create policy "match_goals_update_authenticated" on match_goals for update using (auth.role() = 'authenticated');
create policy "match_goals_delete_authenticated" on match_goals for delete using (auth.role() = 'authenticated');

drop policy if exists "match_subs_select_authenticated" on match_substitutions;
drop policy if exists "match_subs_insert_authenticated" on match_substitutions;
drop policy if exists "match_subs_update_authenticated" on match_substitutions;
drop policy if exists "match_subs_delete_authenticated" on match_substitutions;
create policy "match_subs_select_authenticated" on match_substitutions for select using (auth.role() = 'authenticated');
create policy "match_subs_insert_authenticated" on match_substitutions for insert with check (auth.role() = 'authenticated');
create policy "match_subs_update_authenticated" on match_substitutions for update using (auth.role() = 'authenticated');
create policy "match_subs_delete_authenticated" on match_substitutions for delete using (auth.role() = 'authenticated');
