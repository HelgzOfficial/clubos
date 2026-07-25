-- Adds the five forwards — the last section of the squad.
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- Don't re-run the earlier seed files — just this new one.

insert into players (name, initials, squad_number, position, position_group)
values
  ('Daniel Bennett', 'DB', 7, 'Forward', 'FWD'),
  ('Francis Mampolo', 'FM', 10, 'Forward', 'FWD'),
  ('Palace Francis', 'PF', 11, 'Forward', 'FWD'),
  ('Eniola Hassan', 'EH', 16, 'Forward', 'FWD'),
  ('Ryan Gondoh', 'RG', 23, 'Forward', 'FWD');
