/**
 * Text wordmark used in the site nav/headers — matches qp-digital.netlify.app:
 * "Qp" in bold gold serif, "Digital" in a lighter-weight cream serif.
 */
export function LogoWordmark({ className = "text-2xl" }: { className?: string }) {
  return (
    <span className={`font-serif ${className}`}>
      <span className="font-bold text-gold-300">Qp</span>{" "}
      <span className="font-medium text-cream">Digital</span>
    </span>
  );
}
