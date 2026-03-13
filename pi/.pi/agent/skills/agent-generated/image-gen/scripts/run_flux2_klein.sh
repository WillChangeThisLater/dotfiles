#!/usr/bin/env bash
# ---
# Purpose: Generate a single image with the local FLUX.2 [klein] 4B checkpoint via diffusers.
# Usage:   run_flux2_klein.sh "<prompt>" [</path/to/output.png | /path/to/dir/>]
# Dependencies: nvidia-smi, ~/.venvs/image-gen (PyTorch 2.6 + diffusers main), ~/models/flux2-klein-4b weights.
# Expected working directory: anywhere (paths resolved via $HOME).
# ---

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 \"<prompt>\" [</path/to/output.png | /path/to/dir/>]" >&2
  exit 1
fi

PROMPT="$1"
OUTPUT_ARG="${2:-}"
DEFAULT_OUTPUT_DIR="$HOME/models/flux2-klein-4b/outputs"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "nvidia-smi is required to verify free VRAM. Aborting." >&2
  exit 1
fi

FREE_MB=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits | head -n1 | tr -d '[:space:]')
if [[ -z "$FREE_MB" ]]; then
  echo "Unable to parse free memory from nvidia-smi." >&2
  exit 1
fi

if (( FREE_MB < 14000 )); then
  echo "Only ${FREE_MB}MB VRAM free. Need at least 14000MB before running FLUX.2 [klein]. Refusing to proceed." >&2
  exit 1
fi

PYTHON="$HOME/.venvs/image-gen/bin/python"
MODEL_DIR="$HOME/models/flux2-klein-4b"

if [[ ! -x "$PYTHON" ]]; then
  echo "Python environment not found at $PYTHON" >&2
  exit 1
fi

if [[ ! -d "$MODEL_DIR" ]]; then
  echo "Model directory not found at $MODEL_DIR" >&2
  exit 1
fi

export FLUX_PROMPT="$PROMPT"
export FLUX_OUTPUT_PATH="$OUTPUT_ARG"
export FLUX_MODEL_DIR="$MODEL_DIR"
export FLUX_DEFAULT_OUTPUT_DIR="$DEFAULT_OUTPUT_DIR"

"$PYTHON" <<'PY'
import os
from datetime import datetime
from pathlib import Path

import torch
from diffusers import Flux2KleinPipeline

prompt = os.environ["FLUX_PROMPT"]
output_arg = os.environ.get("FLUX_OUTPUT_PATH", "").strip()
model_dir = Path(os.environ["FLUX_MODEL_DIR"]).expanduser()
default_dir = Path(os.environ["FLUX_DEFAULT_OUTPUT_DIR"]).expanduser()

timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
if output_arg:
    out_path = Path(output_arg).expanduser()
    if out_path.is_dir() or output_arg.endswith(("/", "\\")):
        out_path = out_path / f"flux2_klein_{timestamp}.png"
else:
    out_path = default_dir / f"flux2_klein_{timestamp}.png"

out_path.parent.mkdir(parents=True, exist_ok=True)

pipe = Flux2KleinPipeline.from_pretrained(model_dir, torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()

seed = int(datetime.now().timestamp()) & 0xFFFFFFFF
generator = torch.Generator(device="cuda").manual_seed(seed)

image = pipe(
    prompt=prompt,
    height=896,
    width=896,
    guidance_scale=1.0,
    num_inference_steps=4,
    generator=generator,
).images[0]

image.save(out_path)
print(f"Saved image to {out_path}")
print(f"Seed used: {seed}")
PY
