#!/usr/bin/env bash
# Test dotfiles install end-to-end in a fresh Ubuntu container.
#
# Purpose: verifies install.sh works on a clean ubuntu:24.04 (deps via apt,
# stow symlinks, zsh smoke test, tmux config parse).
# Usage: ./test-install.sh   (run from repo root; requires docker)
# Dependencies: docker
# Working directory: repo root
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker run --rm -v "$REPO_ROOT:/dotfiles:ro" ubuntu:24.04 bash -c '
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null
apt-get install -y -qq stow zsh git tmux neovim curl >/dev/null
echo "== deps installed =="

cp -r /dotfiles /work
cd /work
./install.sh
echo "== install.sh OK =="

fail=0
for f in ~/.zshrc ~/.tmux.conf ~/.vimrc ~/.config/nvim ~/.oh-my-zsh \
         ~/.config/lynx/lynx.cfg ~/.pi/agent/AGENTS.md \
         ~/.pi/agent/skills/pi-skills/tmux/SKILL.md \
         ~/.tmux/plugins/tpm/tpm; do
  if [ -e "$f" ]; then echo "OK      $f"; else echo "MISSING $f"; fail=1; fi
done

echo "== zsh smoke test =="
zsh -d -i -c "echo ZSH_OK \$ZSH_VERSION" 2>&1 | tail -2

echo "== tmux config parse =="
tmux -f ~/.tmux.conf start-server \; kill-server
echo TMUX_OK

[ "$fail" -eq 0 ] && echo "ALL_CHECKS_PASSED" || { echo "CHECKS_FAILED"; exit 1; }
'
