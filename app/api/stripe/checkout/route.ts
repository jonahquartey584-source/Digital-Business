import { NextResponse } from "next/server";
import { getStripe, PRODUCTS, type ProductSlug } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const product = formData.get("product") as ProductSlug | null;

  if (!product || !(product in PRODUCTS)) {
    return NextResponse.json({ error: "Unknown product." }, { status: 400 });
  }

  const priceId = PRODUCTS[product].priceId;
  if (!priceId) {
    return NextResponse.json(
      {
        error: `STRIPE_${product.toUpperCase()}_PRICE_ID is not configured.`,
      },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  // Reuse an existing Stripe customer for this user if we have one on file.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  let customerId = profile?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/dashboard/billing?success=1`,
    cancel_url: `${siteUrl}/dashboard/billing`,
    subscription_data: {
      metadata: { supabase_user_id: user.id, product },
    },
    metadata: { supabase_user_id: user.id, product },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not create checkout session." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
