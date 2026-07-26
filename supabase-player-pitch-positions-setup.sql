-- Lets a player have more than one pitch position marker (e.g. someone who
-- plays both centre-back and right-back). pitch_x / pitch_y stay in place as
-- the primary position (kept in sync with the first entry here) for
-- backward compatibility with anything still reading those two columns.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table players add column if not exists pitch_positions jsonb not null default '[]'::jsonb;

-- Backfill existing players' single position into the new array so nobody
-- loses their marker when this ships.
update players
set pitch_positions = jsonb_build_array(jsonb_build_object('x', pitch_x, 'y', pitch_y))
where pitch_positions = '[]'::jsonb;
