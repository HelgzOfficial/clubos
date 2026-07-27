-- Lets someone without an account ask for access from the login page,
-- instead of only an owner/manager being able to invite people first.
-- The requested password is stored only until an owner/manager approves or
-- rejects the request, at which point it's immediately cleared (set to
-- null) from the row — the approval API route reads it once, server-side,
-- to set it directly on the new Supabase Auth account, and never returns
-- it to a browser. The row itself stays around afterwards (status +
-- timestamps only) as a simple audit trail.
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  password text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists access_requests_status_idx on access_requests (status);

alter table access_requests enable row level security;

-- Open to anyone, including a signed-out visitor — this is the whole point,
-- someone without an account yet needs to be able to submit one.
drop policy if exists "access_requests_insert" on access_requests;
create policy "access_requests_insert" on access_requests for insert with check (true);

-- Only signed-in users can read/update the queue — the Staff module is
-- where an owner/manager reviews and actions these (write access to
-- approve/reject is further checked in the app itself).
drop policy if exists "access_requests_select" on access_requests;
create policy "access_requests_select" on access_requests for select using (auth.role() = 'authenticated');

drop policy if exists "access_requests_update" on access_requests;
create policy "access_requests_update" on access_requests for update using (auth.role() = 'authenticated');
