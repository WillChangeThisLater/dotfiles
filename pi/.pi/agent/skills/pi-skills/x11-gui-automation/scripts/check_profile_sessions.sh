#!/bin/bash
# check_profile_sessions.sh — verify the persistent agent profile's logins are still alive
#
# Purpose: detect expired sessions (Google/LinkedIn or any site) in
# ~/.agent-chrome-profile-master BEFORE an agent hits a login wall mid-task.
# Launches a throwaway chrome with the persistent profile, checks each site
# for login-redirects, reports results, optionally notifies via ntfy.
#
# Usage:   check_profile_sessions.sh [--ntfy <topic>]
# Checks:  gmail    -> https://mail.google.com    (expired if redirected to accounts.google.com/ServiceLogin)
#          linkedin -> https://www.linkedin.com/feed/ (expired if redirected to /login or checkpoint)
# Exit:    0 all sessions alive | 1 one or more expired (ntfy sent if --ntfy) | 2 setup error
# Deps:    x11_env.sh, apps/chrome.sh, browser CLI (Chrome DevTools), curl

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NTFY_TOPIC=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --ntfy) NTFY_TOPIC="$2"; shift 2;;
        *) echo "unknown arg: $1" >&2; exit 2;;
    esac
done

AGENT="credscheck"
APP="chrome"
ENV="$SCRIPT_DIR/x11_env.sh"
CHROME="$SCRIPT_DIR/apps/chrome.sh"

if [[ ! -d "$HOME/.agent-chrome-profile-master" ]]; then
    echo "ERROR: no master profile — run apps/chrome_bootstrap.sh first" >&2
    exit 2
fi

cleanup() { "$ENV" release "$AGENT" "$APP" >/dev/null 2>&1 || true; }
trap cleanup EXIT

"$ENV" claim "$AGENT" "$APP" >/dev/null 2>&1 || { echo "ERROR: could not claim env" >&2; exit 2; }
"$CHROME" "$AGENT" "$APP" --persistent >/dev/null 2>&1 || { echo "ERROR: chrome failed to start" >&2; exit 2; }
source "/tmp/x11-env/$AGENT/$APP.env"
PORT="$CHROME_PORT"

url_for() { # <site-url> -> final URL after navigation
    browser go "$1" --port "$PORT" --timeout 25000 >/dev/null 2>&1
    sleep 3
    browser tabs --port "$PORT" 2>/dev/null | python3 -c "
import sys, json
try:
    ts = json.load(sys.stdin)['tabs']
    print(next((t.get('url','') for t in ts if '$1' in t.get('url','') or True), ''))
except Exception:
    print('')"
}

EXPIRED=""
# gmail
final=$(url_for "https://mail.google.com")
if echo "$final" | grep -qE "accounts\.google\.com|ServiceLogin"; then
    EXPIRED+="gmail "
    echo "EXPIRED: gmail -> $final"
else
    echo "ok: gmail session alive"
fi
# linkedin
final=$(url_for "https://www.linkedin.com/feed/")
if echo "$final" | grep -qE "linkedin\.com/(login|checkpoint|authwall)"; then
    EXPIRED+="linkedin "
    echo "EXPIRED: linkedin -> $final"
else
    echo "ok: linkedin session alive"
fi

if [[ -n "$EXPIRED" ]]; then
    echo "RESULT: expired sessions: $EXPIRED"
    if [[ -n "$NTFY_TOPIC" ]]; then
        curl -s -H "Title: 🔑 agent browser sessions expired" \
            -H "Priority: high" \
            -H "Tags: key,warning" \
            -d "Sessions expired: ${EXPIRED% }. Run the bootstrap (x11-gui-automation skill: chrome_bootstrap.sh) or log in via VNC to refresh them." \
            "ntfy.sh/$NTFY_TOPIC" >/dev/null || echo "WARNING: ntfy send failed" >&2
        echo "ntfy notification sent to $NTFY_TOPIC"
    fi
    exit 1
fi
echo "RESULT: all sessions alive"
exit 0
