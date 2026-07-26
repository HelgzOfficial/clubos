-- Editable calendar entries (training sessions, meetings) with optional
-- weekly recurrence. Matches stay in the existing `matches` table and are
-- merged into the calendar view in code — this table is only for the
-- entries staff add/edit themselves.
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'training', -- 'training' | 'meeting'
  event_date date not null,              -- anchor date (first/only occurrence)
  start_time text,                       -- 'HH:MM', optional
  end_time text,                         -- 'HH:MM', optional
  venue text,
  notes text,
  recurrence text not null default 'none',  -- 'none' | 'weekly'
  recurrence_days int[],                 -- 0=Sun .. 6=Sat, used when recurrence='weekly'
  recurrence_until date,                 -- optional end date for the recurrence
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table calendar_events enable row level security;

drop policy if exists "calendar_events_select" on calendar_events;
create policy "calendar_events_select" on calendar_events for select using (auth.role() = 'authenticated');

drop policy if exists "calendar_events_insert" on calendar_events;
create policy "calendar_events_insert" on calendar_events for insert with check (auth.role() = 'authenticated');

drop policy if exists "calendar_events_update" on calendar_events;
create policy "calendar_events_update" on calendar_events for update using (auth.role() = 'authenticated');

drop policy if exists "calendar_events_delete" on calendar_events;
create policy "calendar_events_delete" on calendar_events for delete using (auth.role() = 'authenticated');

-- Training session plan uploads (PDF/image), attached to a specific calendar
-- date so they show up on that day's training page regardless of whether the
-- date came from a one-off entry or a recurring weekly slot.
create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

alter table training_plans enable row level security;

drop policy if exists "training_plans_select" on training_plans;
create policy "training_plans_select" on training_plans for select using (auth.role() = 'authenticated');

drop policy if exists "training_plans_insert" on training_plans;
create policy "training_plans_insert" on training_plans for insert with check (auth.role() = 'authenticated');

drop policy if exists "training_plans_delete" on training_plans;
create policy "training_plans_delete" on training_plans for delete using (auth.role() = 'authenticated');

-- Seeds the recurring training slot: Tuesdays & Thursdays, 7:30pm-9:30pm,
-- at Whyteleafe Sports Ground. Safe to re-run — only inserts if it's not
-- already there.
insert into calendar_events (title, type, event_date, start_time, end_time, venue, recurrence, recurrence_days)
select 'Training — Full Squad', 'training', '2026-01-01', '19:30', '21:30', 'Whyteleafe Sports Ground, 15 Church Road, CR3 0AR', 'weekly', array[2, 4]
where not exists (
  select 1 from calendar_events where title = 'Training — Full Squad' and recurrence = 'weekly'
);

insert into storage.buckets (id, name, public)
values ('training-plans', 'training-plans', false)
on conflict (id) do nothing;

drop policy if exists "training_plans_storage_select" on storage.objects;
create policy "training_plans_storage_select" on storage.objects for select
  using (bucket_id = 'training-plans' and auth.role() = 'authenticated');

drop policy if exists "training_plans_storage_insert" on storage.objects;
create policy "training_plans_storage_insert" on storage.objects for insert
  with check (bucket_id = 'training-plans' and auth.role() = 'authenticated');

drop policy if exists "training_plans_storage_delete" on storage.objects;
create policy "training_plans_storage_delete" on storage.objects for delete
  using (bucket_id = 'training-plans' and auth.role() = 'authenticated');
