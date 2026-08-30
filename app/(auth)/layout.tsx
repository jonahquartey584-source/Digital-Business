import Link from "next/link";
import { LogoWordmark } from "@/components/logo-wordmark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="mx-auto inline-flex w-fit">
            <LogoWordmark />
          </Link>
        </div>
        <div className="card p-8">{children}</div>
      </div>
    </main>
  );
}
