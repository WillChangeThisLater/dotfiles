#!/bin/bash
# self_setup.sh — agent-driven browser/X11 environment setup with conflict protection
#
# Purpose: Let an agent spin up its own isolated browser environment (Xvfb display,
# chrome with remote debugging, x11vnc) without colliding with other agents.
# Uses an atomic mkdir-based lock so only one agent sets up at a time.
#
# Usage:   self_setup.sh <agent-id>
# Output:  On success, prints shell-sourceable KEY=VALUE lines:
#            DISPLAY_NUM=<n> CHROME_PORT=<n> VNC_PORT=<n> TMUX_SESSION=env-setup TMUX_WINDOW=env-<agent-id>
#          and writes the same to /tmp/x11-env/<agent-id>.env
# Exit:    0 on success (incl. idempotent re-run), nonzero on failure with diagnostics.
# Deps:    tmux, Xvfb, google-chrome, x11vnc, curl, lsof
# Workdir: anywhere. State lives in /tmp/x11-env and tmux session 'env-setup'.

set -u

AGENT_ID="${1:-}"
if [[ -z "$AGENT_ID" ]]; then
    echo "ERROR: usage: self_setup.sh <agent-id>" >&2
    exit 1
fi

LOCK_DIR="/tmp/x11-env.lock"
LOCK_STALE_SECS=600
STATE_DIR="/tmp/x11-env"
SESSION="env-setup"
WINDOW="env-${AGENT_ID}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$STATE_DIR"

# --- Idempotent re-run: if this agent already has an env, just report it ----
if [[ -f "$STATE_DIR/${AGENT_ID}.env" ]]; then
    echo "self_setup: environment for '$AGENT_ID' already exists. Reusing." >&2
    cat "$STATE_DIR/${AGENT_ID}.env"
    exit 0
fi

# --- Atomic claim -----------------------------------------------------------
claim_lock() {
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        echo "$$-$(date +%s)" > "$LOCK_DIR/owner"
        return 0
    fi
    return 1
}

lock_owner_age() {
    # age of lock in seconds based on the mtime of the owner file
    local now mtime
    now=$(date +%s)
    mtime=$(stat -c %Y "$LOCK_DIR/owner" 2>/dev/null || echo "$now")
    echo $(( now - mtime ))
}

if ! claim_lock; then
    AGE=$(lock_owner_age)
    if (( AGE > LOCK_STALE_SECS )); then
        echo "self_setup: found STALE lock (${AGE}s old, threshold ${LOCK_STALE_SECS}s). Stealing it." >&2
        rm -rf "$LOCK_DIR"
        if ! claim_lock; then
            echo "ERROR: could not steal stale lock (another agent grabbed it first). Retry in a moment." >&2
            exit 2
        fi
    else
        echo "ERROR: another agent is currently setting up an environment (lock held ${AGE}s)." >&2
        echo "Hint: wait ~15s and re-run this script. Check 'tmux ls' and $LOCK_DIR/owner for who holds it." >&2
        exit 2
    fi
fi

release_lock() {
    rm -rf "$LOCK_DIR"
}
trap release_lock EXIT

# --- Allocate ports ---------------------------------------------------------
alloc() { # $1=kind  $2=start  $3=max  $4=free-check-cmd
    local kind="$1" n="$2" max="$3" check="$4"
    while (( n <= max )); do
        if eval "$check"; then
            echo "self_setup: Found unused ${kind}: ${n}" >&2
            echo "$n"
            return 0
        fi
        n=$(( n + 1 ))
    done
    return 1
}

DISPLAY_NUM=$(alloc "X11 display" 1 99 '! ls /tmp/.X11-unix | grep -q "X${n}"') || {
    echo "ERROR: no free X11 display number (1-99)." >&2; exit 3; }
CHROME_PORT=$(alloc "chrome debugging port" 9222 9299 '! lsof -i :${n} >/dev/null 2>&1') || {
    echo "ERROR: no free chrome debugging port (9222-9299)." >&2; exit 3; }
VNC_PORT=$(alloc "VNC port" 5902 5999 '! lsof -i :${n} >/dev/null 2>&1') || {
    echo "ERROR: no free VNC port (5902-5999)." >&2; exit 3; }

