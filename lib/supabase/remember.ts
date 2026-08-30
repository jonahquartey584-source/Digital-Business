/**
 * A standalone constant with no other imports — safe to pull into both
 * lib/supabase/server.ts (Node runtime, uses next/headers) and
 * lib/supabase/middleware.ts (Edge middleware runtime, where next/headers
 * isn't usable) without dragging Node-only APIs into the Edge bundle.
 *
 * Marks a session as "don't remember me" — session-only cookies. Set once
 * at login (lib/auth-actions.ts), read by every place that refreshes the
 * Supabase session so the choice sticks for the whole session.
 */
export const REMEMBER_COOKIE = "qp-remember";
