-- Adds contact details to players, used to auto-send calendar invites for
-- booked treatment slots to the player's own email address.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table players add column if not exists email text;
alter table players add column if not exists phone text;
