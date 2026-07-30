-- One message thread per player with the medical team (doctor/physio),
-- used from both the player's Treatment page and the Medical module.
-- Kept deliberately simple — a single flat thread per player rather than a
-- general-purpose inbox, since that's the actual use case (arranging/
-- discussing a player's treatment).
create table if not exists medical_messages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  sender_role text not null check (sender_role in ('doctor', 'player')),
  sender_name text not null,
  sender_email text,
  body text not null,
  created_at timestamptz not null default now(),
  read_by_player boolean not null default false,
  read_by_doctor boolean not null default false
);

create index if not exists medical_messages_player_idx on medical_messages (player_id, created_at);

alter table medical_messages enable row level security;

-- Matches the same "authenticated" convention used by every other table in
-- this app — anyone signed into ClubOS can read/send, and the app itself
-- scopes what's shown (a player only ever queries their own player_id;
-- medical staff can see every thread from the Medical module).
drop policy if exists "medical_messages_select" on medical_messages;
create policy "medical_messages_select" on medical_messages for select using (auth.role() = 'authenticated');

drop policy if exists "medical_messages_insert" on medical_messages;
create policy "medical_messages_insert" on medical_messages for insert with check (auth.role() = 'authenticated');

drop policy if exists "medical_messages_update" on medical_messages;
create policy "medical_messages_update" on medical_messages for update using (auth.role() = 'authenticated');

-- Lets the client subscribe to new messages in real time (used so a chat
-- open on both ends updates live without polling). Wrapped so it's a no-op
-- (rather than an error that rolls back the whole script) if it's already
-- been added, or if this project doesn't use the default publication name.
do $$
begin
  begin
    alter publication supabase_realtime add table medical_messages;
  exception when duplicate_object then
    null;
  end;
end $$;
