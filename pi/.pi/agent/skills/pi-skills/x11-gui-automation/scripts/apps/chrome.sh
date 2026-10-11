#!/bin/bash
# chrome.sh — launch Chrome against an agent's claimed X11 environment
#
# Purpose: app-specific launcher. Knows chrome's flags, allocates a free CDP
# (remote debugging) port, verifies chrome is answering, and records
# CHROME_PORT / CHROME_PANE / PROFILE_DIR in the agent's state file.
#
# Usage:   chrome.sh <agent> [app] [--persistent]
#          --persistent: copy-on-claim from the golden master profile
#          (~/.agent-chrome-profile-master, created once via chrome_bootstrap.sh)
#          so the human's logins (LinkedIn, Gmail, ...) are already live. On
#          release, the profile is synced back to the master so new logins persist.
# Exit:    0 ok | 1 no env | 2 no free CDP port | 3 chrome failed to start | 4 already launched
# Deps:    x11_env.sh, tmux, google-chrome, curl, lsof, rsync

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="$SCRIPT_DIR/x11_env.sh"

agent=""; app="chrome"; PERSISTENT=0
for arg in "$@"; do
    case "$arg" in
        --persistent) PERSISTENT=1;;
        *) [[ -z "$agent" ]] && agent="$arg" || app="$arg";;
    esac
done
[[ -n "$agent" ]] || { echo "usage: chrome.sh <agent> [app] [--persistent]" >&2; exit 1; }

SF="/tmp/x11-env/$agent/$app.env"
[[ -f "$SF" ]] || { echo "ERROR: no env for $agent/$app — run: x11_env.sh claim $agent $app" >&2; exit 1; }
source "$SF"

if grep -q '^CHROME_PORT=' "$SF"; then
    echo "ERROR: chrome already launched for $agent/$app (CHROME_PORT=$(grep '^CHROME_PORT=' "$SF" | cut -d= -f2))." >&2
    echo "Release first: x11_env.sh release $agent $app" >&2
    exit 4
fi

# Take the x11_env claim lock for the port-scan/launch/health-check/state-append
# section so two concurrent launches can't race onto the same CDP port.
LOCK_DIR="/tmp/x11-env.lock"; LOCK_STALE_SECS=600
chrome_lock() {
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        echo "$$-$(date +%s)" > "$LOCK_DIR/owner"
        return 0
    fi
    return 1
}
lock_age() {
    local now mtime
    now=$(date +%s)
    mtime=$(stat -c %Y "$LOCK_DIR/owner" 2>/dev/null || echo "$now")
    echo $(( now - mtime ))
}
# wait up to 30s, steal stale lock after 600s (same policy as x11_env.sh)
i=0
until chrome_lock; do
    age=$(lock_age)
    if (( age > LOCK_STALE_SECS )); then
        echo "chrome: stale lock (${age}s old) — stealing it." >&2
        rm -rf "$LOCK_DIR"; chrome_lock || { echo "ERROR: could not steal stale lock" >&2; exit 2; }
    elif (( i >= 30 )); then
        echo "ERROR: could not acquire x11_env lock after 30s (held by $(cat "$LOCK_DIR/owner" 2>/dev/null))." >&2
        exit 2
    else
        sleep 1; i=$(( i + 1 ))
    fi
done
trap 'rm -rf "$LOCK_DIR"' EXIT

# allocate CDP port
port=9222
while (( port <= 9299 )); do
    lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1 || break
    port=$(( port + 1 ))
done
(( port <= 9299 )) || { echo "ERROR: no free CDP port (9222-9299)" >&2; exit 2; }

profile="/tmp/chrome-${port}-profile"
if (( PERSISTENT )); then
    MASTER="$HOME/.agent-chrome-profile-master"
    if [[ -d "$MASTER" && -n "$(ls -A "$MASTER" 2>/dev/null)" ]]; then
        echo "chrome: persistent mode — seeding profile from $MASTER" >&2
        mkdir -p "$profile"
        rsync -a --exclude 'Singleton*' --exclude 'Cache*' --exclude 'Code Cache*' --exclude 'GPUCache*' \
            "$MASTER/" "$profile/" || { echo "ERROR: profile copy failed" >&2; exit 3; }
    else
        echo "WARNING: --persistent requested but master profile is empty." >&2
        echo "Run apps/chrome_bootstrap.sh first so the human can log in; continuing with a fresh profile." >&2
    fi
fi

# launch in a dedicated window of the app's environment
pane=$("$ENV" run "$agent" "$app" \
    "google-chrome --remote-debugging-port=$port --user-data-dir=$profile --no-sandbox --disable-gpu --password-store=basic") \
    || { rm -rf "$LOCK_DIR"; trap - EXIT; echo "ERROR: could not create chrome pane" >&2; exit 3; }

# health check: CDP must answer /json/version
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -s "http://localhost:${port}/json/version" | grep -q Browser; then ok=1; break; fi
    sleep 1
done
if (( ! ok )); then
    echo "ERROR: chrome did not answer CDP on port $port. Pane output:" >&2
    tmux capture-pane -t "$pane" -p 2>/dev/null | tail -20 >&2
    rm -rf "$LOCK_DIR"; trap - EXIT
    exit 3
fi

{
    echo "CHROME_PORT=$port"
    echo "CHROME_PANE=$pane"
    echo "PROFILE_DIR=$profile"
    if (( PERSISTENT )); then
        echo "PERSISTENT=1"
        echo "PROFILE_MASTER=$HOME/.agent-chrome-profile-master"
    fi
} >> "$SF"

rm -rf "$LOCK_DIR"; trap - EXIT

echo "chrome: OK for $agent/$app — CDP http://localhost:$port"
echo "automate: browser CLI with --port $port, or raw CDP; DOM-first, xdotool only when pixels are required"
echo "observe: vncviewer localhost:$VNC_PORT"
exit 0
