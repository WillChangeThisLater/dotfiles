#!/usr/bin/env bash
# rea-env.sh — export the pinned environment for driving the REA CLI at ~/repos/rea.
#
# Purpose:   REA requires Node 24.12.0 (nvm) + GHIDRA_INSTALL_DIR + JAVA_HOME.
#            Source this instead of remembering the incantation.
# Usage:     source ~/.pi/agent/skills/agent-generated/rea/scripts/rea-env.sh
# Deps:      nvm installed at ~/.nvm
# After:     cd ~/repos/rea && node scripts/rea.mjs <command>

export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra"    # Ghidra 12.1.4
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

# Pin Node 24.12.0 (repo rejects v25.x)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use 24.12.0 >/dev/null
fi

echo "rea env ready: node=$(node --version) ghidra=$GHIDRA_INSTALL_DIR"
