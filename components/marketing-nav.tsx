import Link from "next/link";
import { LogoWordmark } from "@/components/logo-wordmark";

export function MarketingNav() {
  return (
    <header className="relative z-10 border-b border-ink-border bg-ink-soft">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <LogoWordmark />
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="nav-link">
            Pricing
          </Link>
          <Link href="/login" className="nav-link">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}
