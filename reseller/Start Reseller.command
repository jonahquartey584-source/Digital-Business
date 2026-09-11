#!/usr/bin/env bash
#
# Double-click this file to start Reseller Autopost.
#
# macOS opens it in a Terminal window and runs it; you don't type anything.
# The window has to stay open while you use the app -- it IS the app's engine.
# Close it (or press Ctrl-C) to stop.
#
set -uo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

printf '\n  Reseller Autopost\n  =================\n'

# ---------------------------------------------------------------- node check
if ! command -v node >/dev/null 2>&1; then
  cat <<'MSG'

  Node.js isn't installed yet.

  1. Go to https://nodejs.org
  2. Click the green "LTS" button
  3. Open the downloaded file and click through the installer
  4. Then double-click this Start file again

MSG
  printf '  Press Return to close this window. '
  read -r _
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  printf '\n  Your Node.js is too old (%s). Install the LTS build from\n' "$(node -v)"
  printf '  https://nodejs.org and double-click this file again.\n\n'
  printf '  Press Return to close this window. '
  read -r _
  exit 1
fi

# ------------------------------------------------------------- first-run setup
if [ ! -d node_modules ] || [ ! -f .env ]; then
  printf '\n  First run — setting things up. This takes a minute or two.\n'
  if ! bash setup.sh; then
    printf '\n  Setup did not finish. The error above says why.\n\n'
    printf '  Press Return to close this window. '
    read -r _
    exit 1
  fi
fi

# -------------------------------------------------------------------- build
# Running the compiled build rather than the dev server: it starts faster and
# doesn't rebuild on every file change.
if [ ! -d dist ] || [ -n "$(find src -newer dist -type f -print -quit 2>/dev/null)" ]; then
  printf '\n  Preparing the app…\n'
  npm run --silent build >/dev/null 2>&1 || {
    printf '  Build failed. Run "npm run build" here to see why.\n\n'
    printf '  Press Return to close this window. '
    read -r _
    exit 1
  }
fi

# --------------------------------------------------- open the browser when up
# Wait for the server to answer before opening the page, so you don't land on
# a "can't connect" error a second too early.
(
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "${URL}/healthz" 2>/dev/null; then
      command -v open >/dev/null 2>&1 && open "$URL"
      break
    fi
    sleep 0.5
  done
) &

printf '\n  Starting… your browser will open at %s\n' "$URL"
printf '  Keep this window open while you use the app.\n'
printf '  To stop: close this window, or press Ctrl-C.\n\n'

npm start
