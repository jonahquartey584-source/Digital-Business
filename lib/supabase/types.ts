// Hand-written types matching supabase/migrations/0001_init.sql.
// If you change the schema, run `supabase gen types typescript` to regenerate
// this properly — this file is a minimal stand-in so the app type-checks
// without needing a live Supabase project during development.

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  product: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  price_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export type DealStage = "lead" | "qualified" | "proposal" | "won" | "lost";

export interface CrmCompany {
  id: string;
  owner_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContact {
  id: string;
  owner_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmDeal {
  id: string;
  owner_id: string;
  contact_id: string | null;
  company_id: string | null;
  title: string;
  value: number | null;
  stage: DealStage;
  close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmActivity {
  id: string;
  owner_id: string;
  contact_id: string | null;
  deal_id: string | null;
  type: string;
  content: string;
  created_at: string;
}

// ---------- AI Reception (voice) ----------

export interface VoiceSettings {
  id: string;
  owner_id: string;
  twilio_account_sid: string | null;
  twilio_auth_token_enc: string | null;
  twilio_phone_number: string | null;
  forwarding_number: string | null;
  business_name: string | null;
  business_context: string | null;
  greeting: string | null;
  enabled: boolean;
  webhook_token: string;
  created_at: string;
  updated_at: string;
}

export type VoiceCallStatus =
  | "ringing"
  | "human_answered"
  | "ai_answered"
  | "completed"
  | "no_answer"
  | "failed";

export interface VoiceTranscriptTurn {
  role: "caller" | "ai";
  text: string;
  at: string;
}

export interface VoiceCall {
  id: string;
  owner_id: string;
  twilio_call_sid: string;
  from_number: string | null;
  to_number: string | null;
  status: VoiceCallStatus;
  transcript: VoiceTranscriptTurn[];
  summary: string | null;
  contact_id: string | null;
  duration_seconds: number | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}
