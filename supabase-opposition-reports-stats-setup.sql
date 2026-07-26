-- Adds storage for the AI-extracted 0-100 stat bars shown as a graphic on
-- each opposition scouting report (green = strong/dangerous for that stat,
-- red = weak), alongside the existing prose ai_summary.
alter table opposition_reports add column if not exists ai_stats jsonb;
