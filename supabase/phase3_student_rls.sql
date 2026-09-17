-- Phase 3 RLS for students and matches (PRD §19, §23).
-- Review this file, then paste it into the Supabase SQL Editor and run it.
--
-- Replaces the Phase 1 open policy on public.students (phase1_students_all)
-- and tightens the Phase 2 matches SELECT policy (matches_select_authenticated),
-- which currently lets any authenticated user read every match.
--
-- After this runs:
--   students
--     - SELECT: own row (auth_user_id = auth.uid()) OR any row if is_admin()
--     - INSERT / UPDATE / DELETE: admins only
--     - Students cannot change must_change_password (or any other column)
--       with a direct table write. The password itself is changed via
--       Supabase Auth updateUser. Clearing the flag uses
--       clear_student_must_change_password() below (SECURITY DEFINER).
--   matches
--     - SELECT: admins see all rows (same as Phase 2 admin access);
--       students see only rows whose student_number is their own
--       (auth.uid() -> students.auth_user_id -> students.student_number)
--     - INSERT / UPDATE / DELETE: unchanged from Phase 2 (admins only)
--   sessions
--     - Unchanged from Phase 2: any authenticated user may SELECT
--       (module_name, date, max_score). Question/score content lives on
--       matches and is restricted above. Writes remain admin-only.
--   anon: no access to students (already true for sessions/matches)
--
-- Does not change policies on admins, sessions, or learning_materials.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.current_student_number()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select student_number
  from public.students
  where auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_student_number() from public;
grant execute on function public.current_student_number() to authenticated;

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

-- Controlled flag clear after Auth password update. Not a general students UPDATE.
create or replace function public.clear_student_must_change_password()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_number text;
begin
  update public.students
  set must_change_password = false
  where auth_user_id = auth.uid()
  returning student_number into updated_number;

  return updated_number;
end;
$$;

revoke all on function public.clear_student_must_change_password() from public;
grant execute on function public.clear_student_must_change_password() to authenticated;

alter table public.students enable row level security;
alter table public.matches enable row level security;

drop policy if exists phase1_students_all on public.students;
drop policy if exists students_select_self on public.students;
drop policy if exists students_select_admin on public.students;
drop policy if exists students_insert_admin on public.students;
drop policy if exists students_update_admin on public.students;
drop policy if exists students_delete_admin on public.students;

drop policy if exists matches_select_authenticated on public.matches;
drop policy if exists matches_select_admin on public.matches;
drop policy if exists matches_select_own on public.matches;

create policy students_select_self
  on public.students
  for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy students_select_admin
  on public.students
  for select
  to authenticated
  using (public.is_admin());

create policy students_insert_admin
  on public.students
  for insert
  to authenticated
  with check (public.is_admin());

create policy students_update_admin
  on public.students
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy students_delete_admin
  on public.students
  for delete
  to authenticated
  using (public.is_admin());

-- Replaces matches_select_authenticated (using true). Admin SELECT is preserved.
create policy matches_select_admin
  on public.matches
  for select
  to authenticated
  using (public.is_admin());

create policy matches_select_own
  on public.matches
  for select
  to authenticated
  using (student_number = public.current_student_number());

revoke all on table public.students from anon;
grant select, insert, update, delete on table public.students to authenticated;
