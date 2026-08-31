#!/usr/bin/env bash
# Test dotfiles install end-to-end in a fresh Ubuntu container.
#
# Purpose: verifies install.sh works on a clean ubuntu:24.04 (deps via apt,
# stow symlinks, zsh smoke test, tmux config parse).
#
# Usage:
#   ./test-install.sh              # run checks and exit
#   ./test-install.sh -i           # after checks pass, drop into an interactive
#                                  # shell inside the container to poke around
#                                  # (container is removed on exit)
#
# Dependencies: docker
# Working directory: repo root
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INTERACTIVE=0
for arg in "$@"; do
  case "$arg" in
    -i|--interactive) INTERACTIVE=1 ;;
    -h|--help)
      sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)
      echo "Unknown option: $arg (try -h)" >&2; exit 1 ;;
  esac
done

IT_FLAGS=""
POST_CHECK=""
if [ "$INTERACTIVE" -eq 1 ]; then
  [ -t 0 ] && [ -t 1 ] || { echo "-i needs a TTY" >&2; exit 1; }
  IT_FLAGS="-it"
  # Keep the container open after checks, then hand over an interactive zsh.
  POST_CHECK='
echo
echo "== checks done — dropping into interactive shell (container is removed on exit) =="
echo "   try: zsh, tmux, nvim, ls -la ~, readlink ~/.zshrc"
exec bash -c "exec zsh -d -i"
'
else
  POST_CHECK='
[ "$fail" -eq 0 ] && echo "ALL_CHECKS_PASSED" || { echo "CHECKS_FAILED"; exit 1; }
'
fi

docker run $IT_FLAGS --rm -v "$REPO_ROOT:/dotfiles:ro" ubuntu:24.04 bash -c '
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
         ~/.tmux/plugins/tpm/tpm ~/.gitconfig ~/.ssh/config \
         ~/.config/sway/config; do
  if [ -e "$f" ]; then echo "OK      $f"; else echo "MISSING $f"; fail=1; fi
done

echo "== zsh smoke test =="
zsh -d -i -c "echo ZSH_OK \$ZSH_VERSION" 2>&1 | tail -2

echo "== tmux config parse =="
tmux -f ~/.tmux.conf start-server \; kill-server
echo TMUX_OK
'"$POST_CHECK"
