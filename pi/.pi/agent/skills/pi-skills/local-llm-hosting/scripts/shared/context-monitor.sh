#!/usr/bin/env bash
# Purpose: Inspect current llama-server context settings + VRAM, then optionally sweep test context sizes.
# Usage: MODEL_PATH=~/models/... CTX_SIZES="8192 16384" ./context-monitor.sh
# Requirements: nvidia-smi, timeout, awk, ps, llama-server on PATH.
# Notes: Designed to run alongside the local-llm-hosting skill; results can be pasted into MODEL_LOG.md.
set -euo pipefail

MODEL_PATH=${MODEL_PATH:-"/home/paul/models/qwen3/Qwen3-Coder-30B-A3B-Instruct-UD-IQ3_XXS.gguf"}
CTX_SIZES=${CTX_SIZES:-"1024 4096 8192 16384 32768 65536"}
PORT_BASE=${PORT_BASE:-19000}
START_TIMEOUT=${START_TIMEOUT:-6}
RUN_SWEEP=${RUN_SWEEP:-1}

banner() {
  printf '\n=== %s ===\n' "$1"
}

current_llama_cmd() {
  ps -eo args | grep -m1 'llama-server' | grep -v grep || true
}

extract_ctx() {
  local cmd=$1
  if [[ -z "$cmd" ]]; then
    echo ""; return
  fi
  if [[ "$cmd" =~ --ctx-size[[:space:]]+([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

print_vram() {
  nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits |
    awk -F',' 'NR==1 {printf "GPU VRAM Used: %s MiB / %s MiB\n", $1, $2}'
}

quick_test() {
  local size=$1
  local port=$((PORT_BASE + size % 1000))
  timeout ${START_TIMEOUT} \
    llama-server -m "${MODEL_PATH}" --ctx-size "${size}" --threads 2 --temp 0.1 --port "${port}" --host 127.0.0.1 \
      >/tmp/context-monitor.log 2>&1 &
  local pid=$!
  sleep 2
  if ps -p ${pid} >/dev/null 2>&1; then
    local mem
    mem=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1)
    printf "  ✓ %6s tokens | VRAM %s MiB\n" "${size}" "${mem}"
    kill ${pid} >/dev/null 2>&1 || true
    wait ${pid} >/dev/null 2>&1 || true
    return 0
  else
    printf "  ✗ %6s tokens | failed to start (see /tmp/context-monitor.log)\n" "${size}"
    return 1
  fi
}

banner "Current llama-server status"
CMD=$(current_llama_cmd)
if [[ -n "$CMD" ]]; then
  echo "Command: $CMD"
  CTX=$(extract_ctx "$CMD")
  if [[ -n "$CTX" ]]; then
    echo "Detected context window: ${CTX} tokens"
    if (( CTX > 65536 )); then
      echo "Warning: context exceeds 65,536; ensure GPU has enough headroom."
    elif (( CTX > 32768 )); then
      echo "Notice: large context (>32K); monitor VRAM closely."
    fi
  fi
else
  echo "No running llama-server detected."
fi
print_vram

if (( RUN_SWEEP )); then
  banner "Quick context sweep (MODEL_PATH=${MODEL_PATH})"
  for size in ${CTX_SIZES}; do
    quick_test "${size}" || break
  done
fi

echo "\nDone. Record successful sizes + VRAM in MODEL_LOG.md as needed."
