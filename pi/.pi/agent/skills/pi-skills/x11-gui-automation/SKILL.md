---
name: x11-gui-automation
description: Run and control GUI applications in isolated X11 virtual displays (Xvfb) with xdotool, screenshots, and optional VNC observation.
---

# x11-gui-automation

## Purpose
Use this skill to automate GUI applications in isolated X11 sessions so the human's main desktop cannot interfere.

## Self-setup (preferred for agents doing browser work)
When no human-provided environment exists, set it up yourself with the helper scripts — do NOT hand-roll Xvfb/chrome/x11vnc commands (port scans and tmux panes are error-prone and collide between agents):

```bash
# 1. claim an environment (atomic lock prevents two agents setting up at once)
skills/x11-gui-automation/scripts/self_setup.sh <your-agent-name>
# stdout (also written to /tmp/x11-env/<agent>.env, sourceable):
#   DISPLAY_NUM=3 CHROME_PORT=9222 VNC_PORT=5902 TMUX_SESSION=env-setup TMUX_WINDOW=env-<agent>

# 2. ... do browser work against http://localhost:$CHROME_PORT ...

# 3. clean up when done
skills/x11-gui-automation/scripts/teardown.sh <your-agent-name>
```

Semantics:
- **Locking:** `mkdir`-based atomic lock in `/tmp/x11-env.lock`. A second agent's setup fails fast (exit 2) with a hint to retry — wait ~15s and re-run. Locks older than 10 min are considered stale and can be stolen.
- **Idempotent:** re-running setup with the same agent id reuses the existing env and re-prints its values.
- **Isolation:** one tmux window (`env-<agent>`) in the dedicated `env-setup` session per agent; displays/ports are allocated by scanning, so concurrent agents never overlap.
- **Teardown is yours:** when finished with an environment, run `teardown.sh` so the next agent can use the ports. If you die mid-task, the human can run it, or it will be reclaimed via stale lock.
- Human can always observe: `vncviewer localhost:<VNC_PORT>` (the VNC server runs viewonly).

## Session Contract (required)
- One X display per application/task (example: `:2`).
- Standard display geometry is fixed: **`1920x1080x24`**.
- Keep user desktop separate (often Wayland `:0`).
- Scope every automation command to the target display:
  - `DISPLAY=:N ...`
- Prefer one primary app window per display session.
- Rationale: fixed geometry enables stable pixel landmarks for per-application skills.

## Human Coordination (only when NOT self-setting-up)
If the human has pre-spun the environment (they will tell you the display + chrome port — typically via a `/browser :N <port>` prompt), skip self-setup and use their values. Do not ask the human scaffold questions when you can self-setup; only coordinate display/ports when a human-provided environment already exists.

Before starting or reusing a GUI session, ask the human:
1. Do you want to scaffold the session yourself, or should I scaffold it?
2. Which display number should we use (example: `:2`)?
3. Which VNC port should we use if observation is needed (example: `5902`)?

If the human is scaffolding, wait for confirmation that the app is running in the target display, then verify geometry and warn if it differs from `1920x1080x24`.
If the agent is scaffolding, confirm display+port first, ensure the VNC port is free, then run setup with `1920x1080x24`.

Process placement:
- Human-scaffolded: typically run `Xvfb`, app, and `x11vnc` in separate tmux panes/windows.
- Agent-scaffolded: use separate long-lived processes (separate panes/windows or background jobs) so each service stays running.

## Setup: Start isolated GUI session
1. Start virtual X server:
```bash
Xvfb :2 -screen 0 1920x1080x24
```
2. Launch app in that display (generic pattern):
```bash
DISPLAY=:N <app_command>
```
Example:
```bash
DISPLAY=:2 librecad
```
3. Verify display is alive and dimensions match standard:
```bash
DISPLAY=:2 xdpyinfo | head
DISPLAY=:2 xdpyinfo | awk '/dimensions:/{print $2; exit}'
```
Expected dimensions: `1920x1080`

If dimensions differ, warn the human that pixel landmarks may be unreliable for app-specific skills.

## Optional Human Observation (recommended)
Attach VNC to the isolated display (not to the main Wayland session).

