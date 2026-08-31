#!/bin/bash
# fake-backend-counter.sh — deterministic stub backend for apps that invoke an
# external command (dictation/transcription/model CLIs). Prints a unique line
# per invocation so logs distinguish partial runs from final runs, and prove
# whether the backend was called at all.
# Usage: point the app's backend env var at this script, e.g.
#   PI_DICTATION_BACKEND=/path/to/fake-backend-counter.sh myapp
# Deps: bash. Call count persisted at /tmp/fake-backend-count (delete between runs).

count_file="/tmp/fake-backend-count"
n=$(cat "$count_file" 2>/dev/null || echo 0)
echo $((n + 1)) > "$count_file"
echo "dictated words number $((n + 1))"
