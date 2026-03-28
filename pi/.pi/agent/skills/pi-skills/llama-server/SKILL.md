---
name: local-llm-hosting
description: Spin up, verify, monitor, and tear down local llama.cpp `llama-server` instances (model sizing, tmux layout, test prompts, shutdown hygiene).
---

# Local LLM Hosting (llama-server)

Use this skill when you need to run a local model with llama.cpp’s `llama-server`, whether for experimentation, offline work, or to back CLI tools (e.g., `llm -m llama-server`). The focus is on safe model selection, GPU fit checks, reproducible tmux sessions, health tests, and graceful shutdowns. Detailed outcomes for each hosted model are tracked in [`MODEL_LOG.md`](MODEL_LOG.md).

## Requirements
- `llama.cpp` built with CUDA/cuBLAS so `llama-server` is on `$PATH`.
- Sufficient disk + VRAM for downloaded GGUF models.
- Access to `nvidia-smi`, `tmux`, `curl`, `huggingface-cli` (or equivalent API tooling).
- Network access to Hugging Face for model pulls (unless the model is already cached).

## Helper Scripts
- Skill-specific automation lives under [`scripts/`](scripts/README.md). Each model or scenario has its own subdirectory (e.g., `scripts/qwen3-coder-30b/`).
- Reference these scripts when running health checks, context sweeps, or GPU setup; link any new scripts back into `MODEL_LOG.md` so future agents can reuse them.

## Workflow Overview
1. **Gather request + constraints** (model family, target quantization, context window needs, max VRAM).
2. **Inspect current GPU resources** with `nvidia-smi` (total VRAM, free VRAM) and running processes.
3. **Map request to available GGUFs** via Hugging Face (model search + file list). Filter to quantizations that fit VRAM.
4. **Present options** (e.g., 4-bit vs 8-bit) with trade-offs (quality, VRAM, throughput) and get user sign-off.
5. **Prep the tmux session (`llama-server`)** with two panes: server + monitoring.
6. **Verify port availability** (default 8080). If busy, ask user how to proceed (choose new port or stop existing service).
7. **Launch `llama-server`** with explicit arguments (model path or `-hf owner/model`, threads, context).
8. **Run smoke tests** (curl chat completion) to confirm responses.
9. **Monitor health** (VRAM, logs, latency) and document anything notable.
10. **Shut down** cleanly when done (Ctrl+C server pane, close session, optionally delete temp models).

## Detailed Steps

### 1. Inspect GPU + System State
```bash
nvidia-smi
nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv
lsof -i :8080   # default llama-server port
```
- Note other heavy GPU jobs. Never evict them without user approval.
- Record usable VRAM = total - used - safety margin (~1–2 GB).

### 2. Discover Suitable GGUFs
Use Hugging Face search (without installing anything globally) via `uvx hf`:
```bash
uvx hf models ls --search "qwen3 gguf" --limit 5
uvx hf download owner/model "*Q4_K_M*.gguf" --local-dir ~/models/qwen3 --dry-run
```
- Look for GGUF files with quant suffixes (Q4_K_M, Q5_K_M, Q8_0, FP16, etc.).
- Estimate footprint (GGUF size ≈ RAM requirement). Compare against usable VRAM.
- When multiple quantizations fit, compile a small table for the user:
  | File | Size | Est. VRAM | Notes |
  |------|------|-----------|-------|
- Explain trade-offs (lower quant = faster/lower memory but less accuracy).

### 3. Confirm Plan with User
- Share recommended option(s) + reasoning.
- Wait for explicit approval before downloading or launching.

### 4. Prepare tmux Session
Always use a dedicated session named `llama-server` to avoid conflicts.
```bash
tmux new-session -d -s llama-server
# Pane 0: server (default)
tmux send-keys -t llama-server "cd ~/models" C-m  # adjust path as needed
# Pane 1: monitoring
tmux split-window -h -t llama-server
```
Suggested monitoring commands (right pane):
```bash
watch -n 5 nvidia-smi
# or
htop
```
Keep this pane free for quick diagnostics (checking logs, running `curl`, etc.).

