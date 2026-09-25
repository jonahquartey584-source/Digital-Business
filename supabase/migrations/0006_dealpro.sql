-- Deal Pro — a fourth paid service: analyse rent-to-serviced-accommodation
-- deals, track due diligence, build investor packs and Deal Notices.
-- Run after 0001–0005.

create table if not exists public.dealpro_deals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,

  name text not null default 'New deal',
  area text,
  strategy text not null default 'R2SA' check (strategy in ('R2SA', 'R2R')),
  london boolean not null default false,
  status text not null default 'Checking'
    check (status in ('Checking', 'Issue found', 'Sent to sourcer', 'Completed')),

  -- [{ label, rent, dep, rate }] — see lib/dealpro/model.ts DealUnit
  units jsonb not null default '[]'::jsonb,
  -- { fee, clean, stay, other } — see lib/dealpro/model.ts Assumptions
  assumptions jsonb not null default '{}'::jsonb,
  -- [{ k, s, n, ai }] one per DD_TEMPLATE item
  diligence jsonb not null default '[]'::jsonb,
  ai_researched_at timestamptz,
  -- { biz, redress, fee, nda, final }
  pack jsonb not null default '{}'::jsonb,
  -- { co, email, addr, ll, role, phone, lemail, use, docs }
  notice jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dealpro_deals_owner_idx on public.dealpro_deals (owner_id, updated_at desc);

alter table public.dealpro_deals enable row level security;

create policy "Owner can manage own deals"
  on public.dealpro_deals for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists set_updated_at on public.dealpro_deals;
create trigger set_updated_at before update on public.dealpro_deals
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Credit ledger. AI tasks (advert import, due diligence research, final
-- pack) spend credits from a monthly allowance (lib/dealpro/credits.ts);
-- the balance is allowance minus this month's rows. Insert-only from the
-- user's side: credits must be positive, so the only thing a user could do
-- by writing here directly is spend their own allowance.
create table if not exists public.dealpro_credit_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  deal_id uuid references public.dealpro_deals (id) on delete set null,
  action text not null check (action in ('import', 'research', 'pack')),
  credits integer not null check (credits > 0),
  created_at timestamptz not null default now()
);

create index if not exists dealpro_credit_usage_owner_idx
  on public.dealpro_credit_usage (owner_id, created_at desc);

alter table public.dealpro_credit_usage enable row level security;

create policy "Owner can view own credit usage"
  on public.dealpro_credit_usage for select
  using (auth.uid() = owner_id);

create policy "Owner can record own credit usage"
  on public.dealpro_credit_usage for insert
  with check (auth.uid() = owner_id);
