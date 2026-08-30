-- AI Reception (voice) — a second paid service, same pattern as CRM.
-- Run after 0001_init.sql.

create table if not exists public.voice_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,

  -- A Twilio Subaccount auto-created under the PLATFORM's own Twilio
  -- account (lib/voice/provisioning.ts) — not a client-entered account.
  -- Clients never see or enter Twilio credentials; usage bills to the
  -- platform, not to them. See README's "AI Reception" section.
  twilio_account_sid text,
  twilio_auth_token_enc text, -- the Subaccount's own Auth Token, AES-256-GCM ciphertext (lib/crypto.ts). Never selected back to the client.
  twilio_phone_number text, -- the number purchased for this client under their Subaccount

  -- If set, an incoming call rings this number first; the AI only picks up
  -- if it goes unanswered. If null, the AI answers every call directly.
  forwarding_number text,

  business_name text,
  business_context text, -- free-form: services, hours, pricing, anything the AI should know
  greeting text,
  enabled boolean not null default true,

  -- Unpredictable routing token used in the inbound webhook URL
  -- (/api/twilio/voice/[token]) so Twilio's request tells us which
  -- client's settings + Twilio Auth Token to use, without exposing the
  -- user id. Rotate via lib/voice/actions.ts regenerateWebhookToken().
  webhook_token text not null unique default encode(gen_random_bytes(24), 'hex'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voice_settings enable row level security;

create policy "Owner can manage own voice settings"
  on public.voice_settings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists set_updated_at on public.voice_settings;
create trigger set_updated_at before update on public.voice_settings
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
create table if not exists public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  twilio_call_sid text not null unique,

  from_number text,
  to_number text,
  status text not null default 'ringing'
    check (status in ('ringing', 'human_answered', 'ai_answered', 'completed', 'no_answer', 'failed')),

  -- [{ role: 'caller' | 'ai', text: string, at: timestamptz }, ...]
  transcript jsonb not null default '[]'::jsonb,
  summary text,

  contact_id uuid references public.crm_contacts (id) on delete set null,

  duration_seconds integer,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voice_calls_owner_idx on public.voice_calls (owner_id);
create index if not exists voice_calls_started_idx on public.voice_calls (owner_id, started_at desc);

alter table public.voice_calls enable row level security;

create policy "Owner can view own calls"
  on public.voice_calls for select
  using (auth.uid() = owner_id);

-- No insert/update/delete policy for authenticated users: call rows are
-- written only by the Twilio webhook routes using the service-role key.
