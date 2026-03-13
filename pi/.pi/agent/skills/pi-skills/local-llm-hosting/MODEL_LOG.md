# Local llama-server Model Log

Track experiments and operational notes for models we host via `llama-server`. Each entry captures enough detail to reproduce or build on prior runs.

| Date (UTC) | Model / Quant | File | Size | Context Tested | VRAM (steady) | Throughput | Notes |
|-----------|---------------|------|------|----------------|---------------|------------|-------|
| 2026-02-06 | Qwen3-Coder-30B-A3B Instruct (UD-IQ3_XXS) | `~/models/qwen3/Qwen3-Coder-30B-A3B-Instruct-UD-IQ3_XXS.gguf` | ~12 GB | 65,536 tokens (model supports 128K) | ~15 GB on RTX 4080 SUPER | ~88 tok/s generation | Used by Pi for coding; Pi also generated/ran a test script that exercised the model up to the effective context limit (65K) without degradation. |

## Command Snippets

### Qwen3-Coder-30B-A3B Instruct (UD-IQ3_XXS)
```bash
MODEL_PATH="~/models/qwen3/Qwen3-Coder-30B-A3B-Instruct-UD-IQ3_XXS.gguf"
PORT=8080
CTX=65536
llama-server -m ${MODEL_PATH} \
  --ctx-size ${CTX} \
  --n-gpu-layers 999 \
  --threads 16 \
  --port ${PORT} \
  --host 127.0.0.1
```
- Run inside the `llama-server` tmux session via `tmux send-keys` so monitoring stays attached.
- Effective ctx tested at 65,536 tokens; model supports up to 128K if VRAM allows.
- Observed steady VRAM ~15 GB on RTX 4080 SUPER with ~88 tok/s generation throughput.
- Performance script: [`scripts/qwen3-coder-30b/measure-model-health.sh`](scripts/qwen3-coder-30b/measure-model-health.sh) captures tokens/sec + context probes.
- Capacity sweeps: [`scripts/qwen3-coder-30b/context-sweep.sh`](scripts/qwen3-coder-30b/context-sweep.sh) + [`scripts/qwen3-coder-30b/overflow-check.sh`](scripts/qwen3-coder-30b/overflow-check.sh).
- Runtime telemetry: [`scripts/shared/context-monitor.sh`](scripts/shared/context-monitor.sh).

## Scratchpad / Lessons

- Let Pi author and execute validation scripts when standing up a new model. It consistently produced a stress-test harness that pushed Qwen3’s context window until the KV cache limit, saving manual effort.
