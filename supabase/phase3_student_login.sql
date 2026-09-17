-- Optional helper for student login (PRD §20.3).
-- Review, then run in the Supabase SQL Editor.
-- Middleware falls back to a students table query if this function is missing.

create or replace function public.student_must_change_password()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select must_change_password from public.students where auth_user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.student_must_change_password() from public;
grant execute on function public.student_must_change_password() to authenticated;
