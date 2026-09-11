/**
 * Pull the authorization code out of whatever the user pastes back from
 * eBay's consent redirect.
 *
 * Separate from the CLI so it can be tested: this is the step most likely to
 * be fed something unexpected, since people paste the full address bar, just
 * the code, a URL-encoded code, or occasionally an error redirect.
 */
export function extractEbayCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    // An error redirect carries no code; say so rather than half-matching.
    const code = url.searchParams.get('code');
    if (code) return code;
    return null;
  } catch {
    // Not a URL -- fall through and treat it as a bare code.
  }

  /*
   * A bare code is a long opaque token with no whitespace. Testing for that
   * rather than listing allowed characters: a real eBay code looks like
   * v^1.1#i^1#f^0#r^1#... , so any hand-written character class ends up
   * rejecting valid codes the moment eBay changes its encoding.
   */
  if (!/\s/.test(trimmed) && trimmed.length > 20) {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }
  return null;
}
