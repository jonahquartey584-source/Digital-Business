#!/usr/bin/env bash
#
# First-run setup. Safe to re-run: it only fills in what's missing.
#
#   ./setup.sh
#
set -euo pipefail
cd "$(dirname "$0")"

say()  { printf '\n  %s\n' "$*"; }
fail() { printf '\n  ERROR: %s\n\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- node check
command -v node >/dev/null 2>&1 || fail "Node.js isn't installed. Get the LTS build from https://nodejs.org then re-run this."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node 20 or newer is required (you have $(node -v)). Update from https://nodejs.org"
fi
say "Node $(node -v) — good."

# ------------------------------------------------------------------- install
say "Installing dependencies (a minute or two)…"
npm install --no-audit --no-fund

# --------------------------------------------------------------- playwright
# Only the browser channels need Chromium, and it's a ~150MB download, so ask.
if [ ! -d "$HOME/.cache/ms-playwright" ] && [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
  say "The Poshmark / Depop / Mercari / Marketplace / OfferUp channels need"
  printf '  Chromium (~150MB). Download it now? [Y/n] '
  read -r reply || reply=""
  case "$reply" in
    [nN]*) say "Skipped. Run 'npx playwright install chromium' later if you want those." ;;
    *)     npx playwright install chromium ;;
  esac
fi

# -------------------------------------------------------------------- config
if [ ! -f .env ]; then
  cp .env.example .env
  say "Created .env from the example."
fi

# Set a password unless one is already there. Without it the app refuses every
# non-localhost request, so this is what makes it reachable from your phone.
if grep -qE '^\s*ADMIN_PASSWORD_HASH\s*=\s*\S' .env 2>/dev/null; then
  say "A password is already set in .env — leaving it alone."
else
  say "Choose a password for the page (at least 10 characters)."
  npm run --silent set-password -- --write
fi

# ---------------------------------------------------------------------- done
cat <<'DONE'

  Setup finished. Start it with:

      npm run dev

  Then open http://localhost:3000 and sign in.

  Next steps, in the order worth doing them:
    1. npm run login -- poshmark      (no API keys needed)
    2. BROWSER_DRY_RUN=1 npm run dev   then check data/outbox/failures/*.png
    3. A tunnel, to reach it from your phone and unlock eBay/Instagram/Facebook:
         cloudflared tunnel --url http://localhost:3000

  Full details in README.md.

DONE
