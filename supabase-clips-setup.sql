-- Latest clips shown/uploaded from the Dashboard.
create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

alter table clips enable row level security;

drop policy if exists "clips_select" on clips;
create policy "clips_select" on clips for select using (auth.role() = 'authenticated');

drop policy if exists "clips_insert" on clips;
create policy "clips_insert" on clips for insert with check (auth.role() = 'authenticated');

drop policy if exists "clips_delete" on clips;
create policy "clips_delete" on clips for delete using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do nothing;

drop policy if exists "clips_storage_select" on storage.objects;
create policy "clips_storage_select" on storage.objects for select
  using (bucket_id = 'clips' and auth.role() = 'authenticated');

drop policy if exists "clips_storage_insert" on storage.objects;
create policy "clips_storage_insert" on storage.objects for insert
  with check (bucket_id = 'clips' and auth.role() = 'authenticated');

drop policy if exists "clips_storage_delete" on storage.objects;
create policy "clips_storage_delete" on storage.objects for delete
  using (bucket_id = 'clips' and auth.role() = 'authenticated');