# --- Create tmux session/window ---------------------------------------------
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux new-session -d -s "$SESSION" -n "$WINDOW"
elif tmux list-windows -t "$SESSION" -F '#W' | grep -qx "$WINDOW"; then
    # window exists but no .env file (checked earlier): residue of a crashed run.
    echo "self_setup: found orphaned window '$WINDOW' without state — reclaiming it." >&2
    "$SCRIPT_DIR/teardown.sh" "$AGENT_ID" >&2
    # fall through to fresh creation; teardown may or may not have killed the session
    tmux has-session -t "$SESSION" 2>/dev/null \
        && tmux new-window -t "$SESSION" -n "$WINDOW" \
        || tmux new-session -d -s "$SESSION" -n "$WINDOW"
else
    tmux new-window -t "$SESSION" -n "$WINDOW"
fi

# 2x2 grid: TL Xvfb, TR chrome, BL x11vnc, BR free (logs)
# Capture pane ids explicitly - pane indices shift as we split, ids do not.
WIN="$SESSION:$WINDOW"
TL=$(tmux display-message -p -t "$WIN.0" '#{pane_id}')
BL=$(tmux split-pane -v -P -F '#{pane_id}' -t "$TL")
TR=$(tmux split-pane -h -P -F '#{pane_id}' -t "$TL")
BR=$(tmux split-pane -h -P -F '#{pane_id}' -t "$BL")

P0="Xvfb :$DISPLAY_NUM -screen 0 1920x1080x24"
P1="env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE DISPLAY=:$DISPLAY_NUM google-chrome --remote-debugging-port=$CHROME_PORT --user-data-dir=/tmp/chrome-$CHROME_PORT-profile --no-sandbox --disable-gpu"
P2="env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE x11vnc -display :$DISPLAY_NUM -rfbport $VNC_PORT -viewonly -forever -shared -nopw"

tmux send-keys -t "$TL" "$P0" Enter
tmux send-keys -t "$TR" "$P1" Enter
tmux send-keys -t "$BL" "$P2" Enter

# --- Write state ------------------------------------------------------------
cat > "$STATE_DIR/${AGENT_ID}.env" <<EOF
DISPLAY_NUM=$DISPLAY_NUM
CHROME_PORT=$CHROME_PORT
VNC_PORT=$VNC_PORT
TMUX_SESSION=$SESSION
TMUX_WINDOW=$WINDOW
EOF

# --- Verify -----------------------------------------------------------------
sleep 2
FAIL=0
if ! ls /tmp/.X11-unix | grep -q "X${DISPLAY_NUM}"; then
    echo "ERROR: Xvfb socket /tmp/.X11-unix/X${DISPLAY_NUM} did not appear." >&2; FAIL=1
fi
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -s "http://localhost:${CHROME_PORT}/json/version" | grep -q Browser; then break; fi
    sleep 1
done
if ! curl -s "http://localhost:${CHROME_PORT}/json/version" | grep -q Browser; then
    echo "ERROR: chrome debugging port ${CHROME_PORT} is not answering." >&2; FAIL=1
fi
if ! lsof -i :"$VNC_PORT" >/dev/null 2>&1; then
    for _ in 1 2 3 4 5; do
        sleep 1
        lsof -i :"$VNC_PORT" >/dev/null 2>&1 && break
    done
fi
if ! lsof -i :"$VNC_PORT" >/dev/null 2>&1; then
    echo "ERROR: x11vnc is not listening on port ${VNC_PORT}." >&2; FAIL=1
fi

if (( FAIL )); then
    # preserve diagnostics BEFORE self-cleaning (teardown removes the panes)
    LOG="$STATE_DIR/${AGENT_ID}.log"
    {
        echo "=== self_setup.sh failed for $AGENT_ID (display :$DISPLAY_NUM, chrome :$CHROME_PORT, vnc :$VNC_PORT)"
        for P in 0 1 2 3; do
            echo "--- pane $P ---"
            tmux capture-pane -t "$SESSION:$WINDOW.$P" -p 2>/dev/null | tail -30
        done
    } > "$LOG" 2>&1
    echo "Diagnostics saved to $LOG (pane output before cleanup)." >&2
    "$SCRIPT_DIR/teardown.sh" "$AGENT_ID" >&2
    exit 5
fi

cat "$STATE_DIR/${AGENT_ID}.env"
echo "self_setup: OK. Human can observe via: vncviewer localhost:$VNC_PORT" >&2
exit 0
