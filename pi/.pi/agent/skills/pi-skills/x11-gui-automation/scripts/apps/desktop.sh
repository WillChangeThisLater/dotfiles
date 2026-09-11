#!/bin/bash
# desktop.sh — launch a window-manager desktop session on an agent's claimed X11 env
#
# Purpose: turns a bare Xvfb display into a real desktop (openbox WM) so apps that
# spawn multiple windows/dialogs (Steam, installers, file managers) are usable and
# automatable. The WM is the display's "app"; launch other programs into the same
# display via `x11_env.sh run <agent> <app> <cmd...>`.
#
# Usage:   desktop.sh <agent> [app]     (app defaults to "desktop")
# Exit:    0 ok | 1 no env | 3 WM failed to start | 4 already launched
# Deps:    x11_env.sh, tmux, openbox, xprop, x11_env's standard env hygiene
#
# After launch, automate apps inside the desktop:
#   x11_env.sh run <agent> <app> <program...>
# Interact pixel-first: scrot + xdotool (no CDP here — this is for non-browser
# apps). Verify every click with a screenshot + pixel diff (see SKILL.md
# "Clicking discipline"). Observe via the env's vncviewer port.

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="$SCRIPT_DIR/x11_env.sh"

agent="${1:-}"; app="${2:-}"
[[ -n "$agent" ]] || { echo "usage: desktop.sh <agent> [app]" >&2; exit 1; }

# If no app name given, auto-detect: exactly one claimed env for this agent -> use it.
if [[ -z "$app" ]]; then
    shopt -s nullglob
    envs=(/tmp/x11-env/$agent/*.env)
    shopt -u nullglob
    if (( ${#envs[@]} == 1 )); then
        app=$(basename "${envs[0]}" .env)
    else
        echo "ERROR: no app given and agent $agent has ${#envs[@]} claimed envs ($(basename -a "${envs[@]}" 2>/dev/null | sed 's/\.env//' | tr '\n' ' '))." >&2
        echo "Pass the claimed app name: desktop.sh <agent> <app>" >&2
        exit 1
    fi
fi

SF="/tmp/x11-env/$agent/$app.env"
[[ -f "$SF" ]] || { echo "ERROR: no env for $agent/$app — run: x11_env.sh claim $agent $app" >&2; exit 1; }
source "$SF"

if grep -q '^WM_PANE=' "$SF"; then
    echo "ERROR: desktop already launched for $agent/$app (WM_PANE=$(grep '^WM_PANE=' "$SF" | cut -d= -f2))." >&2
    echo "Release first: x11_env.sh release $agent $app" >&2
    exit 4
fi

pane=$("$ENV" run "$agent" "$app" openbox) \
    || { echo "ERROR: could not create WM pane" >&2; exit 3; }

# Health check: openbox registers itself as the root window's supporting WM.
# (openbox has no windows of its own, so window-search checks don't apply.)
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if DISPLAY=":$DISPLAY_NUM" timeout 2 xprop -root -notype _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -q 'window id'; then
        ok=1; break
    fi
    sleep 1
done
if (( ! ok )); then
    echo "ERROR: openbox did not come up on :$DISPLAY_NUM. Pane output:" >&2
    tmux capture-pane -t "$pane" -p 2>/dev/null | tail -20 >&2
    exit 3
fi

{
    echo "WM_PANE=$pane"
    echo "WM=openbox"
} >> "$SF"

echo "desktop: OK for $agent/$app — openbox on :$DISPLAY_NUM"
echo "launch apps: x11_env.sh run $agent $app <program...>"
echo "automate: scrot + xdotool on DISPLAY=:$DISPLAY_NUM; verify every click (screenshot + pixel diff)"
echo "observe: vncviewer localhost:$VNC_PORT"
exit 0
