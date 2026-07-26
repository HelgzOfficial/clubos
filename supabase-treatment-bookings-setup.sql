-- Treatment slot booking system for the Medical Centre.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists treatment_bookings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  injury_id uuid references injuries(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  treatment_type text not null default 'Physio session',
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no-show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treatment_bookings_start_time_idx on treatment_bookings (start_time);

alter table treatment_bookings enable row level security;

drop policy if exists "treatment_bookings_select_authenticated" on treatment_bookings;
drop policy if exists "treatment_bookings_insert_authenticated" on treatment_bookings;
drop policy if exists "treatment_bookings_update_authenticated" on treatment_bookings;
drop policy if exists "treatment_bookings_delete_authenticated" on treatment_bookings;

create policy "treatment_bookings_select_authenticated" on treatment_bookings for select using (auth.role() = 'authenticated');
create policy "treatment_bookings_insert_authenticated" on treatment_bookings for insert with check (auth.role() = 'authenticated');
create policy "treatment_bookings_update_authenticated" on treatment_bookings for update using (auth.role() = 'authenticated');
create policy "treatment_bookings_delete_authenticated" on treatment_bookings for delete using (auth.role() = 'authenticated');
