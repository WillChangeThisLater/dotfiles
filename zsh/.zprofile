# ~/.zprofile — loaded by login shells that do NOT read .zshrc
# (non-interactive ssh commands, `tmux new-session -d` windows, cron, etc.)
# Keeps nvm-managed node tooling (pi included) on PATH for those contexts.

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
[ -s "$NVM_DIR/nvm.sh" ] && nvm use default >/dev/null 2>&1
