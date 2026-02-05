#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

SKILLS_DIR="pi/.pi/agent/skills/pi-skills"
README="$SKILLS_DIR/README.md"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "Missing skills directory at $SKILLS_DIR" >&2
  exit 1
fi

if [[ ! -f "$README" ]]; then
  echo "Missing README at $README" >&2
  exit 1
fi

pi --mode print --no-session --thinking low \
  @"$README" \
  "Update $README so it reflects the current state of the skills under $SKILLS_DIR. Inspect the directories to list every available skill with its description, refresh the requirements/setup details, and document any differences from upstream pi-skills based on what exists locally. After editing the README, summarize the changes you made."
