-- General club document library (Match Packs / Match Reports / Policies).
-- Replaces the old hard-coded sample documents on the Documents page with
-- real, addable/removable files in Supabase Storage.
create table if not exists club_documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('Match Packs', 'Match Reports', 'Policies')),
  linked_to text,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  size_kb int not null default 0,
  uploaded_at timestamptz not null default now()
);

alter table club_documents enable row level security;

drop policy if exists "club_documents_select" on club_documents;
create policy "club_documents_select" on club_documents for select using (auth.role() = 'authenticated');

drop policy if exists "club_documents_insert" on club_documents;
create policy "club_documents_insert" on club_documents for insert with check (auth.role() = 'authenticated');

drop policy if exists "club_documents_delete" on club_documents;
create policy "club_documents_delete" on club_documents for delete using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('club-documents', 'club-documents', false)
on conflict (id) do nothing;

drop policy if exists "club_documents_storage_select" on storage.objects;
create policy "club_documents_storage_select" on storage.objects for select
  using (bucket_id = 'club-documents' and auth.role() = 'authenticated');

drop policy if exists "club_documents_storage_insert" on storage.objects;
create policy "club_documents_storage_insert" on storage.objects for insert
  with check (bucket_id = 'club-documents' and auth.role() = 'authenticated');

drop policy if exists "club_documents_storage_delete" on storage.objects;
create policy "club_documents_storage_delete" on storage.objects for delete
  using (bucket_id = 'club-documents' and auth.role() = 'authenticated');
