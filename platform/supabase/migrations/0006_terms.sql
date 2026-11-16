-- The AI Creators Club: a club group follows a term, and a term is one mission a week.
-- Children are on a club list the teacher types once, so their work follows them
-- from week to week. Old standalone missions stay (old galleries point at them) but
-- are unpublished.

-- ---------- Terms ----------

create table public.terms (
  id text primary key,
  number integer not null unique,
  title text not null,
  json jsonb not null,
  version integer not null default 1,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

-- The seed script fills in the full term; this row lets existing classes point at it.
insert into public.terms (id, number, title, json)
values ('create-your-comic', 1, 'Create Your Comic', '{}'::jsonb)
on conflict (id) do nothing;

-- ---------- Missions belong to a term and a week ----------

alter table public.missions add column term_id text references public.terms (id);
alter table public.missions add column week integer check (week between 1 and 20);
alter table public.missions alter column number drop not null;
alter table public.missions drop constraint if exists missions_number_key;
alter table public.missions alter column type drop not null;
update public.missions set published = false where term_id is null;
create unique index missions_term_week_idx on public.missions (term_id, week) where term_id is not null;

-- ---------- Classes become club groups ----------

alter table public.classes add column term_id text references public.terms (id);
alter table public.classes add column track text check (track in ('8-9', '10-11'));
alter table public.classes alter column year_group drop not null;
update public.classes
set term_id = 'create-your-comic',
    track = case when year_group >= 5 then '10-11' else '8-9' end
where term_id is null;
alter table public.classes alter column term_id set not null;
alter table public.classes alter column track set default '8-9';
alter table public.classes alter column track set not null;

-- ---------- The club list ----------

create table public.kids (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  -- Removed from the list; their work stays in the galleries.
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index kids_class_name_idx on public.kids (class_id, lower(display_name)) where archived_at is null;
create index kids_class_idx on public.kids (class_id);

-- A participant is one child in one week's session; kid_id ties the weeks together.
alter table public.participants add column kid_id uuid references public.kids (id) on delete set null;
create unique index participants_session_kid_idx on public.participants (session_id, kid_id) where kid_id is not null;
create index participants_kid_idx on public.participants (kid_id);

-- Sessions remember which week of which term they ran.
alter table public.sessions add column term_id text references public.terms (id);
alter table public.sessions add column week integer;
create index sessions_class_week_idx on public.sessions (class_id, week);

-- ---------- Row-level security ----------

alter table public.terms enable row level security;
alter table public.kids enable row level security;

create policy "terms: published are readable" on public.terms
  for select to authenticated
  using (published);

create policy "kids: school members read" on public.kids
  for select to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.school_id = public.my_school_id()));

create policy "kids: club teacher or admin adds" on public.kids
  for insert to authenticated
  with check (exists (
    select 1 from public.classes c
    where c.id = class_id
      and (c.teacher_id = auth.uid() or (c.school_id = public.my_school_id() and public.is_school_admin()))
  ));

create policy "kids: club teacher or admin edits" on public.kids
  for update to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = class_id
      and (c.teacher_id = auth.uid() or (c.school_id = public.my_school_id() and public.is_school_admin()))
  ))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.school_id = public.my_school_id()));
