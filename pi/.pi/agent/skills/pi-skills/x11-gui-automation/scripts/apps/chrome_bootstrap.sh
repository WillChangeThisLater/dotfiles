#!/bin/bash
# chrome_bootstrap.sh — ONE-TIME login capture for the persistent agent profile
#
# Purpose: create the golden agent chrome profile with the human's logins
# (LinkedIn, Gmail, ...). The human logs in ONCE via VNC; afterwards every
# agent using --persistent gets these sessions for free via copy-on-claim.
#
# Flow:
#   1. requires a claimed env (x11_env.sh claim <agent> <app>)
#   2. launches chrome DIRECTLY on the master profile (~/.agent-chrome-profile-master)
#      — never run agents against the master at the same time (profile lock)
#   3. human logs into sites via vncviewer (interactive, not viewonly)
#   4. when the human says done: chrome is killed cleanly, cookies live in the master
#
# Usage: chrome_bootstrap.sh <agent> <app>
# Exit:  0 launched | 1 no env | 2 chrome failed
# NOTE:  cookies are flushed by chrome on graceful exit. Kill with
#        `pkill -f 'user-data-dir=<master>'` (TERM) — do not kill -9.

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="$SCRIPT_DIR/x11_env.sh"

agent="${1:-}"; app="${2:-}"
[[ -n "$agent" && -n "$app" ]] || { echo "usage: chrome_bootstrap.sh <agent> <app>" >&2; exit 1; }

SF="/tmp/x11-env/$agent/$app.env"
[[ -f "$SF" ]] || { echo "ERROR: no env for $agent/$app — run: x11_env.sh claim $agent $app" >&2; exit 1; }
source "$SF"

MASTER="$HOME/.agent-chrome-profile-master"
if [[ -d "$MASTER" && -n "$(ls -A "$MASTER" 2>/dev/null)" ]]; then
    echo "WARNING: master profile already exists at $MASTER" >&2
    echo "Re-running bootstrap will let the human UPDATE those logins (e.g. expired sessions)." >&2
fi

# allocate a CDP port so the agent can also inspect the browser during login
port=9222
while (( port <= 9299 )); do
    lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1 || break
    port=$(( port + 1 ))
done
(( port <= 9299 )) || { echo "ERROR: no free CDP port" >&2; exit 2; }

wid=$("$ENV" run "$agent" "$app" \
    "google-chrome --user-data-dir=$MASTER --remote-debugging-port=$port --no-sandbox --disable-gpu") \
    || { echo "ERROR: could not launch chrome" >&2; exit 2; }

echo "BOOTSTRAP_PORT=$port" > "/tmp/x11-env/$agent/$app.bootstrap.env"
echo "BOOTSTRAP_WINDOW=$wid" >> "/tmp/x11-env/$agent/$app.bootstrap.env"

echo "chrome bootstrap: launched on master profile ($MASTER), CDP http://localhost:$port"
echo ""
echo "NEXT STEPS:"
echo "  1. tell the human: run 'vncviewer localhost:$VNC_PORT' and log into the sites they want captured (e.g. LinkedIn, Gmail)"
echo "  2. when the human confirms they are done, kill chrome GRACEFULLY so cookies flush:"
echo "       pkill -f 'user-data-dir=$MASTER'"
echo "     (then verify $MASTER/Default/Cookies exists and is recent)

IMPORTANT: chrome flushes its cookie DB lazily (~every 45s). If you kill
chrome right after logging in, the session may NEVER reach disk. Prefer
shutting down via CDP: POST Browser.close to http://localhost:$port, or wait
>45s after the last login before killing. Verify Default/Cookies actually
contains a session row for the site."
echo "  3. future agents get these sessions via: apps/chrome.sh <agent> <app> --persistent"
exit 0
