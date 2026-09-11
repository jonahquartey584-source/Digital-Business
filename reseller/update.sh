#!/usr/bin/env bash
#
# Update the app without touching your data.
#
#   bash update.sh
#
# Replaces the code (src/, scripts/, package.json, docs) and leaves alone:
#   .env            your password and API keys
#   data/profiles/  your marketplace logins
#   data/media/     your photos and story renders
#   data/reseller.db your products and post history
#
set -euo pipefail
cd "$(dirname "$0")"

BRANCH="claude/jolly-einstein-f9xxyk"
ZIP="https://github.com/jonahquartey584-source/Digital-Business/archive/refs/heads/${BRANCH}.zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say() { printf '\n  %s\n' "$*"; }

say "Downloading the latest version…"
curl -fsSL -o "$TMP/app.zip" "$ZIP"
unzip -oq "$TMP/app.zip" -d "$TMP/unpacked"

SRC="$(find "$TMP/unpacked" -maxdepth 2 -type d -name reseller | head -1)"
[ -n "$SRC" ] || { printf '\n  ERROR: could not find the app inside the download.\n\n' >&2; exit 1; }

# Refuse to run somewhere that isn't an install, rather than scattering files.
[ -f package.json ] || { printf '\n  ERROR: run this from inside your reseller-app folder.\n\n' >&2; exit 1; }

say "Replacing the code (your .env and data/ are untouched)…"
rm -rf src scripts
cp -R "$SRC/src" src
cp -R "$SRC/scripts" scripts
for file in package.json package-lock.json tsconfig.json setup.sh update.sh README.md SELECTORS.md .env.example "Start Reseller.command"; do
  [ -e "$SRC/$file" ] && cp "$SRC/$file" . || true
done
chmod +x setup.sh update.sh "Start Reseller.command" 2>/dev/null || true

say "Updating dependencies…"
npm install --no-audit --no-fund

# Keep .env in step with new settings without overwriting anything you set:
# report keys the example has that yours doesn't, and let you decide.
if [ -f .env ] && [ -f .env.example ]; then
  MISSING="$(
    grep -oE '^[A-Z_]+=' .env.example 2>/dev/null | tr -d '=' | sort -u | while read -r key; do
      grep -qE "^\s*${key}\s*=" .env || echo "    $key"
    done
  )"
  if [ -n "$MISSING" ]; then
    say "New settings available in this version (optional, defaults apply):"
    printf '%s\n' "$MISSING"
    printf '\n  Add any you want with:  open -e .env\n'
  fi
fi

cat <<'DONE'

  Updated. Start it again with:

      npm run dev

DONE
