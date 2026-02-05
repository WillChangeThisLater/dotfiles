---
name: tmux
description: Run all work inside dedicated tmux sessions, manage windows/panes, and capture pane output.
---

# tmux Skill

Use tmux to isolate tasks inside dedicated terminal sessions. Always begin work by creating (or attaching to) a task-specific tmux session, then perform every command from within that session. This keeps logs organized, makes it easy to resume work, and enables pane captures when the user asks for "screenshots."

## Requirements

- `tmux` available in `$PATH` (check with `tmux -V`).
- Basic familiarity with terminal navigation (the skill documents the key bindings and command equivalents below).

## Quick Start Workflow

1. **Create a new session** (unique, descriptive name):
   ```bash
   tmux new -s taskname
   ```
   - Use lowercase, hyphenated names (e.g., `tmux new -s hn-audit`).
2. **Detach/reattach as needed**:
   ```bash
   tmux detach            # Ctrl-b d
   tmux attach -t taskname
   ```
3. **Add windows or panes** for subtasks (see sections below).
4. **Capture panes** with `tmux capture-pane` + `tmux save-buffer /tmp/<file>.txt` whenever a transcript/screenshot is requested.
5. **Clean up** completed sessions: `tmux kill-session -t taskname`.

## Session Management

| Action | Command |
| --- | --- |
| List sessions | `tmux ls` |
| Create + attach | `tmux new -s taskname` |
| Attach existing | `tmux attach -t taskname` |
| Detach | `Ctrl-b` `d` |
| Rename session | `tmux rename-session -t old name` |
| Kill session | `tmux kill-session -t taskname` |

Tips:
- When running commands from outside tmux (e.g., via scripts), target sessions explicitly: `tmux send-keys -t taskname "command" Enter`.
- Store session names in environment variables for automation: `SESSION=taskname`.

## Windows and Panes

### Windows
- New window: `Ctrl-b` `c` or `tmux new-window -t taskname -n build`.
- List windows: `Ctrl-b` `w`.
- Rename window: `Ctrl-b` `,` or `tmux rename-window -t taskname:1 logs`.
- Switch windows: `Ctrl-b` `<number>` / `Ctrl-b` `n` / `Ctrl-b` `p`.

### Panes
- Split horizontal: `Ctrl-b` `"` or `tmux split-window -v`.
- Split vertical: `Ctrl-b` `%` or `tmux split-window -h`.
- Navigate panes: `Ctrl-b` arrow keys.
- Resize: `Ctrl-b` `Ctrl` + arrow keys or `tmux resize-pane -L/-R/-U/-D 5`.
- Close pane: `Ctrl-d` in the pane or `tmux kill-pane -t taskname:1.1`.

Organize panes by task (e.g., editor, tests, logs). Document pane targets as `session:window.pane` (e.g., `taskname:1.0`).

## Capturing Pane Output ("Screenshots")

Use tmux's buffer utilities to grab exact pane contents:

```bash
target="taskname:1.0"
tmux capture-pane -t "$target" -J -S -2000  # -J joins wrapped lines, -S sets scrollback start
capture_file="/tmp/${SESSION:-taskname}-pane1.txt"
tmux save-buffer "$capture_file"
tmux delete-buffer
```

Guidelines:
- Choose filenames under `/tmp` or the project workspace (reference them in your final response).
- Use `-S -2000` (or another negative offset) to include recent scrollback.
- For raw bytes (e.g., binary output), add `-e` to `capture-pane`.
- Mention the capture path when summarizing work.

## Logging / Streaming Output

For long-running commands, pipe pane output to a file:
```bash
tmux pipe-pane -t taskname:1.0 -o 'cat >> /tmp/taskname.log'
```
Use `tmux pipe-pane -t taskname:1.0` with no command to stop piping.

## Troubleshooting & Cleanup

- **Session already exists**: attach with `tmux attach -t taskname` instead of creating a new one.
- **Stale sessions**: `tmux ls` then `tmux kill-session -t <name>`.
- **Detached but want to rejoin**: `tmux a -t taskname`.
- **Copy mode**: `Ctrl-b` `[` to scroll and copy text; exit with `q`.
- **Keyboard shortcuts not working**: ensure `$TERM` is compatible (e.g., `screen-256color`).

Always clean up sessions when the task is complete unless the user asks to keep them running.

## Learned Lessons

Any agent who uses this skill and discovers a new workflow, edge case, or tip should document it here for future reference.

### 2026-02-04 – Mitmproxy + curl workflow
- **Interactive programs**: when driving full-screen apps (e.g., mitmproxy) inside a pane, `tmux send-keys -t session:window.pane q` / `y` pairs are useful for quitting cleanly. Control sequences (such as `C-c` to interrupt `sleep 1000`) can be sent the same way.
- **Pane inspection**: use `tmux capture-pane -t target -p` for a quick textual “peek” before deciding whether to save a pane. This helps verify commands succeeded before capturing to `/tmp`.
- **Exports from TUI tools**: mitmproxy’s built-in exporter (`e` → select part → `b`) piping into an editor makes it easy to write captured responses to files (e.g., `/tmp/response`). Document file paths you create so users know where outputs live.
