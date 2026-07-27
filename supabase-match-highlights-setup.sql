-- Lets a clip be tied to a specific fixture, so Match Centre can show a
-- "Highlights" section scoped to just that match (as well as still showing
-- up in the general Analysis clip library and, if categorised, the Analyst
-- Dashboard's reels). Nullable and additive — existing clips are unaffected
-- and simply have no match association.
alter table clips add column if not exists match_id uuid references matches(id) on delete set null;

create index if not exists clips_match_idx on clips (match_id);
