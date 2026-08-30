import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";

export function MarketingNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <LogoMark />
          Qp Digital
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/pricing" className="hover:text-slate-900">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-slate-900">
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
