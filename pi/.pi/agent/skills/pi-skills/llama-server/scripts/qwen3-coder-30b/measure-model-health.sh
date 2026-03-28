#!/usr/bin/env bash
# Purpose: Measure health + throughput + effective context window for Qwen3-Coder-30B llama-server runs.
# Usage: LLAMA_HOST=127.0.0.1 LLAMA_PORT=8080 ./measure-model-health.sh
# Requirements: curl, jq, python3 (for generating long prompts)
# Notes: Run this from any directory; script stores temporary payloads under /tmp.
set -euo pipefail

HOST=${LLAMA_HOST:-127.0.0.1}
PORT=${LLAMA_PORT:-8080}
MODEL=${LLAMA_MODEL:-local}
TMP_PAYLOAD=$(mktemp)
cleanup() { rm -f "$TMP_PAYLOAD"; }
trap cleanup EXIT

banner() {
  printf '\n=== %s ===\n' "$1"
}

call_api() {
  local payload=$1
  curl -sS -H 'Content-Type: application/json' \
    -X POST "http://${HOST}:${PORT}/v1/chat/completions" \
    -d @"${payload}"
}

banner "Health check"
if curl -fsS "http://${HOST}:${PORT}/health" >/dev/null; then
  echo "llama-server at ${HOST}:${PORT} responded to /health"
else
  echo "[ERROR] /health endpoint failed" >&2
  exit 1
fi

banner "Throughput sample"
cat >"${TMP_PAYLOAD}" <<'JSON'
{
  "model": "MODEL_REPLACE",
  "temperature": 0.2,
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Generate a concise technical summary of the llama.cpp project, focusing on GPU execution, quantization options, batching behaviour, and API compatibility. Finish with a short bullet list of tuning tips."
    }
  ]
}
JSON
perl -0pi -e "s/MODEL_REPLACE/${MODEL}/" "${TMP_PAYLOAD}"
START_NS=$(date +%s%N)
RESPONSE=$(call_api "${TMP_PAYLOAD}")
END_NS=$(date +%s%N)
DURATION_S=$(python3 - <<'PY'
import sys
start=int(sys.argv[1])
end=int(sys.argv[2])
print((end-start)/1e9)
PY "$START_NS" "$END_NS")
COMPLETION_TOKENS=$(echo "$RESPONSE" | jq '.usage.completion_tokens // 0')
if [ "$COMPLETION_TOKENS" -gt 0 ]; then
  TPS=$(python3 - <<'PY'
import sys
comp=float(sys.argv[1])
dur=float(sys.argv[2])
print(f"{comp/dur:.2f}")
PY "$COMPLETION_TOKENS" "$DURATION_S")
else
  TPS="n/a"
fi
echo "Completion tokens: ${COMPLETION_TOKENS}"
echo "Duration (s): ${DURATION_S}"
echo "Throughput (tokens/sec): ${TPS}"

banner "Context probe"
TARGET_TOKENS=${TARGET_TOKENS:-65000}
python3 - <<'PY' "$TARGET_TOKENS" >"${TMP_PAYLOAD}.ctx"
import sys, json
n=int(sys.argv[1])
chunk="Explain how to implement a ring buffer in C, include code, tests, edge cases. "
repeats=max(1, n // len(chunk))
content=(chunk * repeats)[:n]
data={
  "model": "MODEL_PLACEHOLDER",
  "temperature": 0,
  "max_tokens": 16,
  "messages": [
    {"role": "user", "content": content},
    {"role": "user", "content": "Confirm reception by replying with the total characters received."}
  ]
}
print(json.dumps(data))
PY
perl -0pi -e "s/MODEL_PLACEHOLDER/${MODEL}/" "${TMP_PAYLOAD}.ctx"
if RESPONSE_CTX=$(call_api "${TMP_PAYLOAD}.ctx" 2>/tmp/ctx.err); then
  echo "Context probe succeeded; snippet:"
  echo "$RESPONSE_CTX" | jq '.choices[0].message.content' | head -n 5
else
  echo "[WARN] Context probe failed:" >&2
  cat /tmp/ctx.err >&2
fi
rm -f "${TMP_PAYLOAD}.ctx"

echo "\nSummary:"
echo "- Host: ${HOST}:${PORT}"
echo "- Model: ${MODEL}"
echo "- Throughput tokens/sec: ${TPS}"
echo "- Context probe target chars: ${TARGET_TOKENS}"
