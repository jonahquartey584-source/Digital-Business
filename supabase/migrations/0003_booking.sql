-- Booking System — a third paid service, same pattern as CRM/AI Reception.
-- Run after 0001_init.sql and 0002_voice.sql.

create table if not exists public.booking_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,

  -- Public URL slug: qpdigital.app/book/<slug>. Must be unique platform-wide.
  slug text not null unique,

  business_name text,
  description text,
  timezone text not null default 'UTC', -- IANA name, e.g. "Europe/London"

  -- Weekly recurring hours: { "mon": [["09:00","17:00"]], "tue": [...], ... }.
  -- An empty/missing array for a day means closed. Multiple ranges per day
  -- (e.g. a lunch break) are supported since each day maps to a list.
  weekly_hours jsonb not null default '{}'::jsonb,

  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_settings enable row level security;

create policy "Owner can manage own booking settings"
  on public.booking_settings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- No public SELECT policy: the public booking page (app/book/[slug]) reads
-- via the service-role admin client (lib/booking/public-actions.ts), same
-- pattern as the Twilio webhooks — deliberate, so slug lookups can't be
-- used to enumerate a client's other data through RLS edge cases.

drop trigger if exists set_updated_at on public.booking_settings;
create trigger set_updated_at before update on public.booking_settings
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
create table if not exists public.booking_services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  duration_minutes integer not null default 30,
  price numeric(10, 2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists booking_services_owner_idx on public.booking_services (owner_id);

alter table public.booking_services enable row level security;

create policy "Owner can manage own services"
  on public.booking_services for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  service_id uuid references public.booking_services (id) on delete set null,

  customer_name text not null,
  customer_email text,
  customer_phone text,
  notes text,

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),

  contact_id uuid references public.crm_contacts (id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists bookings_owner_idx on public.bookings (owner_id);
create index if not exists bookings_owner_time_idx on public.bookings (owner_id, starts_at);

alter table public.bookings enable row level security;

create policy "Owner can view own bookings"
  on public.bookings for select
  using (auth.uid() = owner_id);

create policy "Owner can cancel own bookings"
  on public.bookings for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- No insert policy for authenticated users: bookings are created by
-- customers on the public page, which is unauthenticated by definition —
-- inserts go through the service-role admin client
-- (lib/booking/public-actions.ts createPublicBooking), which also
-- re-validates the slot is still free to prevent double-booking races.
