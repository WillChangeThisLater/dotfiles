---
name: x11-gui-automation
description: Run and control GUI applications in isolated X11 virtual displays (Xvfb) with xdotool, screenshots, and optional VNC observation.
---

# x11-gui-automation

## Purpose
Automate GUI applications in isolated X11 sessions so the human's main desktop cannot interfere, and so agents can SEE what they're doing via screenshots.

## The core convention: ONE DISPLAY PER APP
Every (agent, app) pair gets its own Xvfb display, its own tmux window, its own state file. Never put two apps on one display if either needs input automation — they would fight over the same virtual mouse/keyboard. Displays are cheap; correctness is not.

## The generic tool: `x11_env.sh`

```bash
S=skills/x11-gui-automation/scripts/x11_env.sh

$S claim <agent> <app>          # allocate display+VNC, create tmux window, write state
$S run <agent> <app> <cmd...>   # run a command on the app's display (one-off apps)
$S port <agent> <app> NAME 3000 "web ui for testing"
                                # declare a port you opened so humans/agents can find it
$S release <agent> [app]        # release one app, or all of an agent's apps
$S status                       # live table: who is running what, where, alive or stale
```

- **State/registry:** `/tmp/x11-env/<agent>/<app>.env` — plain `KEY=VALUE` lines. It IS the registry; other agents and the human can read it. `status` renders it with liveness cross-checks and flags undeclared listening ports (detected via the env's tmux window processes).
- **Locking:** atomic mkdir lock covers *setup only*. A second concurrent claim fails fast (exit 2) — wait ~15s and retry. Locks older than 10 min are stolen.
- **Self-cleaning:** a failed claim tears itself down after saving pane diagnostics to `/tmp/x11-env/<agent>/<app>.log`. Orphaned windows (crashed runs) are reclaimed automatically.
- **Declare what you open:** any port the human or another agent might need, register it with `$S port`. Bare listeners outside the X11 contract are invisible to the registry by design — don't rely on `status` to find them.
- **Ask-for-eyes protocol:** whenever you ask the human to look at your screen, include the exact command from your state file, e.g. "run `vncviewer localhost:5903` and tell me what you see" — never make the human hunt for the port.

## App-specific launchers (`scripts/apps/`)

Some apps need bespoke knowledge (flags, automation channels, health checks). Those live in `apps/`:

```bash
scripts/apps/chrome.sh <agent>          # chrome + CDP remote debugging port (records CHROME_PORT)
scripts/apps/kitty.sh <agent>           # kitty on X11 for rendering-debugging (e.g. kitten icat)
```

Each launcher prints how to automate it (chrome: CDP/DOM-first, xdotool only for pixels) and how to observe it (vncviewer command). To add a new app, write a ~20-line script: source the state file, launch via `$S run`, health check, record keys, print hints.

## Standard browser flow (chrome)

```bash
S=skills/x11-gui-automation/scripts/x11_env.sh
$S claim $AGENT_ID chrome
skills/x11-gui-automation/scripts/apps/chrome.sh $AGENT_ID
# ... automate: browser CLI / CDP with --port <CHROME_PORT> ...
$S release $AGENT_ID chrome      # when done — release so the next agent gets the ports
```

Escalation ladder for chrome: **CDP/DOM first** (reliable, text-based) → **xdotool on the X display** for pixel-level interactions (React dropdowns, captchas) → **ask the human** with the exact vncviewer command. Every interaction loop: screenshot before, act, screenshot after, compare.

## Rendering debugging (kitty and friends)

For "is this app drawing what I think it's drawing?" — claim an env for the app, launch it, do the thing, then screenshot the display:

```bash
DISPLAY=:N scrot -o /tmp/check.png
```

The screenshot is ground truth. If you can't tell from the screenshot, ask the human with the vncviewer command.

## Human-provided environments (only when the human pre-spins)

If the human gives you a display + port (e.g. via `/browser :2 9222`), use their values and skip claiming. Do not ask the human scaffold questions you can answer yourself with `claim`.

## Session Contract (required)
- Standard display geometry: **`1920x1080x24`** (fixed for stable pixel landmarks).
- Scope every automation command to the target display: `DISPLAY=:N ...`
- One primary app per display (see the one-display-per-app rule above).
- Keep the user's desktop (usually Wayland `:0`) out of scope — never automate `:0`.
- Wayland note: unset `WAYLAND_DISPLAY` and `XDG_SESSION_TYPE` for anything launched into an Xvfb display (the scripts do this for you).
- If you verify dimensions manually: `DISPLAY=:N xdpyinfo | awk '/dimensions:/{print $2; exit}'` should say `1920x1080`.

## Screenshots & overlays
- Capture: `DISPLAY=:N scrot -o /tmp/shot.png` (or `xwd -root | convert xwd:- out.png`).
- To reason about click coordinates, annotate first — draw a labeled grid on the screenshot with PIL:

```python
from PIL import Image, ImageDraw
im = Image.open('/tmp/shot.png').convert('RGB')
d = ImageDraw.Draw(im)
for x in range(0, im.width, 200): d.line([(x,0),(x,im.height)], fill=(255,0,0)); d.text((x+2,2), str(x), fill=(255,0,0))
for y in range(0, im.height, 200): d.line([(0,y),(im.width,y)], fill=(255,0,0)); d.text((2,y+2), str(y), fill=(255,0,0))
im.save('/tmp/shot-grid.png')
```

## Optional Human Observation
VNC servers run (not viewonly — you can interact to help the agent) on each display (started by `claim`). To watch an agent's screen: `vncviewer localhost:<VNC_PORT>` (port from `status` or the agent's message).

## Cleanup is part of the job
Release your env when the task is done (`$S release <agent> <app>`). If you die mid-task the human can sweep with `status` + `release <agent>`, and orphaned windows are reclaimed by the next claim — but don't rely on that.
