-- Single-row table storing which Dashboard widgets are shown (and in what
-- order) — backs the "add/remove modules" option on the Dashboard.
create table if not exists dashboard_settings (
  id text primary key default 'default',
  widget_order text[] not null default array[
    'next-match', 'weather', 'schedule', 'availability', 'league-position',
    'form-guide', 'uploads', 'injuries', 'staff-tasks', 'clips'
  ],
  hidden_widgets text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

alter table dashboard_settings enable row level security;

drop policy if exists "dashboard_settings_select" on dashboard_settings;
create policy "dashboard_settings_select" on dashboard_settings for select using (auth.role() = 'authenticated');

drop policy if exists "dashboard_settings_insert" on dashboard_settings;
create policy "dashboard_settings_insert" on dashboard_settings for insert with check (auth.role() = 'authenticated');

drop policy if exists "dashboard_settings_update" on dashboard_settings;
create policy "dashboard_settings_update" on dashboard_settings for update using (auth.role() = 'authenticated');

insert into dashboard_settings (id) values ('default') on conflict (id) do nothing;
