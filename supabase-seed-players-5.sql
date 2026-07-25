-- Adds the last two midfielders from your fifth squad-page screenshot.
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- Don't re-run the earlier seed files — just this new one.

insert into players (name, initials, squad_number, position, position_group)
values
  ('Mannie Mensah', 'MM', 14, 'Midfielder', 'MID'),
  ('Ade Cole', 'AC', 18, 'Midfielder', 'MID');
