-- Qp Digital SaaS — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company_name text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Automatically create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- subscriptions: one row per (user, product/service). Written by the Stripe
-- webhook using the service role key — RLS below only allows users to READ
-- their own row, never write it directly.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product text not null, -- e.g. 'crm'; matches lib/stripe.ts PRODUCTS keys
  stripe_customer_id text,
  stripe_subscription_id text,
  price_id text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product)
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for authenticated users on purpose:
-- only the service role (Stripe webhook) may write to this table.

-- ---------------------------------------------------------------------------
-- CRM tables. Every row is scoped to owner_id = auth.uid(); this is a
-- single-user-per-account model — see README for how to extend to teams.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  website text,
  industry text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid references public.crm_companies (id) on delete set null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.crm_contacts (id) on delete set null,
  company_id uuid references public.crm_companies (id) on delete set null,
  title text not null,
  value numeric(12, 2),
  stage text not null default 'lead'
    check (stage in ('lead', 'qualified', 'proposal', 'won', 'lost')),
  close_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.crm_contacts (id) on delete cascade,
  deal_id uuid references public.crm_deals (id) on delete cascade,
  type text not null default 'note',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists crm_contacts_owner_idx on public.crm_contacts (owner_id);
create index if not exists crm_companies_owner_idx on public.crm_companies (owner_id);
create index if not exists crm_deals_owner_idx on public.crm_deals (owner_id);
create index if not exists crm_activities_owner_idx on public.crm_activities (owner_id);

alter table public.crm_companies enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_activities enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['crm_companies', 'crm_contacts', 'crm_deals', 'crm_activities']
  loop
    execute format(
      'create policy "Owner can manage own rows" on public.%I for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);',
      t
    );
  end loop;
end $$;

-- Keep updated_at current on every row change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.crm_companies;
create trigger set_updated_at before update on public.crm_companies
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.crm_contacts;
create trigger set_updated_at before update on public.crm_contacts
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.crm_deals;
create trigger set_updated_at before update on public.crm_deals
  for each row execute procedure public.set_updated_at();
