-- School setup: the admin confirms the school on first sign-in, then creates the
-- club groups and chooses who runs each one (themselves or an invited teacher).
-- Clubs belong to the school; teachers no longer create them.

-- ---------- What the welcome screen confirms ----------

alter table public.schools add column city text;
alter table public.schools add column term_start date;

alter table public.profiles add column job_title text;
-- Set when an admin finishes the welcome screen. Null means "show it on next sign-in".
alter table public.profiles add column onboarded_at timestamptz;

-- ---------- When each club meets ----------

alter table public.classes add column meets_day text
  check (meets_day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'));
alter table public.classes add column meets_time text
  check (meets_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ---------- Who may create and run clubs ----------

-- classes.teacher_id is now "the club's manager": the person who runs the weekly sessions.
drop policy if exists "classes: teachers create their own" on public.classes;
create policy "classes: admins create for their school" on public.classes
  for insert to authenticated
  with check (
    school_id = public.my_school_id()
    and public.is_school_admin()
    and exists (select 1 from public.profiles p where p.id = teacher_id and p.school_id = public.my_school_id())
  );

-- The manager or an admin edits a club; the manager must stay someone from the school.
drop policy if exists "classes: owner or admin edits" on public.classes;
create policy "classes: manager or admin edits" on public.classes
  for update to authenticated
  using (teacher_id = auth.uid() or (school_id = public.my_school_id() and public.is_school_admin()))
  with check (
    school_id = public.my_school_id()
    and exists (select 1 from public.profiles p where p.id = teacher_id and p.school_id = public.my_school_id())
  );

-- An admin can start a club's session too, for example to cover for its manager.
drop policy if exists "sessions: class teacher starts" on public.sessions;
create policy "sessions: club manager or admin starts" on public.sessions
  for insert to authenticated
  with check (exists (
    select 1 from public.classes c
    where c.id = class_id
      and (c.teacher_id = auth.uid() or (c.school_id = public.my_school_id() and public.is_school_admin()))
  ));
