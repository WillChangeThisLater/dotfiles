# dotfiles

Paul's system configuration, managed with [GNU Stow](https://www.gnu.org/software/stow/).

## What's in here

| Package | What it stows | Notes |
|---|---|---|
| `zsh` | `~/.zshrc` | Uses [oh-my-zsh](https://ohmyz.sh/) with autosuggestions + syntax highlighting |
| `oh-my-zsh` | `~/.oh-my-zsh` | Vendored fork with the needed plugins |
| `tmux` | `~/.tmux.conf` | Uses [TPM](https://github.com/tmux-plugins/tpm) (auto-cloned by install.sh) |
| `neovim` | `~/.config/nvim` | Lazy.nvim based; plugins install on first open |
| `vim` | `~/.vimrc` | |
| `lynx` | `~/.config/lynx` | Custom `lynx.cfg`, `custom.lss`, jumpfile |
| `codex` | `~/.codex` | OpenAI Codex CLI config |
| `pi` | `~/.pi/agent` | [pi coding-agent](https://github.com/badlogic/pi-mono) config: `AGENTS.md`, `models.json`, and the full set of agent **skills** (tmux, browser automation with per-site controls, x11-gui-automation, subagents, llama-server, and more) |

## Install

Target system: **Ubuntu** (uses `apt-get`; on other distros install the deps yourself).

```bash
sudo apt-get install -y stow zsh git tmux
git clone git@github.com:WillChangeThisLater/dotfiles.git
cd dotfiles
./install.sh
```

`install.sh` clones TPM (if missing) and stows everything. After installing,
launch `zsh` (set it as your login shell with `chsh -s $(which zsh)`) and open
tmux, then press `prefix + I` to install tmux plugins.

## Dependencies beyond apt

- **kitty** — tmux sets `default-terminal "kitty"`; install kitty or adjust `.tmux.conf`
- **pi** (coding-agent) and **codex** — needed for the `pi`/`codex` config packages; binaries are not installed here
- **llama.cpp etc.** — see the individual skill docs under `pi/.pi/agent/skills/`

## Testing

Run the install end-to-end in a throwaway Ubuntu container:

```bash
./test-install.sh
```

This installs the apt deps in a fresh `ubuntu:24.04`, runs `install.sh`,
verifies the stow symlinks, smoke-tests zsh, and parses the tmux config.

## Notes / known limitations

- Some `.zshrc` lines reference `/Users/paul.wendt/...` (old macOS paths) — they are
  guarded or harmless, but not all paths are machine-independent.
- `pi/.pi/agent/skills/pi-skills/write-like-me/samples/09_*` and `11_*` are
  gitignored (personal content) and exist only on the local machine.
