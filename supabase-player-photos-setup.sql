-- Moves player headshots from browser localStorage (which was silently
-- failing once its ~5-10MB quota filled up, so uploads looked like they
-- "did nothing") to real Supabase Storage. Photos are now shared across
-- devices/staff instead of being stuck on one browser.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table players add column if not exists photo_url text;

-- Public bucket: squad headshots aren't sensitive, and this lets them be
-- displayed directly via a stable public URL without generating signed URLs.
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "player_photos_storage_select" on storage.objects;
drop policy if exists "player_photos_storage_insert" on storage.objects;
drop policy if exists "player_photos_storage_update" on storage.objects;
drop policy if exists "player_photos_storage_delete" on storage.objects;

-- Anyone can view (bucket is public and read-only viewing needs no auth),
-- but only signed-in staff can upload/replace/remove a photo.
create policy "player_photos_storage_select" on storage.objects for select
  using (bucket_id = 'player-photos');
create policy "player_photos_storage_insert" on storage.objects for insert
  with check (bucket_id = 'player-photos' and auth.role() = 'authenticated');
create policy "player_photos_storage_update" on storage.objects for update
  using (bucket_id = 'player-photos' and auth.role() = 'authenticated');
create policy "player_photos_storage_delete" on storage.objects for delete
  using (bucket_id = 'player-photos' and auth.role() = 'authenticated');
