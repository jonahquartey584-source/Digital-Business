import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, PRODUCTS, type ProductSlug } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { releaseNumberForUser } from "@/lib/voice/provisioning";
import { resolveOrCreateUserForEmail } from "@/lib/auth-provisioning";

export const runtime = "nodejs";

function productForPriceId(priceId: string | undefined): ProductSlug | null {
  if (!priceId) return null;
  const entry = Object.entries(PRODUCTS).find(
    ([, p]) => p.priceId === priceId
  );
  return (entry?.[0] as ProductSlug) ?? null;
}

async function upsertFromSubscription(
  subscription: Stripe.Subscription,
  fallbackProduct?: string
) {
  const supabase = createAdminClient();

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error(
      "Stripe subscription missing supabase_user_id metadata:",
      subscription.id
    );
    return;
  }

  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id;
  const product =
    subscription.metadata?.product ??
    productForPriceId(priceId) ??
    fallbackProduct ??
    "crm";

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      product,
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      price_id: priceId ?? null,
      status: subscription.status,
      current_period_end: firstItem
        ? new Date(firstItem.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,product" }
  );

  // Twilio bills monthly number rental whether or not the number is used,
  // so a cancelled AI Reception subscription needs its number released
  // immediately — not left running (and billing this platform) until
  // someone notices. past_due is a payment grace period, not a real
  // cancellation, so it's deliberately excluded here.
  if (product === "voice" && subscription.status === "canceled") {
    await releaseNumberForUser(userId);
  }
}

/**
 * Handles the "paid without an existing account" path
 * (app/api/stripe/checkout — anonymous checkout): resolves or creates the
 * Supabase account for the email Stripe collected, then writes that link
 * back onto the Stripe subscription/customer so every future webhook event
 * for it already carries supabase_user_id — this only needs to run once,
 * right after the first successful payment.
 */
async function linkAnonymousCheckoutToAccount(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  email: string | null | undefined,
  siteUrl: string
): Promise<Stripe.Subscription> {
  if (!email) {
    console.error(
      "Anonymous checkout completed with no email on the session:",
      subscription.id
    );
    return subscription;
  }

  const userId = await resolveOrCreateUserForEmail(email, siteUrl);

  const updated = await stripe.subscriptions.update(subscription.id, {
    metadata: { ...subscription.metadata, supabase_user_id: userId },
  });

  const admin = createAdminClient();
  const customerId =
    typeof updated.customer === "string" ? updated.customer : updated.customer.id;
  await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);

  return updated;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 }
    );
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        let subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id
        );

        if (!subscription.metadata?.supabase_user_id) {
          const siteUrl =
            process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
          subscription = await linkAnonymousCheckoutToAccount(
            stripe,
            subscription,
            session.customer_details?.email,
            siteUrl
          );
        }

        await upsertFromSubscription(subscription, session.metadata?.product);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertFromSubscription(subscription);
      break;
    }

    default:
      // Unhandled event types are ignored — extend this switch as needed.
      break;
  }

  return NextResponse.json({ received: true });
}
