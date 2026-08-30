import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="mx-auto flex w-fit items-center gap-2 font-semibold text-slate-900"
          >
            <LogoMark />
            Qp Digital
          </Link>
        </div>
        <div className="card p-8">{children}</div>
      </div>
    </main>
  );
}
