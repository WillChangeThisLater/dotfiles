#!/bin/bash
set -e

# TPM (tmux plugin manager) — .tmux.conf declares plugins via TPM
if [ ! -d "$HOME/.tmux/plugins/tpm" ]; then
    git clone https://github.com/tmux-plugins/tpm "$HOME/.tmux/plugins/tpm"
fi

stow -t ~ neovim oh-my-zsh tmux vim zsh codex pi
mkdir -p ~/.config/lynx
stow -t ~/.config/lynx lynx

echo "Done. Open tmux and press prefix + I (capital I) to install tmux plugins."
