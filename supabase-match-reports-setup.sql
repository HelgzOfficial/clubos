-- Adds Hudl / Wyscout match report uploads, linked to a fixture.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  file_name text not null,
  file_path text not null,       -- path inside the 'match-reports' storage bucket
  file_type text not null,       -- e.g. 'pdf', 'csv', 'txt'
  source text not null default 'other' check (source in ('hudl','wyscout','other')),
  parse_status text not null default 'unparsed' check (parse_status in ('unparsed','parsed','failed')),
  parsed_summary jsonb,          -- { goals: [...], lineup: [...], substitutions: [...] } best-effort extraction
  uploaded_at timestamptz not null default now()
);

alter table match_reports enable row level security;

drop policy if exists "match_reports_select_authenticated" on match_reports;
drop policy if exists "match_reports_insert_authenticated" on match_reports;
drop policy if exists "match_reports_update_authenticated" on match_reports;
drop policy if exists "match_reports_delete_authenticated" on match_reports;

create policy "match_reports_select_authenticated" on match_reports for select using (auth.role() = 'authenticated');
create policy "match_reports_insert_authenticated" on match_reports for insert with check (auth.role() = 'authenticated');
create policy "match_reports_update_authenticated" on match_reports for update using (auth.role() = 'authenticated');
create policy "match_reports_delete_authenticated" on match_reports for delete using (auth.role() = 'authenticated');

-- Private storage bucket for the uploaded report files themselves.
insert into storage.buckets (id, name, public)
values ('match-reports', 'match-reports', false)
on conflict (id) do nothing;

drop policy if exists "match_reports_storage_select" on storage.objects;
drop policy if exists "match_reports_storage_insert" on storage.objects;
drop policy if exists "match_reports_storage_delete" on storage.objects;

create policy "match_reports_storage_select" on storage.objects for select
  using (bucket_id = 'match-reports' and auth.role() = 'authenticated');
create policy "match_reports_storage_insert" on storage.objects for insert
  with check (bucket_id = 'match-reports' and auth.role() = 'authenticated');
create policy "match_reports_storage_delete" on storage.objects for delete
  using (bucket_id = 'match-reports' and auth.role() = 'authenticated');
