#!/bin/bash
# teardown.sh — BACKWARD-COMPAT WRAPPER for `x11_env.sh release`
#
# Usage: teardown.sh <agent-id> [app]

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

agent="${1:-}"
[[ -n "$agent" ]] || { echo "usage: teardown.sh <agent-id> [app]" >&2; exit 1; }
exec "$SCRIPT_DIR/x11_env.sh" release "$@"
