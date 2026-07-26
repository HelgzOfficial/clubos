-- Mini league table shown on the Dashboard, replacing the old static "Club
-- KPIs" widget. This is entered/edited by staff rather than scraped live —
-- there's no official public API for the Isthmian League — so a coach
-- updates it after each round of fixtures. Seeded below with the real
-- 2026-27 Isthmian Premier Division lineup (all clubs on 0 games, alphabetical,
-- since the season had not yet kicked off as of this table's creation).
create table if not exists league_table (
  id uuid primary key default gen_random_uuid(),
  position int not null,
  team text not null,
  played int not null default 0,
  won int not null default 0,
  drawn int not null default 0,
  lost int not null default 0,
  goals_for int not null default 0,
  goals_against int not null default 0,
  points int not null default 0,
  is_own_club boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table league_table enable row level security;

drop policy if exists "league_table_select" on league_table;
create policy "league_table_select" on league_table for select using (auth.role() = 'authenticated');

drop policy if exists "league_table_insert" on league_table;
create policy "league_table_insert" on league_table for insert with check (auth.role() = 'authenticated');

drop policy if exists "league_table_update" on league_table;
create policy "league_table_update" on league_table for update using (auth.role() = 'authenticated');

drop policy if exists "league_table_delete" on league_table;
create policy "league_table_delete" on league_table for delete using (auth.role() = 'authenticated');

insert into league_table (position, team, played, won, drawn, lost, goals_for, goals_against, points, is_own_club)
select * from (values
  (1, 'AFC Whyteleafe', 0, 0, 0, 0, 0, 0, 0, true),
  (2, 'Aveley', 0, 0, 0, 0, 0, 0, 0, false),
  (3, 'Brentwood Town', 0, 0, 0, 0, 0, 0, 0, false),
  (4, 'Burgess Hill Town', 0, 0, 0, 0, 0, 0, 0, false),
  (5, 'Carshalton Athletic', 0, 0, 0, 0, 0, 0, 0, false),
  (6, 'Chatham Town', 0, 0, 0, 0, 0, 0, 0, false),
  (7, 'Cheshunt', 0, 0, 0, 0, 0, 0, 0, false),
  (8, 'Cray Wanderers', 0, 0, 0, 0, 0, 0, 0, false),
  (9, 'Dartford', 0, 0, 0, 0, 0, 0, 0, false),
  (10, 'Dulwich Hamlet', 0, 0, 0, 0, 0, 0, 0, false),
  (11, 'Eastbourne Borough', 0, 0, 0, 0, 0, 0, 0, false),
  (12, 'Enfield Town', 0, 0, 0, 0, 0, 0, 0, false),
  (13, 'Leatherhead', 0, 0, 0, 0, 0, 0, 0, false),
  (14, 'Lewes', 0, 0, 0, 0, 0, 0, 0, false),
  (15, 'Maldon & Tiptree', 0, 0, 0, 0, 0, 0, 0, false),
  (16, 'Ramsgate', 0, 0, 0, 0, 0, 0, 0, false),
  (17, 'St Albans City', 0, 0, 0, 0, 0, 0, 0, false),
  (18, 'Stanway Rovers', 0, 0, 0, 0, 0, 0, 0, false),
  (19, 'Three Bridges', 0, 0, 0, 0, 0, 0, 0, false),
  (20, 'Welling United', 0, 0, 0, 0, 0, 0, 0, false),
  (21, 'Whitehawk', 0, 0, 0, 0, 0, 0, 0, false),
  (22, 'Wingate & Finchley', 0, 0, 0, 0, 0, 0, 0, false)
) as seed(position, team, played, won, drawn, lost, goals_for, goals_against, points, is_own_club)
where not exists (select 1 from league_table);
