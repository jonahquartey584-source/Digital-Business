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
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  stripe_customer_id: string | null;
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

export type LeadStatus = "new" | "contacted" | "unqualified" | "promoted";

export interface CrmLead {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  promoted_contact_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "open" | "done";

export interface CrmTask {
  id: string;
  owner_id: string;
  lead_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  title: string;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface CrmImport {
  id: string;
  owner_id: string;
  filename: string;
  row_count: number;
  success_count: number;
  error_count: number;
  status: "completed" | "failed";
  error_summary: string | null;
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

// ---------- Booking System ----------

/** ["09:00", "17:00"] style ranges, per weekday. Empty/missing = closed. */
export type WeeklyHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>
>;

export interface BookingSettings {
  id: string;
  owner_id: string;
  slug: string;
  business_name: string | null;
  description: string | null;
  timezone: string;
  weekly_hours: WeeklyHours;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingService {
  id: string;
  owner_id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  active: boolean;
  created_at: string;
}

export type BookingStatus = "confirmed" | "cancelled";

export interface Booking {
  id: string;
  owner_id: string;
  service_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  contact_id: string | null;
  created_at: string;
}
