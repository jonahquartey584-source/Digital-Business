/**
 * Compact square "Qp" badge — used where a full wordmark doesn't fit
 * (e.g. the PWA install banner). For nav/headers use LogoWordmark instead,
 * which matches qp-digital.netlify.app directly. Black bg, off-white "Qp",
 * gold ring — mirrors public/icons (see scripts/logo-source.svg); the dot
 * pattern from that file is dropped here since it turns to noise at badge
 * size, same reasoning as logo-simple-source.svg for the tiny favicons.
 */
export function LogoMark({ className = "h-8 w-8 text-sm" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-ink font-serif font-bold text-cream ring-1 ring-inset ring-gold-500/40 ${className}`}
    >
      Qp
    </span>
  );
}
