-- The start date belongs to each club group, not to the school: groups can start
-- on different dates. Week dates and the Comic Con date come from the club's own
-- start date and meeting day.

alter table public.classes add column starts_on date;

-- Carry over any school-wide term start to its clubs. schools.term_start is no
-- longer read or written by the app; it stays in place (empty) rather than being dropped.
update public.classes c
set starts_on = s.term_start
from public.schools s
where s.id = c.school_id and s.term_start is not null and c.starts_on is null;

comment on column public.schools.term_start is 'Unused since 0008: each club has its own starts_on.';
