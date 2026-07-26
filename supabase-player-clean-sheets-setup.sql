-- Adds a clean_sheets counter to players, used for goalkeepers and defenders.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table players add column if not exists clean_sheets int not null default 0;
