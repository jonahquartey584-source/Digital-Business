/**
 * The "Qp" badge used everywhere the brand mark appears in the UI.
 * Colors match public/icons (see scripts/logo-source.svg) — black, dark
 * gold, off-white ring. Change the palette in tailwind.config.ts (`logo.*`)
 * to restyle both the app icons and this badge together.
 */
export function LogoMark({ className = "h-8 w-8 text-sm" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-logo-black font-semibold text-logo-gold ring-1 ring-inset ring-logo-offwhite/30 ${className}`}
    >
      Qp
    </span>
  );
}
