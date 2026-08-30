import Link from "next/link";
import { LogoWordmark } from "@/components/logo-wordmark";
import { PRODUCTS, type ProductSlug } from "@/lib/stripe";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const sp = await searchParams;
  const product = sp.product && sp.product in PRODUCTS ? (sp.product as ProductSlug) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="mx-auto inline-flex w-fit">
          <LogoWordmark />
        </Link>

        <div className="card mt-8 p-8">
          <h1 className="font-display text-xl font-bold text-cream">Payment successful</h1>
          <p className="mt-3 text-sm text-cream-dim">
            {product ? `You're subscribed to ${PRODUCTS[product].name}. ` : ""}
            Check your email for a link to set your password — that logs you
            straight into your new Qp Digital account.
          </p>
          <p className="mt-4 text-xs text-cream-dim">
            Didn&apos;t get it? Check spam, or{" "}
            <Link href="/login" className="text-gold-300 hover:underline">
              try logging in
            </Link>{" "}
            in a few minutes.
          </p>
        </div>
      </div>
    </main>
  );
}
