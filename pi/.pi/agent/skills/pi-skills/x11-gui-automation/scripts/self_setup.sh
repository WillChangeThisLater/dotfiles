#!/bin/bash
# self_setup.sh — BACKWARD-COMPAT WRAPPER (chrome-flavored env in one command)
#
# Kept while agents/prompts migrate to the generic flow:
#   x11_env.sh claim <agent> chrome   &&   apps/chrome.sh <agent> chrome
# This wrapper does exactly that. Delete once nothing references it.
#
# Usage: self_setup.sh <agent-id> [app]     (app defaults to 'chrome')

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

agent="${1:-}"
[[ -n "$agent" ]] || { echo "usage: self_setup.sh <agent-id> [app]" >&2; exit 1; }
app="${2:-chrome}"

"$SCRIPT_DIR/x11_env.sh" claim "$agent" "$app" || exit $?
"$SCRIPT_DIR/apps/chrome.sh" "$agent" "$app"
