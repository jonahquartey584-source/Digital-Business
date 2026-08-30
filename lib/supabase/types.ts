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