### 5. Launch `llama-server`
Default port is 8080; change with `-p <port>` if needed.
```bash
MODEL="qwen/Qwen2.5-7B-Instruct-GGUF"
FILE="Q4_K_M.gguf"
PORT=8080
CMD="llama-server -hf ${MODEL} --model ${FILE} --port ${PORT} --ctx-size 8192 --gpu-layers 999"

tmux send-keys -t llama-server:0 "$CMD" C-m
```
Notes:
- `-hf owner/model` auto-downloads via Hugging Face Hub (honors HF_TOKEN). Alternatively use a local `--model /path/to/model.gguf`.
- Tune `--ctx-size`, `--batch-size`, `--threads`, `--n-gpu-layers` per GPU capabilities.
- If port is in use, pause and ask the user whether to stop the existing service or select a new port.

### 6. Verify Serving Endpoint
Once logs show “listening on http://0.0.0.0:PORT”, run a smoke test from the monitoring pane or another shell:
```bash
curl http://127.0.0.1:${PORT}/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
        "model": "local",
        "messages": [
          {"role": "user", "content": "Say hello in one sentence."}
        ]
      }'
```
- Expect JSON with a `choices[0].message.content`. Any errors? note them and troubleshoot (check logs, GPU usage, missing models).
- Optionally, exercise `llm -m llama-server "hi"` if the CLI is wired to that endpoint.

### 7. Monitoring & Operations
- Keep the monitoring pane running `watch nvidia-smi` to catch spikes.
- Use `tail -f` on logs (if stdout redirected) or rely on server pane output.
- Document key metrics (VRAM steady state, tokens/sec) for later reference.
- If performance degrades, consider reducing `--ctx-size`, `--batch-size`, or switching quantization.

### 8. Spindown Procedure
1. Send `Ctrl+C` in the server pane (`tmux send-keys -t llama-server:0 C-c`).
2. Confirm the process exits cleanly.
3. Stop monitoring command if still running (`q` for `watch`, `htop`).
4. Kill the tmux session:
   ```bash
   tmux kill-session -t llama-server
   ```
5. Optionally remove temporary model files if space is needed (get user confirmation first).

## Guardrails
- **Never** start a model that exceeds available VRAM. If uncertain, ask the user to confirm a smaller quantization or a GPU upgrade plan.
- **Ports:** detect conflicts before launching. If port 8080 (or chosen port) is busy, consult the user.
- **Downloads:** large GGUFs can be tens of GB—warn the user before fetching.
- **tmux naming:** always use `llama-server` to avoid clobbering other workflows. If the session already exists, coordinate with the user (attach vs. recycle).
- **Testing:** do not consider the deployment complete until a test prompt succeeds.

### Tip: dry-run Hugging Face downloads with uvx
- Before pulling large GGUFs, preview what files exist using `uvx hf download --dry-run` to avoid accidental big downloads and to verify auxiliary files (e.g., multimodal projection files like `mmproj.bin`, tokenizer files, or configs).
- Examples:
  - Check for mmproj files:
    uvx hf download <repo-id> --dry-run --include "*mmproj*"
  - Check for other auxiliary files without fetching GGUFs:
    uvx hf download <repo-id> --dry-run --include "*.bin" --include "config.json" --include "tokenizer*"
  - List candidate repos first if unsure of exact repo id:
    uvx hf models ls --search "qwen3" --limit 50
- Notes:
  - Dry-run will fail for private/gated repos unless authenticated; use `uvx hf auth login` or `--token` when needed.
  - This matches the uvx/HF workflow used elsewhere in this skill and saves time and bandwidth.

## Learned Lessons
- Keep a table of known-good quantizations per GPU (e.g., 24 GB = 7B Q5, 13B Q4). Update this section when new measurements are taken.
- Store frequently used models locally to avoid repeated downloads; note their paths for future runs.
- Pair this skill with `llm` or other clients so that once the server is up, the rest of the tooling can consume it immediately.