If agent is launching `x11vnc`, verify the port is free first:
```bash
lsof -iTCP:5902 -sTCP:LISTEN
```
If occupied, choose a new port and reconfirm with the human.

Then start `x11vnc`:
```bash
env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE \
  x11vnc -display :2 -rfbport 5902 -viewonly -forever -shared -nopw
```

Then connect with a VNC client:
```bash
vncviewer localhost:5902
```

Notes:
- `x11vnc` is the VNC server bridge; it does not open a local viewer window itself.
- If `x11vnc` reports Wayland detection, ensure `-display :N` is correct and unset the Wayland env vars as above.
- For non-local use, configure authentication (`-rfbauth`) instead of `-nopw`.

## Action Loop (required)
For each action:
1. **Observe** current state (`before` screenshot and/or window metadata).
2. **Act** with scoped input (`xdotool`).
3. **Verify** expected UI change (`after` screenshot/metadata).
4. **Retry** with bounded attempts if verification fails.

Minimum verification standard per step:
- Save a `before` and `after` screenshot.
- Confirm at least one expected signal changed (menu opened, tool selected, geometry changed, dialog appeared, etc.).

Never assume an action succeeded without verification.

## Input Primitives (xdotool)
Keyboard:
```bash
DISPLAY=:2 xdotool key ctrl+s
DISPLAY=:2 xdotool type --delay 30 "hello"
```

Mouse click:
```bash
DISPLAY=:2 xdotool mousemove 24 10 click 1
```

Drag:
```bash
DISPLAY=:2 xdotool mousemove 400 300 mousedown 1 mousemove 800 500 mouseup 1
```

## Screenshot Capture
Preferred quick capture (available in this environment):
```bash
ffmpeg -y -f x11grab -video_size 1920x1080 -i :2 -frames:v 1 /tmp/shot.png
```

If geometry is unknown:
```bash
DISPLAY=:2 xdpyinfo | awk '/dimensions:/{print $2; exit}'
```

## Precision Mode: Grid Overlay + Drill-down
Use this when coordinates are ambiguous or targets are small.

1. Capture full screenshot.
2. Add coarse grid overlay.
3. Crop ROI (region of interest) around target.
4. Add finer grid overlay on ROI.
5. Click derived coordinate.
6. Verify and repeat drill-down if needed.

In this environment, `python3 + PIL` was used successfully to generate overlays when ImageMagick `convert` was unavailable.

Example: add a 200px grid to a screenshot:
```bash
python3 - <<'PY'
from PIL import Image, ImageDraw
im = Image.open('/tmp/shot.png').convert('RGB')
d = ImageDraw.Draw(im)
w,h = im.size
for x in range(0,w+1,200): d.line((x,0,x,h), fill=(0,255,102), width=1)
for y in range(0,h+1,200): d.line((0,y,w,y), fill=(0,255,102), width=1)
im.save('/tmp/shot-grid.png')
PY
```

## Known Behaviors / Gotchas
- Wayland main sessions (`:0`) may expose Xwayland sockets; do not assume they are suitable x11vnc targets.
- Display locks can be stale (`/tmp/.X1-lock`); prefer a fresh display number if uncertain.
- Some WMs in virtual sessions may not support `_NET_ACTIVE_WINDOW`; rely on scoped actions + verification.

## Companion Notes
- Captcha micro-skill: `capatcha.md`

## Provenance
### PI session UUID (how to get it)
Derive the cwd-specific sessions directory, then read the UUID suffix from the newest filename:
```bash
slug="--$(pwd | sed 's#^/##; s#/#-#g')--"
ls -lt "$HOME/.pi/agent/sessions/$slug" | head
```
Example filename:
`2026-08-26T20-25-59-475Z_01a03fc0-41b3-74cf-9c6f-57cb158a867e.jsonl`

Session used for this skill:
- pi session UUID: `01a03fc0-41b3-74cf-9c6f-57cb158a867e`

Created from live session on 2026-08-26 while automating LibreCAD in `Xvfb :2`, validating:
- screenshot capture,
- xdotool menu interaction,
- rectangle drawing,
- VNC observation via x11vnc with Wayland env vars unset.
