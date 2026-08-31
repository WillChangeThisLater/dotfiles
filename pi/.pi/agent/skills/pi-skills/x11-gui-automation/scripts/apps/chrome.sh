#!/bin/bash
# chrome.sh — launch Chrome against an agent's claimed X11 environment
#
# Purpose: app-specific launcher. Knows chrome's flags, allocates a free CDP
# (remote debugging) port, verifies chrome is answering, and records
# CHROME_PORT / CHROME_PANE / PROFILE_DIR in the agent's state file.
#
# Usage:   chrome.sh <agent> [app]      (app defaults to 'chrome')
# Exit:    0 ok | 1 no env | 2 no free CDP port | 3 chrome failed to start | 4 already launched
# Deps:    x11_env.sh, tmux, google-chrome, curl, lsof

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="$SCRIPT_DIR/x11_env.sh"

agent="${1:-}"; app="${2:-chrome}"
[[ -n "$agent" ]] || { echo "usage: chrome.sh <agent> [app]" >&2; exit 1; }

SF="/tmp/x11-env/$agent/$app.env"
[[ -f "$SF" ]] || { echo "ERROR: no env for $agent/$app — run: x11_env.sh claim $agent $app" >&2; exit 1; }
source "$SF"

if grep -q '^CHROME_PORT=' "$SF"; then
    echo "ERROR: chrome already launched for $agent/$app (CHROME_PORT=$(grep '^CHROME_PORT=' "$SF" | cut -d= -f2))." >&2
    echo "Release first: x11_env.sh release $agent $app" >&2
    exit 4
fi

# allocate CDP port
port=9222
while (( port <= 9299 )); do
    lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1 || break
    port=$(( port + 1 ))
done
(( port <= 9299 )) || { echo "ERROR: no free CDP port (9222-9299)" >&2; exit 2; }

profile="/tmp/chrome-${port}-profile"

# launch in a dedicated pane of the app's window
pane=$("$ENV" run "$agent" "$app" \
    "google-chrome --remote-debugging-port=$port --user-data-dir=$profile --no-sandbox --disable-gpu") \
    || { echo "ERROR: could not create chrome pane" >&2; exit 3; }

# health check: CDP must answer /json/version
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -s "http://localhost:${port}/json/version" | grep -q Browser; then ok=1; break; fi
    sleep 1
done
if (( ! ok )); then
    echo "ERROR: chrome did not answer CDP on port $port. Pane output:" >&2
    tmux capture-pane -t "$pane" -p 2>/dev/null | tail -20 >&2
    exit 3
fi

{
    echo "CHROME_PORT=$port"
    echo "CHROME_PANE=$pane"
    echo "PROFILE_DIR=$profile"
} >> "$SF"

echo "chrome: OK for $agent/$app — CDP http://localhost:$port"
echo "automate: browser CLI with --port $port, or raw CDP; DOM-first, xdotool only when pixels are required"
echo "observe: vncviewer localhost:$VNC_PORT"
exit 0
