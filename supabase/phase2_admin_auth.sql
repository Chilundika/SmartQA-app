-- Required for admin login and forced password-change (PRD §20.4).
-- Review, then run in the Supabase SQL Editor after phase2_rls.sql.
--
-- Lets a signed-in admin read and update their own row in public.admins
-- (must_change_password). Does not grant student access, insert, or delete.
-- Also adds admin_must_change_password() for middleware, using SECURITY DEFINER
-- so the flag can be checked even if a policy is missing.

create or replace function public.admin_must_change_password()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select must_change_password from public.admins where id = auth.uid()),
    false
  );
$$;

revoke all on function public.admin_must_change_password() from public;
grant execute on function public.admin_must_change_password() to authenticated;

alter table public.admins enable row level security;

drop policy if exists admins_select_self on public.admins;
create policy admins_select_self
  on public.admins
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists admins_update_self on public.admins;
create policy admins_update_self
  on public.admins
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on table public.admins from anon;
grant select, update on table public.admins to authenticated;
