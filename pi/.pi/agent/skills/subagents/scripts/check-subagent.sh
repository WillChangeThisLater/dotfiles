#!/bin/bash
# check-subagent.sh — status check for a subagent window.
# Usage: check-subagent.sh <window-name>          e.g. check-subagent.sh 01a052e1-research
# Deps: tmux. Prints: alive/dead, last lines of the pane, report.md status.
set -euo pipefail

win="${1:?usage: check-subagent.sh <window-name>}"

if ! tmux list-windows -t subagents -F '#W' 2>/dev/null | grep -qx "$win"; then
	echo "status:   DEAD (window not found in subagents session)"
	cwd="/tmp/subagents/$win"
	if [[ -f "$cwd/report.md" ]]; then
		echo "note:     window is gone but report exists: $cwd/report.md"
	fi
	exit 0
fi

echo "status:   ALIVE"
echo "--- last 15 lines of pane ----------------------------------------"
tmux capture-pane -p -t "subagents:$win" | grep -v '^[[:space:]]*$' | tail -15
echo "------------------------------------------------------------------"

cwd="/tmp/subagents/$win"
if [[ -f "$cwd/report.md" ]]; then
	echo "report:   EXISTS ($cwd/report.md) — read it, then kill the window if the task is finished:"
	echo "          tmux kill-window -t subagents:$win"
else
	echo "report:   not written yet"
fi
