#!/usr/bin/env bash
# find-agent-candidates.sh — scan the last N days of pi session logs for user
# tasks where the 'agent' skill (headless delegation) would have been useful.
#
# Usage: find-agent-candidates.sh [days] [outdir]   (defaults: 30, /tmp/agent-candidates)
#
# Stage 1: extract real user-typed messages from session jsonl as NDJSON events
#          (toolResults are a separate role, so role=="user" text = paul's words).
# Stage 2: jev_select  — keep messages where a headless-agent handoff fits.
# Stage 3: jev_classify — bucket survivors by handoff type.
#
# Both jev stages run --fail-closed (exit 6 on provider failure, never silent
# empty results). One jev call per event, parallel via --llm-concurrency.

set -euo pipefail

DAYS="${1:-30}"
OUT="${2:-/tmp/agent-candidates}"
SINCE=$(date -d "-$DAYS days" +%Y-%m-%d)
CONC="${JQLM_CONCURRENCY:-10}"
mkdir -p "$OUT"

# ---- Stage 1: extract user prompts as events ----
mapfile -t SESSIONS < <(find ~/.pi/agent/sessions -maxdepth 2 -name '*.jsonl' \
  -newermt "$SINCE" -size +1k | grep -v 'tmp-pi-runtime')
echo "Sessions in window: ${#SESSIONS[@]}"

: > "$OUT/events.ndjson"
for f in "${SESSIONS[@]}"; do
  jq -c --arg file "$f" '
    select(.type=="message" and .message.role=="user")
    | [.message.content[]? | select(.type=="text") | .text] | join("\n")
    | select(length >= 20 and length < 20000)
    | {file: $file, ts: .timestamp, msg: .[0:2500]}' "$f" \
    >> "$OUT/events.ndjson" 2>/dev/null || true
done
echo "Candidate user messages: $(wc -l < "$OUT/events.ndjson")"

# ---- Stage 2: jev_select — would a headless-agent handoff have been a good fit? ----
KEEP_PROMPT='You are judging one user message from a coding-agent session. Decide: would handing THIS task off to a headless subagent have been the right call? Say yes only if the work of finding out is much bigger than the answer — trawling many logs/files for a pattern, a broad codebase search of unknown size, or summarizing a large file/log/diff/dir. Say no for: quick lookups answerable with one grep or ls, tasks where the raw content is needed in-context for follow-up work, edits/writes/state mutation, discussion, questions, greetings, or task instructions about the agent harness itself.'

# ---- Stage 3: jev_classify — what kind of handoff ----
CLASSIFY_PROMPT='What kind of task is this, from the perspective of handing it to a headless subagent?'
TYPES=(
  'log-trawl|search across many session logs or many files for a pattern; answer is small'
  'big-artifact|summarize or extract from one large file, log, diff, or directory'
  'broad-search|codebase-wide search of unknown size (where is X handled)'
  'investigation|throwaway multi-step investigation, many tool calls, detail discarded after'
)

# Stage 2: keep, then Stage 3: classify survivors (note: classification runs
# sequentially over survivors to keep the pipeline simple; survivors are few).
jq -c '.' "$OUT/events.ndjson" \
  | jqlm --fail-closed --llm-concurrency "$CONC" \
      'select(jev_select(.msg; "'"$KEEP_PROMPT"'"))' \
  > "$OUT/kept.ndjson"
echo "Kept by stage 2: $(wc -l < "$OUT/kept.ndjson")"

# Options must be ONE array argument (gojq fires one call per arg combination).
TYPES_JSON=$(printf '%s\n' "${TYPES[@]}" | jq -R . | jq -s -c .)

jq -c '.' "$OUT/kept.ndjson" \
  | jqlm --fail-closed --llm-concurrency "$CONC" \
      '. + {kind: jev_classify(.msg; "'"$CLASSIFY_PROMPT"'"; '"$TYPES_JSON"') }' \
  > "$OUT/classified.ndjson"

echo
echo "=== Summary by kind ==="
jq -s -r 'group_by(.kind // "UNCLASSIFIED") | .[] | "\(length)\t\(.[0].kind // "UNCLASSIFIED")"' \
  "$OUT/classified.ndjson"
echo
echo "Full results: $OUT/classified.ndjson"
echo "Human-readable:"
jq -r '"[" + (.kind // "?") + "] " + (.file | split("/") | last) + "\n  " + (.msg | .[0:300] | gsub("\n"; " ")) + "\n"' \
  "$OUT/classified.ndjson"
