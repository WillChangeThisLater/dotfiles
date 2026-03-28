#!/usr/bin/env bash
# Purpose: Systematically benchmark Qwen3-Coder-30B context sizes for llama-server startup viability.
# Usage: ./context-sweep.sh 1024 4096 8192 ... (defaults provided if no args)
# Requirements: llama-server on PATH, nvidia-smi, timeout.
# Output: Table of context size -> success/failure + VRAM snapshot.
set -euo pipefail

MODEL_PATH=${MODEL_PATH:-"/home/paul/models/qwen3/Qwen3-Coder-30B-A3B-Instruct-UD-IQ3_XXS.gguf"}
PORT_BASE=${PORT_BASE:-20010}
SLEEP_SECS=${SLEEP_SECS:-3}
TIMEOUT_SECS=${TIMEOUT_SECS:-8}
SIZES=($@)
if [ ${#SIZES[@]} -eq 0 ]; then
  SIZES=(1024 2048 4096 8192 16384 32768 49152 65536)
fi

printf "Running context sweep against %s\n" "$MODEL_PATH"
printf "%-10s | %-8s | %-12s\n" "ctx" "status" "vram_used"
printf "-----------+----------+-------------\n"

run_size() {
  local size=$1
  local port=$((PORT_BASE + size % 997))
  timeout ${TIMEOUT_SECS} \
    llama-server -m "${MODEL_PATH}" --ctx-size "${size}" --threads 2 --temp 0.05 \
      --port "${port}" --host 127.0.0.1 --n-gpu-layers 999 \
      >/tmp/context-sweep.log 2>&1 &
  local pid=$!
  sleep ${SLEEP_SECS}
  if ps -p ${pid} >/dev/null 2>&1; then
    local mem
    mem=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1)
    printf "%-10s | %-8s | %-12s\n" "${size}" "OK" "${mem} MiB"
    kill ${pid} >/dev/null 2>&1 || true
    wait ${pid} >/dev/null 2>&1 || true
    return 0
  else
    printf "%-10s | %-8s | %-12s\n" "${size}" "FAIL" "-"
    if [[ -s /tmp/context-sweep.log ]]; then
      echo "  > see /tmp/context-sweep.log for failure details"
    fi
    return 1
  fi
}

for size in "${SIZES[@]}"; do
  run_size "$size" || break
  sleep 1
done

echo "\nContext sweep complete."
