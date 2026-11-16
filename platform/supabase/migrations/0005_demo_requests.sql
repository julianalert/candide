-- "Book a demo" requests from candideai.com. Written only by the /api/demo-request
-- route with the service key; no policies, so nobody reads it through the API.

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  city_country text not null,
  contact_name text not null,
  role text not null,
  email text not null,
  phone text not null,
  ages text[] not null default '{}',
  club_groups text,
  devices text,
  notes text,
  -- Whether the team alert and the confirmation went out through Loops.
  emails_sent boolean not null default false,
  email_error text,
  created_at timestamptz not null default now()
);

create index demo_requests_created_idx on public.demo_requests (created_at desc);

alter table public.demo_requests enable row level security;
