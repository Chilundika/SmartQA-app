-- Paste this entire file into the Supabase SQL Editor and click Run.
-- Required before Phase 1 lecturer saves will succeed:
--   1. sessions.state (live matching pools are not in the §19 columns)
--   2. permissive RLS policies (no admin login yet; the app uses the anon key)
--
-- §19 tables cannot store live matching pools (pending students/questions,
-- currentMatch, countdown). `sessions.state` holds that blob so Screens 1–3
-- round-trip unchanged. Normalized `matches` rows are still written so they
-- show up in Table Editor.

create table if not exists students (
  student_number text primary key,
  full_name text not null,
  password_hash text not null,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  session_id uuid primary key default gen_random_uuid(),
  module_name text not null,
  date_created timestamptz not null default now(),
  max_score integer,
  created_by uuid references admins(id),
  state jsonb not null default '{}'::jsonb
);

create table if not exists matches (
  match_id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(session_id) not null,
  student_number text references students(student_number) not null,
  question_id text not null,
  question_topic text not null,
  question_text text not null,
  outcome text not null check (outcome in ('completed', 'skipped')),
  score integer,
  matched_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists learning_materials (
  id uuid primary key default gen_random_uuid(),
  module_name text not null,
  topic text,
  material_type text not null check (material_type in ('note', 'link', 'file')),
  title text not null,
  content_or_url text not null,
  created_at timestamptz not null default now()
);

alter table sessions add column if not exists state jsonb not null default '{}'::jsonb;

alter table students enable row level security;
alter table sessions enable row level security;
alter table matches enable row level security;
alter table admins enable row level security;
alter table learning_materials enable row level security;

drop policy if exists phase1_students_all on students;
create policy phase1_students_all on students for all to anon, authenticated using (true) with check (true);

drop policy if exists phase1_sessions_all on sessions;
create policy phase1_sessions_all on sessions for all to anon, authenticated using (true) with check (true);

drop policy if exists phase1_matches_all on matches;
create policy phase1_matches_all on matches for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on table students to anon, authenticated;
grant select, insert, update, delete on table sessions to anon, authenticated;
grant select, insert, update, delete on table matches to anon, authenticated;
