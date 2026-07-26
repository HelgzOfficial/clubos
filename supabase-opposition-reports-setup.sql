-- Scouting report uploads for opposition teams (a Hudl/Wyscout/PDF export,
-- a CSV/TXT export, or a screenshot), plus an AI-generated summary of the
-- stats inside. Not tied to a single fixture — matched by opponent team name
-- instead, since these are typically multi-match/season squad exports (see
-- the "Stats" page in Wyscout showing a run of recent matches per team).
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists opposition_reports (
  id uuid primary key default gen_random_uuid(),
  opponent_name text not null,
  file_name text not null,
  file_path text not null,        -- path inside the 'opposition-reports' storage bucket
  file_type text not null,        -- e.g. 'pdf', 'csv', 'txt', 'png', 'jpg'
  ai_summary text,
  summary_status text not null default 'pending' check (summary_status in ('pending', 'ready', 'failed')),
  uploaded_at timestamptz not null default now()
);

create index if not exists opposition_reports_opponent_idx on opposition_reports (opponent_name);

alter table opposition_reports enable row level security;

drop policy if exists "opposition_reports_select_authenticated" on opposition_reports;
drop policy if exists "opposition_reports_insert_authenticated" on opposition_reports;
drop policy if exists "opposition_reports_update_authenticated" on opposition_reports;
drop policy if exists "opposition_reports_delete_authenticated" on opposition_reports;

create policy "opposition_reports_select_authenticated" on opposition_reports for select using (auth.role() = 'authenticated');
create policy "opposition_reports_insert_authenticated" on opposition_reports for insert with check (auth.role() = 'authenticated');
create policy "opposition_reports_update_authenticated" on opposition_reports for update using (auth.role() = 'authenticated');
create policy "opposition_reports_delete_authenticated" on opposition_reports for delete using (auth.role() = 'authenticated');

-- Private storage bucket for the uploaded report/screenshot files themselves.
insert into storage.buckets (id, name, public)
values ('opposition-reports', 'opposition-reports', false)
on conflict (id) do nothing;

drop policy if exists "opposition_reports_storage_select" on storage.objects;
drop policy if exists "opposition_reports_storage_insert" on storage.objects;
drop policy if exists "opposition_reports_storage_delete" on storage.objects;

create policy "opposition_reports_storage_select" on storage.objects for select
  using (bucket_id = 'opposition-reports' and auth.role() = 'authenticated');
create policy "opposition_reports_storage_insert" on storage.objects for insert
  with check (bucket_id = 'opposition-reports' and auth.role() = 'authenticated');
create policy "opposition_reports_storage_delete" on storage.objects for delete
  using (bucket_id = 'opposition-reports' and auth.role() = 'authenticated');
