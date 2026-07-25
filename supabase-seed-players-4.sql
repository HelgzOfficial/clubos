-- Adds the first four midfielders from your fourth squad-page screenshot.
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- Don't re-run the earlier seed files — just this new one.

insert into players (name, initials, squad_number, position, position_group)
values
  ('Helge Orome', 'HO', 2, 'Midfielder', 'MID'),
  ('Matt Warren', 'MW', 4, 'Midfielder', 'MID'),
  ('Jordan Johnson-Palmer', 'JJ', 8, 'Midfielder', 'MID'),
  ('Mason Saunders-Henry', 'MS', 10, 'Midfielder', 'MID');
