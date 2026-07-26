-- Match pack / document uploads for upcoming fixtures, plus a per-player
-- "has this player opened it" record. Player identity here piggybacks on the
-- existing players.email column (already used for calendar invites) — a
-- player logs into the portal with that same email via a magic link, no
-- separate password or invite step needed.
create table if not exists match_documents (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

alter table match_documents enable row level security;

drop policy if exists "match_documents_select" on match_documents;
create policy "match_documents_select" on match_documents for select using (auth.role() = 'authenticated');

drop policy if exists "match_documents_insert" on match_documents;
create policy "match_documents_insert" on match_documents for insert with check (auth.role() = 'authenticated');

drop policy if exists "match_documents_delete" on match_documents;
create policy "match_documents_delete" on match_documents for delete using (auth.role() = 'authenticated');

create table if not exists match_document_views (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references match_documents(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (document_id, player_id)
);

alter table match_document_views enable row level security;

drop policy if exists "match_document_views_select" on match_document_views;
create policy "match_document_views_select" on match_document_views for select using (auth.role() = 'authenticated');

drop policy if exists "match_document_views_insert" on match_document_views;
create policy "match_document_views_insert" on match_document_views for insert with check (auth.role() = 'authenticated');

drop policy if exists "match_document_views_update" on match_document_views;
create policy "match_document_views_update" on match_document_views for update using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('match-documents', 'match-documents', false)
on conflict (id) do nothing;

drop policy if exists "match_documents_storage_select" on storage.objects;
create policy "match_documents_storage_select" on storage.objects for select
  using (bucket_id = 'match-documents' and auth.role() = 'authenticated');

drop policy if exists "match_documents_storage_insert" on storage.objects;
create policy "match_documents_storage_insert" on storage.objects for insert
  with check (bucket_id = 'match-documents' and auth.role() = 'authenticated');

drop policy if exists "match_documents_storage_delete" on storage.objects;
create policy "match_documents_storage_delete" on storage.objects for delete
  using (bucket_id = 'match-documents' and auth.role() = 'authenticated');
