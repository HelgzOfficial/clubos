-- Analyst Dashboard revamp: adds a category tag to clips (for the "Build Up
-- Play / Pressing / Transition / Set Pieces" reels), an optional on-pitch
-- location to each recorded goal (for the Goals Scored/Conceded/Assist
-- maps), and a new match_packs table for the analyst's match pack builder.
-- Safe to run against an existing database — every change is additive
-- (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so it won't touch data
-- already on file in clips or match_goals.

-- Clips: category tag for the four dashboard reels. Free text rather than a
-- hard enum, so an analyst can also just leave it blank for an uncategorised
-- clip in the library.
alter table clips add column if not exists category text;

-- Goals: optional on-pitch location as a percentage of the pitch width/height
-- (0-100, top-left origin), captured from the "click where this happened"
-- pitch diagram when logging a goal in Match Centre. Null for goals logged
-- before this feature existed, or where the analyst skips it.
alter table match_goals add column if not exists x numeric;
alter table match_goals add column if not exists y numeric;

-- Match packs: an analyst-built bundle for a specific fixture, combining
-- opposition info (pulled live from the Opposition module at build time,
-- not duplicated here), selected clips/annotated images, and written notes.
-- `items` holds an ordered list of {type, clipId | imageUrl, caption}
-- entries as jsonb, since a pack's contents are heterogeneous and don't
-- need their own relational table for what's ultimately just a display order.
create table if not exists match_packs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete set null,
  title text not null,
  notes text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_packs_match_idx on match_packs (match_id);

alter table match_packs enable row level security;

drop policy if exists "match_packs_select" on match_packs;
create policy "match_packs_select" on match_packs for select using (auth.role() = 'authenticated');

drop policy if exists "match_packs_insert" on match_packs;
create policy "match_packs_insert" on match_packs for insert with check (auth.role() = 'authenticated');

drop policy if exists "match_packs_update" on match_packs;
create policy "match_packs_update" on match_packs for update using (auth.role() = 'authenticated');

drop policy if exists "match_packs_delete" on match_packs;
create policy "match_packs_delete" on match_packs for delete using (auth.role() = 'authenticated');

-- Annotated images (freeze-frames from the video annotator, or a marked-up
-- uploaded image) — a separate bucket/table from `clips` since these are
-- static PNGs, not video files, and get attached into match packs.
create table if not exists annotated_images (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_path text not null,
  source_clip_id uuid references clips(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table annotated_images enable row level security;

drop policy if exists "annotated_images_select" on annotated_images;
create policy "annotated_images_select" on annotated_images for select using (auth.role() = 'authenticated');

drop policy if exists "annotated_images_insert" on annotated_images;
create policy "annotated_images_insert" on annotated_images for insert with check (auth.role() = 'authenticated');

drop policy if exists "annotated_images_delete" on annotated_images;
create policy "annotated_images_delete" on annotated_images for delete using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('annotated-images', 'annotated-images', false)
on conflict (id) do nothing;

drop policy if exists "annotated_images_storage_select" on storage.objects;
create policy "annotated_images_storage_select" on storage.objects for select
  using (bucket_id = 'annotated-images' and auth.role() = 'authenticated');

drop policy if exists "annotated_images_storage_insert" on storage.objects;
create policy "annotated_images_storage_insert" on storage.objects for insert
  with check (bucket_id = 'annotated-images' and auth.role() = 'authenticated');

drop policy if exists "annotated_images_storage_delete" on storage.objects;
create policy "annotated_images_storage_delete" on storage.objects for delete
  using (bucket_id = 'annotated-images' and auth.role() = 'authenticated');
