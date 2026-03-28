---
name: shell controls
description: tmux command recipes for interacting safely with POSIX-like shells (bash, ash, sh, zsh)
---

# Shell Controls
Use these controls when the target pane is a shell prompt (e.g. `$`, `#`, `-ash`, `bash`, `zsh`).
All actions are sent through tmux using `session:window.pane`.

## 1. Safe command loop (required)
For each step:
1) Send exactly one command.
2) Wait briefly.
3) Capture pane output.
4) Decide next step.

```bash
tmux send-keys -t <session:window.pane> "pwd" Enter
sleep 1
tmux capture-pane -p -t <session:window.pane>
```

## 2. Prompt hygiene
Clear pending input before complex commands:
```bash
tmux send-keys -t <session:window.pane> -N 10000 BSpace
```

Interrupt a running command:
```bash
tmux send-keys -t <session:window.pane> C-c
```

## 3. Quoting and multiline rules
- Prefer single-line commands.
- Avoid nested quoting unless necessary.
- Avoid heredocs unless explicitly needed.
- If quoting is complex, write to a temporary script and run it.

Safer pattern:
```bash
tmux send-keys -t <session:window.pane> "printf '%s\n' 'echo hello' > /tmp/run.sh && sh /tmp/run.sh" Enter
```

## 4. Capability checks before assumptions
Do not assume GNU tools/options.
Check availability first:
```bash
tmux send-keys -t <session:window.pane> "command -v bash python3 jq grim scrot" Enter
sleep 1
tmux capture-pane -p -t <session:window.pane>
```

## 5. BusyBox / minimal shell caution
If environment appears BusyBox/ash:
- prefer POSIX syntax
- avoid bash-only features
- verify flags with `--help` or minimal test command before full command

## 6. Error recovery
If output is confusing or commands got concatenated:
1) `C-c`
2) clear prompt with `BSpace`
3) send one small probe command (`echo READY && pwd`)
4) continue with one-command loop

```bash
tmux send-keys -t <session:window.pane> C-c
tmux send-keys -t <session:window.pane> -N 10000 BSpace
tmux send-keys -t <session:window.pane> "echo READY && pwd" Enter
sleep 1
tmux capture-pane -p -t <session:window.pane>
```

