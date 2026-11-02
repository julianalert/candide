-- Server-side helpers called with the service key from the play routes and ops scripts.

-- Atomic counters that enforce the per-kid caps. Return the new value.
create or replace function public.bump_message_count(p_participant uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.participants
  set message_count = message_count + 1
  where id = p_participant
  returning message_count;
$$;

create or replace function public.bump_image_count(p_participant uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.participants
  set image_count = image_count + 1
  where id = p_participant
  returning image_count;
$$;

-- Images generated today across a whole school, for the daily hard stop.
create or replace function public.school_images_today(p_school uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.messages m
  join public.participants p on p.id = m.participant_id
  join public.sessions s on s.id = p.session_id
  join public.classes c on c.id = s.class_id
  where c.school_id = p_school
    and m.role = 'assistant'
    and m.kind = 'image'
    and m.created_at >= date_trunc('day', now());
$$;

-- Sessions auto-end three hours after they start.
create or replace function public.end_stale_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.sessions
  set ended_at = started_at + interval '3 hours'
  where ended_at is null and started_at < now() - interval '3 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Transcripts are kept 90 days for safety review. Pinned creations stay.
create or replace function public.purge_old_transcripts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.messages m
  where m.created_at < now() - interval '90 days'
    and not exists (select 1 from public.pins p where p.message_id = m.id)
    and not exists (
      select 1 from public.messages child
      join public.pins p on p.message_id = child.id
      where child.parent_id = m.id
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Weekly moderation report: blocked messages per school and reason.
create or replace function public.moderation_report(p_since timestamptz)
returns table (school_id uuid, school_name text, stage text, reason text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    sc.id,
    sc.name,
    m.moderation ->> 'stage',
    m.moderation ->> 'reason',
    count(*)
  from public.messages m
  join public.participants p on p.id = m.participant_id
  join public.sessions s on s.id = p.session_id
  join public.classes c on c.id = s.class_id
  join public.schools sc on sc.id = c.school_id
  where m.created_at >= p_since
    and (m.moderation ->> 'ok') = 'false'
  group by sc.id, sc.name, m.moderation ->> 'stage', m.moderation ->> 'reason'
  order by sc.name, count(*) desc;
$$;

-- These run with the service key only.
revoke execute on function public.bump_message_count(uuid) from anon, authenticated;
revoke execute on function public.bump_image_count(uuid) from anon, authenticated;
revoke execute on function public.school_images_today(uuid) from anon, authenticated;
revoke execute on function public.end_stale_sessions() from anon, authenticated;
revoke execute on function public.purge_old_transcripts() from anon, authenticated;
revoke execute on function public.moderation_report(timestamptz) from anon, authenticated;
