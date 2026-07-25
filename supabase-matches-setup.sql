-- Run this once in Supabase: left sidebar -> SQL Editor -> New query -> paste this in -> Run.
-- Creates the matches table (fixtures + results) and locks it down to signed-in ClubOS staff.

create extension if not exists pgcrypto;

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  source_uid text unique,
  kickoff timestamptz not null,
  opponent text not null,
  is_home boolean not null default true,
  competition text not null default '',
  venue text,
  status text not null default 'scheduled' check (status in ('scheduled','postponed','completed','cancelled')),
  home_score int,
  away_score int,
  notes text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table matches enable row level security;

drop policy if exists "matches_select_authenticated" on matches;
drop policy if exists "matches_insert_authenticated" on matches;
drop policy if exists "matches_update_authenticated" on matches;
drop policy if exists "matches_delete_authenticated" on matches;

create policy "matches_select_authenticated" on matches
  for select using (auth.role() = 'authenticated');

create policy "matches_insert_authenticated" on matches
  for insert with check (auth.role() = 'authenticated');

create policy "matches_update_authenticated" on matches
  for update using (auth.role() = 'authenticated');

create policy "matches_delete_authenticated" on matches
  for delete using (auth.role() = 'authenticated');

-- Seed the 2026/27 first-team fixture list (from AFC Whyteleafe's official fixtures feed).
-- Safe to re-run: matching source_uid rows are updated in place, not duplicated.

insert into matches (source_uid, kickoff, opponent, is_home, competition, venue, source_url)
values
  ('612@afcwhyteleafe.com', '2026-07-25T14:00:00Z', 'Cray Valley PM', false, 'Friendly', 'The Artic Stadium', 'https://afcwhyteleafe.com/matches/2026-27/612/cray-valley-pm-vs-afc-whyteleafe/'),
  ('613@afcwhyteleafe.com', '2026-07-28T18:45:00Z', 'Sittingbourne', true, 'Friendly', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/613/afc-whyteleafe-vs-sittingbourne/'),
  ('633@afcwhyteleafe.com', '2026-08-01T14:00:00Z', 'Whitstable Town', true, 'Friendly', 'Church Road', 'https://afcwhyteleafe.com/matches/2026-27/633/afc-whyteleafe-vs-whitstable-town/'),
  ('657@afcwhyteleafe.com', '2026-08-08T14:00:00Z', 'Carshalton Ath', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/657/afc-whyteleafe-vs-carshalton-ath/'),
  ('658@afcwhyteleafe.com', '2026-08-11T18:45:00Z', 'Burgess Hill Town', false, 'Isthmian League Premier Division', 'Medical Travel Compared Stadium', 'https://afcwhyteleafe.com/matches/2026-27/658/burgess-hill-town-vs-afc-whyteleafe/'),
  ('659@afcwhyteleafe.com', '2026-08-15T14:00:00Z', 'Wingate & Finchley', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/659/afc-whyteleafe-vs-wingate-finchley/'),
  ('660@afcwhyteleafe.com', '2026-08-22T14:00:00Z', 'Lewes', false, 'Isthmian League Premier Division', 'The Dripping Pan', 'https://afcwhyteleafe.com/matches/2026-27/660/lewes-vs-afc-whyteleafe/'),
  ('661@afcwhyteleafe.com', '2026-08-29T14:00:00Z', 'Cheshunt', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/661/afc-whyteleafe-vs-cheshunt/'),
  ('662@afcwhyteleafe.com', '2026-08-31T14:00:00Z', 'Ramsgate', false, 'Isthmian League Premier Division', 'Southwood Stadium', 'https://afcwhyteleafe.com/matches/2026-27/662/ramsgate-vs-afc-whyteleafe/'),
  ('663@afcwhyteleafe.com', '2026-09-12T14:00:00Z', 'Stanway Rovers', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/663/afc-whyteleafe-vs-stanway-rovers/'),
  ('664@afcwhyteleafe.com', '2026-09-15T18:45:00Z', 'Leatherhead', false, 'Isthmian League Premier Division', 'Fetcham Grove', 'https://afcwhyteleafe.com/matches/2026-27/664/leatherhead-vs-afc-whyteleafe/'),
  ('665@afcwhyteleafe.com', '2026-09-19T14:00:00Z', 'Brentwood Town', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/665/afc-whyteleafe-vs-brentwood-town/'),
  ('666@afcwhyteleafe.com', '2026-10-03T14:00:00Z', 'Welling United', false, 'Isthmian League Premier Division', 'Park View Road', 'https://afcwhyteleafe.com/matches/2026-27/666/welling-united-vs-afc-whyteleafe/'),
  ('667@afcwhyteleafe.com', '2026-10-07T18:45:00Z', 'Whitehawk', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/667/afc-whyteleafe-vs-whitehawk/'),
  ('668@afcwhyteleafe.com', '2026-10-10T14:00:00Z', 'Maldon & Tiptree', false, 'Isthmian League Premier Division', 'The Drewitt-Barlow Stadium', 'https://afcwhyteleafe.com/matches/2026-27/668/maldon-tiptree-vs-afc-whyteleafe/'),
  ('669@afcwhyteleafe.com', '2026-10-17T14:00:00Z', 'Dartford', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/669/afc-whyteleafe-vs-dartford/'),
  ('670@afcwhyteleafe.com', '2026-10-21T18:45:00Z', 'Burgess Hill Town', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/670/afc-whyteleafe-vs-burgess-hill-town/'),
  ('671@afcwhyteleafe.com', '2026-10-24T14:00:00Z', 'Carshalton Ath', false, 'Isthmian League Premier Division', 'War Memorial Stadium', 'https://afcwhyteleafe.com/matches/2026-27/671/carshalton-ath-vs-afc-whyteleafe/'),
  ('672@afcwhyteleafe.com', '2026-10-31T15:00:00Z', 'Dulwich Hamlet', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/672/afc-whyteleafe-vs-dulwich-hamlet/'),
  ('673@afcwhyteleafe.com', '2026-11-07T15:00:00Z', 'Enfield Town', false, 'Isthmian League Premier Division', 'Dave Bryant Stadium', 'https://afcwhyteleafe.com/matches/2026-27/673/enfield-town-vs-afc-whyteleafe/'),
  ('674@afcwhyteleafe.com', '2026-11-14T15:00:00Z', 'Chatham Town', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/674/afc-whyteleafe-vs-chatham-town/'),
  ('675@afcwhyteleafe.com', '2026-11-21T15:00:00Z', 'St Albans City', false, 'Isthmian League Premier Division', 'Clarence Park', 'https://afcwhyteleafe.com/matches/2026-27/675/st-albans-city-vs-afc-whyteleafe/'),
  ('676@afcwhyteleafe.com', '2026-11-28T15:00:00Z', 'Aveley', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/676/afc-whyteleafe-vs-aveley/'),
  ('677@afcwhyteleafe.com', '2026-12-05T15:00:00Z', 'Eastbourne Boro', false, 'Isthmian League Premier Division', 'Connect Management Stadium', 'https://afcwhyteleafe.com/matches/2026-27/677/eastbourne-boro-vs-afc-whyteleafe/'),
  ('678@afcwhyteleafe.com', '2026-12-12T15:00:00Z', 'Cheshunt', false, 'Isthmian League Premier Division', 'Cheshunt Stadium', 'https://afcwhyteleafe.com/matches/2026-27/678/cheshunt-vs-afc-whyteleafe/'),
  ('679@afcwhyteleafe.com', '2026-12-19T15:00:00Z', 'Three Bridges', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/679/afc-whyteleafe-vs-three-bridges/'),
  ('681@afcwhyteleafe.com', '2027-01-02T15:00:00Z', 'Ramsgate', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/681/afc-whyteleafe-vs-ramsgate/'),
  ('682@afcwhyteleafe.com', '2027-01-09T15:00:00Z', 'Dulwich Hamlet', false, 'Isthmian League Premier Division', 'Champion Hill', 'https://afcwhyteleafe.com/matches/2026-27/682/dulwich-hamlet-vs-afc-whyteleafe/'),
  ('683@afcwhyteleafe.com', '2027-01-16T15:00:00Z', 'Enfield Town', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/683/afc-whyteleafe-vs-enfield-town/'),
  ('684@afcwhyteleafe.com', '2027-01-23T15:00:00Z', 'Chatham Town', false, 'Isthmian League Premier Division', 'The Bauvill Stadium', 'https://afcwhyteleafe.com/matches/2026-27/684/chatham-town-vs-afc-whyteleafe/'),
  ('685@afcwhyteleafe.com', '2027-01-30T15:00:00Z', 'St Albans City', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/685/afc-whyteleafe-vs-st-albans-city/'),
  ('686@afcwhyteleafe.com', '2027-02-06T15:00:00Z', 'Leatherhead', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/686/afc-whyteleafe-vs-leatherhead/'),
  ('687@afcwhyteleafe.com', '2027-02-09T19:45:00Z', 'Whitehawk', false, 'Isthmian League Premier Division', 'TerraPura Ground', 'https://afcwhyteleafe.com/matches/2026-27/687/whitehawk-vs-afc-whyteleafe/'),
  ('688@afcwhyteleafe.com', '2027-02-13T15:00:00Z', 'Brentwood Town', false, 'Isthmian League Premier Division', 'Brentwood Centre Arena', 'https://afcwhyteleafe.com/matches/2026-27/688/brentwood-town-vs-afc-whyteleafe/'),
  ('689@afcwhyteleafe.com', '2027-02-20T15:00:00Z', 'Welling United', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/689/afc-whyteleafe-vs-welling-united/'),
  ('690@afcwhyteleafe.com', '2027-02-27T15:00:00Z', 'Aveley', false, 'Isthmian League Premier Division', 'Parkside', 'https://afcwhyteleafe.com/matches/2026-27/690/aveley-vs-afc-whyteleafe/'),
  ('691@afcwhyteleafe.com', '2027-03-06T15:00:00Z', 'Eastbourne Boro', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/691/afc-whyteleafe-vs-eastbourne-boro/'),
  ('692@afcwhyteleafe.com', '2027-03-13T15:00:00Z', 'Stanway Rovers', false, 'Isthmian League Premier Division', 'The FND & KMCO Community Stadium', 'https://afcwhyteleafe.com/matches/2026-27/692/stanway-rovers-vs-afc-whyteleafe/'),
  ('693@afcwhyteleafe.com', '2027-03-20T15:00:00Z', 'Lewes', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/693/afc-whyteleafe-vs-lewes/'),
  ('694@afcwhyteleafe.com', '2027-03-27T15:00:00Z', 'Three Bridges', false, 'Isthmian League Premier Division', 'Jubilee Field', 'https://afcwhyteleafe.com/matches/2026-27/694/three-bridges-vs-afc-whyteleafe/'),
  ('680@afcwhyteleafe.com', '2027-03-29T14:00:00Z', 'Cray Wanderers', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/680/afc-whyteleafe-vs-cray-wanderers/'),
  ('695@afcwhyteleafe.com', '2027-04-03T14:00:00Z', 'Wingate & Finchley', false, 'Isthmian League Premier Division', 'Maurice Rebak Stadium', 'https://afcwhyteleafe.com/matches/2026-27/695/wingate-finchley-vs-afc-whyteleafe/'),
  ('696@afcwhyteleafe.com', '2027-04-10T14:00:00Z', 'Maldon & Tiptree', true, 'Isthmian League Premier Division', 'Flamingo Park Sports Ground', 'https://afcwhyteleafe.com/matches/2026-27/696/afc-whyteleafe-vs-maldon-tiptree/'),
  ('697@afcwhyteleafe.com', '2027-04-17T14:00:00Z', 'Dartford', false, 'Isthmian League Premier Division', 'Bericote Powerhouse Princes Park', 'https://afcwhyteleafe.com/matches/2026-27/697/dartford-vs-afc-whyteleafe/')
on conflict (source_uid) do update set
  kickoff = excluded.kickoff,
  opponent = excluded.opponent,
  is_home = excluded.is_home,
  competition = excluded.competition,
  venue = excluded.venue,
  source_url = excluded.source_url,
  updated_at = now();
