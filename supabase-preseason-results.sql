-- Adds the pre-season friendly results from your screenshot as completed matches.
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: each row has its own unique source_uid, so re-running just updates them, not duplicates them.

insert into matches (source_uid, kickoff, opponent, is_home, competition, venue, status, home_score, away_score)
values
  ('manual-2026-07-07-beckenham', '2026-07-07T18:45:00Z', 'Beckenham', true, 'Friendly', 'Flamingo Park Sports Ground', 'completed', 8, 2),
  ('manual-2026-07-11-south-park-reigate', '2026-07-11T15:00:00Z', 'South Park Reigate', false, 'Friendly', 'King George''s Field', 'completed', 2, 3),
  ('manual-2026-07-14-punjab-united', '2026-07-14T18:45:00Z', 'Punjab United', false, 'Friendly', 'The Elite Venue', 'completed', 2, 0),
  ('manual-2026-07-18-corinthian-casuals', '2026-07-18T15:00:00Z', 'Corinthian Casuals', false, 'Friendly', 'King George''s Field', 'completed', 1, 2),
  ('manual-2026-07-21-se-dons', '2026-07-21T18:45:00Z', 'SE Dons', false, 'Friendly', 'The Bauvill Stadium', 'completed', 0, 4)
on conflict (source_uid) do update set
  kickoff = excluded.kickoff,
  opponent = excluded.opponent,
  is_home = excluded.is_home,
  competition = excluded.competition,
  venue = excluded.venue,
  status = excluded.status,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  updated_at = now();
