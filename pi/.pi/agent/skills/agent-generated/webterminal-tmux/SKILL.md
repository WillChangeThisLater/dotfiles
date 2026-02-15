---
name: webterminal-tmux
description: tmux layout + habits for the local web-terminal project (server pane, browser-tools pane, capture workflow).
---

# Web Terminal tmux Workflow

Layer these repo-specific habits on top of the standard [`tmux` skill](../pi-skills/tmux/SKILL.md) whenever you work on the minimal web terminal project (the TypeScript/Node app that serves `client.ts` + `server.ts`). The goal is to keep the dev server, browser automation, and editing panes organized and easy to capture.

## Prerequisites
- Project root checked out locally (e.g., `/tmp/<...>/`)
- Dependencies installed (`npm install` inside the project)
- Browser tools skill bootstrapped (`cd ~/.pi/agent/skills/pi-skills/browser-tools && npm install`)

## Session recipe
1. **Create/attach session**
   ```bash
   tmux new -s webterm     # or: tmux attach -t webterm
   ```
2. **Window 0 – shell/edit/build**
   - `cd /path/to/web-terminal`
   - General commands (npm run build, git status, editing)
3. **Window 1 – dev server**
   ```bash
   tmux new-window -t webterm -n server
   cd /path/to/web-terminal
   npm run dev -- --host 127.0.0.1 --port 3000
   ```
   - Leave this pane running; restart with `Ctrl-C` → rerun command.
4. **Window 2 – browser tools**
   ```bash
   tmux new-window -t webterm -n browser
   cd ~/.pi/agent/skills/pi-skills/browser-tools
   node browser-start.js              # auto-detects chrome; no-op if already on :9222
   node browser-nav.js http://127.0.0.1:3000 --new
   ```
   - Reuse this pane for `browser-eval.js`, `browser-screenshot.js`, etc.
5. **(Optional) Window 3 – notes/plan**
   - Park `PLAN.md`, `progress.md`, etc., here if the task calls for planning-with-files.

## Pane capture pattern
Use consistent pane targets so transcripts are predictable:

| Pane | Target | Purpose |
| --- | --- | --- |
| shell | `webterm:0.0` | one-off commands, editing logs |
| server | `webterm:server.0` | dev server output |
| browser | `webterm:browser.0` | CDP commands & status |

Capture recent output with:
```bash
CAPTURE=/tmp/webterm-server.log
(tmux capture-pane -t webterm:server.0 -S -2000 -J; tmux save-buffer "$CAPTURE"; tmux delete-buffer)
```
Adjust target for other panes. Reference the saved file path when summarizing for the user.

## Quick helper: browser terminal command sender
Keep the helper CLI within reach from the browser window:
```bash
cd ~/.pi/agent/skills/pi-skills/browser-tools
./scripts/browser-term-send.js "ls"
./scripts/browser-term-send.js --wait 800 --tail 40 "npm test"
```
This routes commands through `window.webTerminal.send` and prints the last xterm lines, so you can stay inside tmux while verifying browser-side output.

## Learned lessons
- Keep Chrome running for the entire session; `browser-start.js` now exits early if the port is already in use, so you can re-run it safely after reconnects.
- When restarting the dev server, wait for the "Server listening" line before issuing browser commands to avoid transient WebSocket errors.
- Capture panes before shutting anything down—especially the server—so logs reflect the live run.
