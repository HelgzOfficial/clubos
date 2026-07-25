-- Adds the four defenders from your second squad-page screenshot.
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- This is a separate file from the goalkeepers one — run both once each, don't re-run either
-- (there's no automatic duplicate-checking on the players table, so running the same file twice
-- would create the same player twice).

insert into players (name, initials, squad_number, position, position_group)
values
  ('Montel McKenzie', 'MM', 3, 'Defender', 'DEF'),
  ('Aaron Goode', 'AG', 5, 'Defender', 'DEF'),
  ('Corey Holder', 'CH', 6, 'Defender', 'DEF'),
  ('Cairo Duhaney-Burton', 'CD', 12, 'Defender', 'DEF');
