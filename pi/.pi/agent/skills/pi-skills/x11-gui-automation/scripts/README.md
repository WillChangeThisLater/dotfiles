# scripts/ — x11-gui-automation

Reusable tooling for the x11-gui-automation skill. See `../SKILL.md` for the workflows that
invoke these scripts.

## Inventory

| Script | Purpose |
|---|---|
| `x11_env.sh` | Core lifecycle: claim/release Xvfb+x11vnc environments, run commands on a display, port registry, status. |
| `setup.sh` / `teardown.sh` / `self_setup.sh` | Environment bootstrap helpers. |
| `check_profile_sessions.sh` | Chrome profile session inspection. |
| `aim_element.py` | Locate UI elements in full-res screenshots (color/probe scan) for pixel-accurate clicks; also labeled-grid overlays and native-res zoom crops. Used to avoid eyeballing coordinates from downscaled previews. |
| `apps/chrome.sh` | Launch Chrome with CDP debugging port against a claimed env. |
| `apps/chrome_bootstrap.sh` | One-time golden-master chrome profile login flow (human does logins). |
| `apps/desktop.sh` | Launch openbox desktop on a claimed env for multi-window non-browser apps (Steam, installers); launch apps into it via `x11_env.sh run`. |
| `apps/kitty.sh` | Launch kitty on X11 for rendering debugging. |

## Conventions for new scripts

- Every script starts with a metadata header: purpose, usage, exit codes, dependencies, expected working directory.
- App-specific launchers go in `apps/` and follow the `chrome.sh` pattern: source the state file, launch via `x11_env.sh run`, health-check, record keys in the state file, print automation + observation hints.
- Link new scripts from `../SKILL.md` so future agents can discover them.
