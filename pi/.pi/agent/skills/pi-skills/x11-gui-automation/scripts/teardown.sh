#!/bin/bash
# teardown.sh — remove one agent's self_setup.sh environment
#
# Purpose: Kill the tmux window and state file created by self_setup.sh for one
# agent id. Leaves other agents' windows and the 'env-setup' session intact.
#
# Usage:   teardown.sh <agent-id>
# Exit:    0 if cleanup happened or nothing was found; nonzero only on tmux errors.
# Deps:    tmux
# Workdir: anywhere.

set -u

AGENT_ID="${1:-}"
if [[ -z "$AGENT_ID" ]]; then
    echo "ERROR: usage: teardown.sh <agent-id>" >&2
    exit 1
fi

SESSION="env-setup"
WINDOW="env-${AGENT_ID}"
STATE_FILE="/tmp/x11-env/${AGENT_ID}.env"

# Source state file so we also clean the chrome profile dir it created
if [[ -f "$STATE_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$STATE_FILE"
    CHROME_PORT="${CHROME_PORT:-}"
fi

tmux kill-window -t "$SESSION:$WINDOW" 2>/dev/null \
    && echo "teardown: killed window $SESSION:$WINDOW" \
    || echo "teardown: no window $SESSION:$WINDOW found (already gone?)"

# kill the Xvfb process for this display (it can outlive its tmux pane)
if [[ -n "${DISPLAY_NUM:-}" ]]; then
    if pkill -f "Xvfb :${DISPLAY_NUM} " 2>/dev/null; then
        echo "teardown: killed Xvfb :${DISPLAY_NUM}"
        rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}" 2>/dev/null
    fi
fi

# remove the chrome profile dir for this env (best effort)
if [[ -n "${CHROME_PORT:-}" && -d "/tmp/chrome-${CHROME_PORT}-profile" ]]; then
    rm -rf "/tmp/chrome-${CHROME_PORT}-profile"
    echo "teardown: removed chrome profile /tmp/chrome-${CHROME_PORT}-profile"
fi

if [[ -f "$STATE_FILE" ]]; then
    rm -f "$STATE_FILE"
    echo "teardown: removed $STATE_FILE"
else
    echo "teardown: no state file found for '$AGENT_ID'"
fi

# If the session has no windows left, kill the session too so it doesn't linger
if tmux has-session -t "$SESSION" 2>/dev/null; then
    if [[ "$(tmux list-windows -t "$SESSION" | wc -l)" -le 1 ]]; then
        tmux kill-session -t "$SESSION" 2>/dev/null && echo "teardown: session '$SESSION' is now empty — killed it"
    fi
fi

exit 0
