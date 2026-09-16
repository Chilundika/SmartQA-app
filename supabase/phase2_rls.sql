-- Phase 2 RLS for sessions and matches.
-- Review this file, then paste it into the Supabase SQL Editor and run it.
--
-- Replaces the Phase 1 temporary open policies (temp_allow_all_* / phase1_*_all)
-- with real rules from PRD §19 and §23:
--   - SELECT: any authenticated user (student-specific match reads come in Phase 3)
--   - INSERT / UPDATE / DELETE: only auth users who have a row in public.admins
--   - anon: no access
--
-- Does not change policies on students or admins.
--
-- is_admin() is SECURITY DEFINER so the admin check can read public.admins
-- even though this migration does not add an admins SELECT policy (Phase 3).
-- It assumes §19: admins.id = auth.users.id = auth.uid().

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

alter table public.sessions enable row level security;
alter table public.matches enable row level security;

drop policy if exists temp_allow_all_sessions on public.sessions;
drop policy if exists phase1_sessions_all on public.sessions;
drop policy if exists sessions_select_authenticated on public.sessions;
drop policy if exists sessions_insert_admin on public.sessions;
drop policy if exists sessions_update_admin on public.sessions;
drop policy if exists sessions_delete_admin on public.sessions;

drop policy if exists temp_allow_all_matches on public.matches;
drop policy if exists phase1_matches_all on public.matches;
drop policy if exists matches_select_authenticated on public.matches;
drop policy if exists matches_insert_admin on public.matches;
drop policy if exists matches_update_admin on public.matches;
drop policy if exists matches_delete_admin on public.matches;

create policy sessions_select_authenticated
  on public.sessions
  for select
  to authenticated
  using (true);

create policy sessions_insert_admin
  on public.sessions
  for insert
  to authenticated
  with check (public.is_admin());

create policy sessions_update_admin
  on public.sessions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy sessions_delete_admin
  on public.sessions
  for delete
  to authenticated
  using (public.is_admin());

create policy matches_select_authenticated
  on public.matches
  for select
  to authenticated
  using (true);

create policy matches_insert_admin
  on public.matches
  for insert
  to authenticated
  with check (public.is_admin());

create policy matches_update_admin
  on public.matches
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy matches_delete_admin
  on public.matches
  for delete
  to authenticated
  using (public.is_admin());

revoke all on table public.sessions from anon;
revoke all on table public.matches from anon;

grant select, insert, update, delete on table public.sessions to authenticated;
grant select, insert, update, delete on table public.matches to authenticated;
