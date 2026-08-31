-- Qp Digital SaaS — CRM expansion: Leads Database, Tasks & Follow-ups,
-- and Import History. Reporting is computed from existing + these tables,
-- so it needs no schema of its own.

-- ---------------------------------------------------------------------------
-- crm_leads: unqualified inbound leads, separate from crm_contacts. A lead
-- gets promoted into a real crm_contacts row once it's worth a full record
-- (see promoteLead() in lib/crm/actions.ts) — the lead row is kept, marked
-- 'promoted', rather than deleted, so lead-source reporting stays accurate.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  source text, -- e.g. "Website form", "Referral", "CSV import"
  status text not null default 'new'
    check (status in ('new', 'contacted', 'unqualified', 'promoted')),
  notes text,
  promoted_contact_id uuid references public.crm_contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- crm_tasks: follow-ups, optionally linked to a lead, contact, or deal.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid references public.crm_leads (id) on delete cascade,
  contact_id uuid references public.crm_contacts (id) on delete cascade,
  deal_id uuid references public.crm_deals (id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- crm_imports: one row per CSV upload (Import History), written by
-- importLeadsCsv() in lib/crm/actions.ts alongside the crm_leads rows it
-- creates.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  row_count int not null default 0,
  success_count int not null default 0,
  error_count int not null default 0,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists crm_leads_owner_idx on public.crm_leads (owner_id);
create index if not exists crm_tasks_owner_idx on public.crm_tasks (owner_id);
create index if not exists crm_imports_owner_idx on public.crm_imports (owner_id);

alter table public.crm_leads enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_imports enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['crm_leads', 'crm_tasks', 'crm_imports']
  loop
    execute format(
      'create policy "Owner can manage own rows" on public.%I for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);',
      t
    );
  end loop;
end $$;

drop trigger if exists set_updated_at on public.crm_leads;
create trigger set_updated_at before update on public.crm_leads
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.crm_tasks;
create trigger set_updated_at before update on public.crm_tasks
  for each row execute procedure public.set_updated_at();
