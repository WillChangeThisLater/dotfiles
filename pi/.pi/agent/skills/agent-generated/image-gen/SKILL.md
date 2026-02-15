---
name: image-gen
description: Generate images with the local FLUX.2 [klein] 4B checkpoint via tmux + uv tooling.
---

# Image Generation (FLUX.2 [klein] local workflow)

Use this skill whenever you need to produce a fresh image from a text prompt using the local FLUX.2 [klein] 4B model that now lives under `~/models/flux2-klein-4b`. The workflow relies on the existing `image-gen` tmux session and the Python environment at `~/.venvs/image-gen` (PyTorch 2.6 + diffusers `main`).

## Prerequisites
1. **Model & env in place**
   - Check that `~/models/flux2-klein-4b/` exists (populated via `snapshot_download`).
   - Ensure `~/.venvs/image-gen/bin/python` exists (created with `uv venv`).
2. **VRAM headroom**
   - _Before every run_ execute `nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits`.
   - Require **≥ 14 000 MB free** on the target GPU. If the value is lower, stop immediately, note the shortage in your update, and **refuse to run** the model.
3. **tmux discipline**
   - All commands happen inside the dedicated session: `tmux attach -t image-gen` (create it if missing).

## Standard Workflow
1. Attach to the `image-gen` tmux session (`tmux attach -t image-gen`).
2. Run `nvidia-smi` as described above. If free memory < 14 GB, report the issue instead of proceeding.
3. Invoke the helper script with your prompt (and optional output path):
   ```bash
   ~/.pi/agent/skills/agent-generated/image-gen/scripts/run_flux2_klein.sh "<prompt>" [/path/to/output.png|/path/to/dir]
   ```
   - When the second argument is omitted, the script now saves into `~/models/flux2-klein-4b/outputs/flux2_klein_<timestamp>.png`.
   - If you pass a directory, the script drops a timestamped file inside it. Passing a file path writes exactly there (directories are created as needed).
4. Wait for completion (each render takes ~4–6 s thanks to CPU offload). The script will print the final path you can share with the user.
5. Mention the saved file path and seed/context in your final response.

## Script Behavior
- **Path**: `scripts/run_flux2_klein.sh` (see README in the same folder).
- **What it does**:
  1. Verifies `nvidia-smi` is available and that at least 14 GB VRAM is free.
  2. Checks for the venv and model directories.
  3. Runs a Python snippet (via `~/.venvs/image-gen/bin/python`) that:
     - Loads `Flux2KleinPipeline` in `torch.bfloat16`.
     - Enables `pipe.enable_model_cpu_offload()` to keep VRAM usage within the 16 GB RTX 4080 budget.
     - Generates a 896×896 image with 4 inference steps, guidance scale 1.0, seeded deterministically per run.
     - Saves to the requested location and prints the final path.

## Customization Notes
- If you need different resolutions or guidance, edit the script locally and document the change in this skill before committing.
- Keep prompts explicit about "tmux" or other requirements so the model reinforces those visual cues.
- For batch runs, call the script multiple times rather than modifying it to loop—this keeps logs clean in tmux.

## Troubleshooting
- **VRAM errors**: If the script errors with CUDA OOM despite passing the memory check, re-run `nvidia-smi` to confirm no other jobs started meanwhile. You may also export `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` before rerunning.
- **Missing model/env**: Re-run the setup steps documented earlier in this session (`uv venv ~/.venvs/image-gen`, `snapshot_download` to `~/models/flux2-klein-4b`).

## Files
- `scripts/run_flux2_klein.sh` – entrypoint script for generation.
- `scripts/README.md` – summary + contribution notes for helper scripts.

## Provenance
Created on 2026‑02‑06 after hands-on work wiring FLUX.2 [klein] 4B into the `image-gen` tmux session with uv-managed environments, per user request to share this workflow with future agents.
