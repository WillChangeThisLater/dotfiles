#!/usr/bin/env bash
# notify-blocked.sh — ping the human on ntfy when you are genuinely BLOCKED.
#
# Purpose:   Send a push notification (ntfy) telling paul you need hands-on help
#            (sudo password, login, physical action, approval that can't wait).
#            NOT for "what should I do next" questions.
# Usage:     notify-blocked.sh -m "NEED: 1-2 sentence ask" [-n name] [-t session:window.pane] [-s summary]
#            -m  required: what you need (1-2 sentences max, start with what's blocking)
#            -n  optional: your agent name (default: messaging get-name, else hostname)
#            -t  optional: your tmux target (default: auto-detect via tmux context)
#            -s  optional: short title override
# Deps:      curl, jq, tmux (only if auto-detecting)
# Examples:
#            notify-blocked.sh -m "Sudo needed in pane 0:3.1 to install openjdk-21-jdk — please enter your password there."
#            notify-blocked.sh -m "Login page is open in the browser; need you to complete the 2FA step."
set -euo pipefail

TOPIC="paul-blocked-agents"
SERVER="https://ntfy.sh"
MSG=""
NAME=""
TARGET=""
TITLE=""

while getopts "m:n:t:s:" opt; do
  case "$opt" in
    m) MSG="$OPTARG" ;;
    n) NAME="$OPTARG" ;;
    t) TARGET="$OPTARG" ;;
    s) TITLE="$OPTARG" ;;
    *) echo "usage: $0 -m MESSAGE [-n name] [-t session:window.pane] [-s title]" >&2; exit 2 ;;
  esac
done

[ -z "$MSG" ] && { echo "error: -m MESSAGE is required" >&2; exit 2; }

# --- agent name ---
if [ -z "$NAME" ]; then
  SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  if [ -x "$SKILL_DIR/../../pi-skills/messaging/scripts/message.ts" ] && command -v bun >/dev/null 2>&1; then
    NAME=$(bun "$SKILL_DIR/../../pi-skills/messaging/scripts/message.ts" get-name 2>/dev/null | tail -1 | tr -d '[:space:]') || NAME=""
  fi
  # strip default machine names
  case "$NAME" in ""|paul-MS-7E16|"${HOSTNAME:-x}") NAME="${PI_SESSION_NAME:-}" ;; esac
  [ -z "$NAME" ] && NAME="agent-on-${HOSTNAME:-unknown}"
fi

# --- tmux location: MUST be full session:window.pane ---
if [ -z "$TARGET" ]; then
  if [ -n "${TMUX:-}" ]; then
    TARGET=$(tmux display-message -p '#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null) || TARGET=""
  fi
  [ -z "$TARGET" ] && TARGET="no-tmux"
fi

BODY="from: ${NAME}
at: tmux ${TARGET}

${MSG}"

TITLE="${TITLE:-BLOCKED: ${NAME}}"

curl -s -d "$BODY" \
  -H "Title: ${TITLE}" \
  -H "Tags: rotating_light" \
  -H "Priority: high" \
  "${SERVER}/${TOPIC}" | jq -r '"ntfy id: \(.id)"'
