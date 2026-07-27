-- Club branding (name, crest initials, colours) was previously only saved
-- to each browser's localStorage via Settings > Club Branding — meaning it
-- only ever showed correctly on the one device/browser where an owner set
-- it. Everyone else (new sign-ups, other devices, the sign-in screen before
-- anyone is logged in) always saw the original placeholder "Riverside FC"
-- defaults instead, because their browser's localStorage never had it.
--
-- This moves branding into a single shared row in Supabase instead, so
-- every device and every user (including someone who hasn't signed in yet,
-- on the login screen) sees the same, real club branding.
--
-- Safe to run against an existing database — additive only.

create table if not exists club_settings (
  id smallint primary key default 1,
  name text not null default 'Riverside FC',
  crest_initials text not null default 'RFC',
  primary_color text not null default '#D4AF37',
  secondary_color text not null default '#E6C766',
  accent_color text not null default '#D4AF37',
  updated_at timestamptz not null default now(),
  constraint club_settings_singleton check (id = 1)
);

-- Seed the single row if it doesn't exist yet — the app always reads/writes id = 1.
insert into club_settings (id) values (1) on conflict (id) do nothing;

alter table club_settings enable row level security;

-- Readable by EVERYONE, including a signed-out visitor — the login page
-- needs to show the real club name and crest before anyone has signed in.
drop policy if exists "club_settings_select" on club_settings;
create policy "club_settings_select" on club_settings for select using (true);

-- Only signed-in users can change it (matches the rest of the app's
-- pattern; the Settings page itself is already behind the authenticated
-- app shell, so this just backs that up at the database level).
drop policy if exists "club_settings_update" on club_settings;
create policy "club_settings_update" on club_settings for update using (auth.role() = 'authenticated');

drop policy if exists "club_settings_insert" on club_settings;
create policy "club_settings_insert" on club_settings for insert with check (auth.role() = 'authenticated');
