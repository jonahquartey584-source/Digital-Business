/**
 * Compact square "Qp" badge — used where a full wordmark doesn't fit
 * (e.g. the PWA install banner). For nav/headers use LogoWordmark instead,
 * which matches qp-digital.netlify.app directly. Colors/font mirror
 * public/icons (see scripts/logo-source.svg).
 */
export function LogoMark({ className = "h-8 w-8 text-sm" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-ink font-serif font-bold text-gold-400 ring-1 ring-inset ring-cream/20 ${className}`}
    >
      Qp
    </span>
  );
}
