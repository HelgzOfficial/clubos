-- Structured match stats extracted (or manually entered) from an uploaded
-- Hudl/Wyscout report, one row per match. Categories are stored as flexible
-- jsonb since Hudl/Wyscout don't share a fixed export format.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches(id) on delete cascade,
  source_report_id uuid references match_reports(id) on delete set null,
  categories jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table match_stats enable row level security;

drop policy if exists "match_stats_select_authenticated" on match_stats;
drop policy if exists "match_stats_insert_authenticated" on match_stats;
drop policy if exists "match_stats_update_authenticated" on match_stats;
drop policy if exists "match_stats_delete_authenticated" on match_stats;

create policy "match_stats_select_authenticated" on match_stats for select using (auth.role() = 'authenticated');
create policy "match_stats_insert_authenticated" on match_stats for insert with check (auth.role() = 'authenticated');
create policy "match_stats_update_authenticated" on match_stats for update using (auth.role() = 'authenticated');
create policy "match_stats_delete_authenticated" on match_stats for delete using (auth.role() = 'authenticated');
