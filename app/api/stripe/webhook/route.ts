import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, PRODUCTS, type ProductSlug } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { releaseNumberForUser } from "@/lib/voice/provisioning";

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
        const subscription = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id
        );
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
