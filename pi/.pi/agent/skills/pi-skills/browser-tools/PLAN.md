# Tooling Improvement Plan

## Browser terminal command helper

1. **Helper CLI (`browser-term-send.js`) — low effort, high QoL** _(Implemented 2026-02-12)_
   - Wraps `browser-eval.js --stdin` so agents can run `browser-term-send "ls -la"` and have the script inject `window.webTerminal?.send('ls -la\r')` automatically.
   - Optionally captures the last N `.xterm` rows and prints them so the CLI feels like a lightweight terminal mirror.
   - Reuses the existing browser session; no server changes required.

2. **In-page command palette / hidden textarea — medium effort**
   - Inject a small overlay (or hidden `<textarea>`) once per page load via a helper script.
   - Subsequent helper commands can focus the element, set its value, and dispatch keyboard events, which mimics human typing and works even if the frontend refactors its WebSocket API.
   - Adds minimal UI hints so agents know when automation is driving the terminal, while still requiring the browser for visual verification.

3. **Server-side debug endpoint — highest effort, most powerful**
   - Gate a local-only HTTP endpoint (e.g., `POST /debug/exec`) behind an env flag so we can pipe commands straight into `node-pty` during development.
   - Returns structured JSON (stdout/stderr/exit code) so scripts/tests can assert on terminal behavior without going through the browser.
   - Requires coordination with the web-terminal project, security considerations, and clear documentation about disabling it in production.

## tmux workflow polish

1. **Capture helpers & templates — low effort**
   - Provide snippets/aliases (e.g., `tmux-cap pane-id > file`) in the skill docs so agents can grab pane output without retyping long `capture-pane` sequences.
   - Document naming patterns for sessions/windows tied to skills (e.g., `browser`, `server`, `notes`) to reduce confusion when resuming work.

2. **Session bootstrap script — medium effort**
   - Create a script under a `scripts/` subfolder that spins up a standard layout (server pane + browser-tools pane + notes pane) and exports the session name.
   - Encourages consistent setups and makes it trivial to restart or share workflows with other agents.

3. **Automated logging hooks — higher effort**
   - Explore using `tmux pipe-pane` + helper scripts to stream key panes to log files automatically, so long test runs or browser automation traces are preserved without manual intervention.
   - Would need guardrails to avoid filling disk and instructions on how to toggle logging per pane.
