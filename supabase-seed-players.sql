-- Adds the two goalkeepers from your squad-page screenshot as real players.
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- Nationality and date of birth weren't visible in the screenshot, so those are left blank —
-- you can fill them in later from each player's profile page (click Edit).

insert into players (name, initials, squad_number, position, position_group)
values
  ('Slav Huk', 'SH', 1, 'Goalkeeper', 'GK'),
  ('Rocco Yiasemides', 'RY', 21, 'Goalkeeper', 'GK');
