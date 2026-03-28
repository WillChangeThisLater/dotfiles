#!/usr/bin/env bash
# Purpose: Observe llama-server behavior when requesting contexts beyond safe VRAM limits.
# Usage: ./overflow-check.sh 70000 80000 (defaults to 70000 80000)
# Requirements: llama-server, timeout, nvidia-smi. Run when main server is stopped or on a different port range.
set -euo pipefail

MODEL_PATH=${MODEL_PATH:-"/home/paul/models/qwen3/Qwen3-Coder-30B-A3B-Instruct-UD-IQ3_XXS.gguf"}
PORT_BASE=${PORT_BASE:-21000}
TIMEOUT_SECS=${TIMEOUT_SECS:-12}
SIZES=("${@}")
if [ ${#SIZES[@]} -eq 0 ]; then
  SIZES=(70000 80000)
fi

printf "Testing overflow contexts against %s\n" "$MODEL_PATH"
printf "Total VRAM: %s MiB\n" "$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)"

for size in "${SIZES[@]}"; do
  echo "\nAttempting ctx ${size}"
  port=$((PORT_BASE + size % 991))
  set +e
  timeout ${TIMEOUT_SECS} llama-server -m "${MODEL_PATH}" --ctx-size "${size}" \
    --threads 2 --temp 0.05 --port "${port}" --host 127.0.0.1 --n-gpu-layers 999 \
    >/tmp/overflow-check.log 2>&1 &
  pid=$!
  sleep 4
  if ps -p ${pid} >/dev/null 2>&1; then
    mem=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1)
    echo "  ✓ started (VRAM ${mem} MiB). Killing to avoid crash."
    kill ${pid} >/dev/null 2>&1 || true
    wait ${pid} >/dev/null 2>&1 || true
  else
    echo "  ✗ failed to start (likely OOM); see /tmp/overflow-check.log"
  fi
  set -e
  sleep 1
done

echo "\nOverflow check finished."
