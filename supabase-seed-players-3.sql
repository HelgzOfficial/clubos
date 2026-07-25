-- Adds four more defenders from your third squad-page screenshot.
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- Don't re-run the earlier seed files — just this new one.

insert into players (name, initials, squad_number, position, position_group)
values
  ('Dami Olorunnisomo', 'DO', 17, 'Defender', 'DEF'),
  ('Hani Hechachena', 'HH', 17, 'Defender', 'DEF'),
  ('Geoffrey Okonkwo', 'GO', 20, 'Defender', 'DEF'),
  ('Craig Braham-Barrett', 'CB', 22, 'Defender', 'DEF');
