#!/bin/bash
# kitty.sh — launch kitty terminal against an agent's claimed X11 environment
#
# Purpose: app-specific launcher for kitty on a dedicated display. Useful for
# debugging rendering (e.g. image protocol draws): launch, run `kitten icat`,
# screenshot the display, and the agent can SEE what rendered.
#
# Usage:   kitty.sh <agent> [app]      (app defaults to 'kitty')
# Exit:    0 ok | 1 no env | 3 kitty failed to start | 4 already launched
# Deps:    x11_env.sh, tmux, kitty, scrot

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="$SCRIPT_DIR/x11_env.sh"

agent="${1:-}"; app="${2:-kitty}"
[[ -n "$agent" ]] || { echo "usage: kitty.sh <agent> [app]" >&2; exit 1; }

SF="/tmp/x11-env/$agent/$app.env"
[[ -f "$SF" ]] || { echo "ERROR: no env for $agent/$app — run: x11_env.sh claim $agent $app" >&2; exit 1; }
source "$SF"

if grep -q '^KITTY_PANE=' "$SF"; then
    echo "ERROR: kitty already launched for $agent/$app. Release first: x11_env.sh release $agent $app" >&2
    exit 4
fi

pane=$("$ENV" run "$agent" "$app" "kitty -o linux_display_server=x11") \
    || { echo "ERROR: could not create kitty window" >&2; exit 3; }

sleep 3
# run returns a window id; kitty must still be alive in it (pane_dead=0 means
# the pane's command hasn't exited — if kitty crashed we'd see pane_dead=1)
if tmux list-panes -t "$pane" -F '#{pane_dead}' 2>/dev/null | grep -qv '^0$'; then
    echo "ERROR: kitty exited immediately. Window output:" >&2
    tmux capture-pane -t "$pane" -p 2>/dev/null | tail -20 >&2
    exit 3
fi

echo "KITTY_WINDOW=$pane" >> "$SF"

echo "kitty: OK for $agent/$app — running on display :$DISPLAY_NUM"
echo "verify rendering: DISPLAY=:$DISPLAY_NUM scrot -o /tmp/kitty-check.png then view it (kitty graphics: kitten icat <img> inside the terminal)"
echo "observe: vncviewer localhost:$VNC_PORT"
exit 0
