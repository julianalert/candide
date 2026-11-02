-- Candide MVP: schema, row-level security, auth profile trigger.
-- Teachers read through RLS with their own session; kids never hold a Supabase
-- session and reach the database only through server routes using the service key.

create extension if not exists pgcrypto;

-- ---------- Enums ----------

create type public.profile_role as enum ('admin', 'teacher');
create type public.message_role as enum ('user', 'assistant', 'system');
create type public.message_kind as enum ('text', 'image');
create type public.mission_type as enum ('creative', 'literacy', 'curriculum');

-- ---------- Tables ----------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  daily_image_cap integer not null default 2000,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete set null,
  role public.profile_role not null default 'teacher',
  display_name text,
  email text,
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  year_group integer not null check (year_group between 1 and 13),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.missions (
  id text primary key,
  number integer not null unique,
  type public.mission_type not null,
  json jsonb not null,
  version integer not null default 1,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  mission_id text not null references public.missions (id),
  mission_version integer not null,
  -- Snapshot of the mission JSON at launch so editing a mission never changes a past gallery.
  mission_snapshot jsonb not null,
  teacher_inputs jsonb not null default '{}'::jsonb,
  public_id text not null unique,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  display_name text not null,
  kid_rules text,
  joined_at timestamptz not null default now(),
  message_count integer not null default 0,
  image_count integer not null default 0,
  unique (session_id, display_name)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  -- For an assistant image: the kid message it answers. Used to cap retries per prompt.
  parent_id uuid references public.messages (id) on delete set null,
  role public.message_role not null,
  kind public.message_kind not null default 'text',
  content text not null default '',
  -- Path inside the private "creations" bucket; served through signed URLs.
  image_path text,
  moderation jsonb,
  created_at timestamptz not null default now()
);

create table public.pins (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  position integer not null,
  created_at timestamptz not null default now(),
  unique (participant_id, message_id)
);

-- ---------- Indexes ----------

create index classes_code_idx on public.classes (code);
create index classes_school_idx on public.classes (school_id);
create index sessions_public_id_idx on public.sessions (public_id);
create index sessions_class_idx on public.sessions (class_id);
create index participants_session_name_idx on public.participants (session_id, display_name);
create index messages_participant_created_idx on public.messages (participant_id, created_at);
create index messages_parent_idx on public.messages (parent_id);
create index pins_participant_idx on public.pins (participant_id, position);

-- ---------- Auth → profile ----------

-- Invited users carry school_id, role and display_name in their metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, school_id, role, display_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid,
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'teacher')::public.profile_role,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------- RLS helpers ----------

create or replace function public.my_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.session_in_my_school(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    join public.classes c on c.id = s.class_id
    where s.id = p_session and c.school_id = public.my_school_id()
  );
$$;

create or replace function public.participant_in_my_school(p_participant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants p
    join public.sessions s on s.id = p.session_id
    join public.classes c on c.id = s.class_id
    where p.id = p_participant and c.school_id = public.my_school_id()
  );
$$;

-- ---------- Row-level security ----------

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.missions enable row level security;
alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;
alter table public.pins enable row level security;

create policy "schools: members read" on public.schools
  for select to authenticated
  using (id = public.my_school_id());

create policy "profiles: school members read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or school_id = public.my_school_id());

-- A user may edit their own display name but not promote themselves or change school.
create policy "profiles: edit own name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.my_role()
    and school_id = public.my_school_id()
    and is_superadmin = false
  );

create policy "classes: school members read" on public.classes
  for select to authenticated
  using (school_id = public.my_school_id());

create policy "classes: teachers create their own" on public.classes
  for insert to authenticated
  with check (school_id = public.my_school_id() and teacher_id = auth.uid());

create policy "classes: owner or admin edits" on public.classes
  for update to authenticated
  using (teacher_id = auth.uid() or (school_id = public.my_school_id() and public.is_school_admin()))
  with check (school_id = public.my_school_id());

create policy "classes: owner or admin deletes" on public.classes
  for delete to authenticated
  using (teacher_id = auth.uid() or (school_id = public.my_school_id() and public.is_school_admin()));

create policy "missions: published are readable" on public.missions
  for select to authenticated
  using (published);

create policy "sessions: school members read" on public.sessions
  for select to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.school_id = public.my_school_id()));

create policy "sessions: class teacher starts" on public.sessions
  for insert to authenticated
  with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

create policy "sessions: class teacher or admin ends" on public.sessions
  for update to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = class_id
      and (c.teacher_id = auth.uid() or (c.school_id = public.my_school_id() and public.is_school_admin()))
  ));

create policy "sessions: admin deletes" on public.sessions
  for delete to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = class_id and c.school_id = public.my_school_id() and public.is_school_admin()
  ));

create policy "participants: school members read" on public.participants
  for select to authenticated
  using (public.session_in_my_school(session_id));

create policy "messages: school members read" on public.messages
  for select to authenticated
  using (public.participant_in_my_school(participant_id));

create policy "pins: school members read" on public.pins
  for select to authenticated
  using (public.participant_in_my_school(participant_id));
