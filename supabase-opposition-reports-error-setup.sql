-- Stores the actual reason an opposition report's AI summary failed, so the
-- app can show it instead of a generic "Couldn't summarise" with no detail.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table opposition_reports add column if not exists summary_error text;
