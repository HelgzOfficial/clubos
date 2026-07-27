-- Approved player absences (holiday / compassionate leave / international
-- duty / other pre-agreed time away). Separate from injury-based
-- availability (which lives on players.availability, managed in Medical) —
-- an absence here is a scheduling matter, not a medical one, but a player
-- currently on an approved absence should still show as unavailable on the
-- Dashboard's Player Availability widget while it's active.
create table if not exists player_absences (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  reason text not null default 'Holiday' check (reason in ('Holiday', 'International Duty', 'Compassionate Leave', 'Other')),
  notes text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists player_absences_player_idx on player_absences (player_id);
create index if not exists player_absences_dates_idx on player_absences (start_date, end_date);

alter table player_absences enable row level security;

drop policy if exists "player_absences_select" on player_absences;
create policy "player_absences_select" on player_absences for select using (auth.role() = 'authenticated');

drop policy if exists "player_absences_insert" on player_absences;
create policy "player_absences_insert" on player_absences for insert with check (auth.role() = 'authenticated');

drop policy if exists "player_absences_update" on player_absences;
create policy "player_absences_update" on player_absences for update using (auth.role() = 'authenticated');

drop policy if exists "player_absences_delete" on player_absences;
create policy "player_absences_delete" on player_absences for delete using (auth.role() = 'authenticated');
