-- Password-reset audit log (PRD §21).
-- Review this file, then paste it into the Supabase SQL Editor and run it.
--
-- The reset API uses the service role key (bypasses RLS). Students and
-- anonymous users must not read or write this table from the client.

create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id),
  student_number text not null references public.students(student_number),
  reset_at timestamptz not null default now()
);

alter table public.password_resets enable row level security;

revoke all on table public.password_resets from public;
revoke all on table public.password_resets from anon;
revoke all on table public.password_resets from authenticated;
