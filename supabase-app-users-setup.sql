-- Role-based access. One row per person who can sign in — staff or player.
-- A person is invited (created here with invite_status='pending') before
-- they ever sign up; once they complete Supabase Auth sign-in with a
-- matching email, the app treats them as that role everywhere.
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null check (role in (
    'owner', 'manager', 'head_coach', 'goalkeeper_coach', 'analyst', 'doctor_physio', 'player'
  )),
  player_id uuid references players(id) on delete set null, -- only set for role='player'
  invite_status text not null default 'pending' check (invite_status in ('pending', 'accepted')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_users_email_idx on app_users (lower(email));

alter table app_users enable row level security;

-- Every authenticated user can read the app_users table — needed so the app
-- can look up *its own* role right after login. Fine-grained write control
-- (below) is what actually protects the data.
drop policy if exists "app_users_select" on app_users;
create policy "app_users_select" on app_users for select using (auth.role() = 'authenticated');

-- Only an owner/manager (checked via their own app_users row) can invite,
-- edit, or remove people.
drop policy if exists "app_users_insert" on app_users;
create policy "app_users_insert" on app_users for insert
  with check (exists (
    select 1 from app_users me where lower(me.email) = lower(auth.jwt() ->> 'email') and me.role in ('owner', 'manager')
  ));

drop policy if exists "app_users_update" on app_users;
create policy "app_users_update" on app_users for update
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
    or exists (select 1 from app_users me where lower(me.email) = lower(auth.jwt() ->> 'email') and me.role in ('owner', 'manager'))
  );

drop policy if exists "app_users_delete" on app_users;
create policy "app_users_delete" on app_users for delete
  using (exists (
    select 1 from app_users me where lower(me.email) = lower(auth.jwt() ->> 'email') and me.role in ('owner', 'manager')
  ));

-- Seed the account owner so the first login always has somewhere to land.
-- Update the email below if Helge's login uses a different address.
insert into app_users (email, name, role, invite_status, accepted_at)
values ('helge.orome@wwfc.com', 'Helge Orome', 'owner', 'accepted', now())
on conflict (email) do nothing;
