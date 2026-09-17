-- Adds the Auth link column required for bulk student account creation (PRD §19 / §20.2).
-- Review, then run in the Supabase SQL Editor if `students.auth_user_id` does not already exist.

alter table public.students
  add column if not exists auth_user_id uuid references auth.users(id);
