-- Records which staff member (doctor/physio) booked a treatment slot, so a
-- calendar invite can be sent to them as well as the player.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table treatment_bookings add column if not exists doctor_name text;
alter table treatment_bookings add column if not exists doctor_email text;
