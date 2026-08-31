---
name: hard-to-test-apps
description: Strategies for testing interactive/TUI/GUI apps that agents find hard to test — choosing the right harness (tmux, byte probes, Xvfb+xdotool, fake backends), determinism tricks, and when to ask the human for help.
---

# Hard-to-Test Apps

Testing strategies for software that resists ordinary agent testing: TUIs that
read raw terminal input, apps needing key **release** events, audio/mic paths,
GUI apps, and anything whose bugs only show up through a specific I/O channel.

## Ask the human for environment help

**You are allowed — and encouraged — to say what test environment you need.**
If setting it up yourself is awkward, would disturb the human's running
sessions, or needs resources you can't see, just ask. Examples that worked:

> "I really want to use the x11-gui-automation skill to test this — can you set
> that environment up for me (Xvfb display + VNC port)?"

> "Can you hold-and-release the spacebar in your real kitty terminal while I
> watch the log? My synthetic keystrokes can't produce a true physical hold."

> "This test needs a working microphone / a second monitor / a browser profile —
> can you provide or verify that part?"

Humans can do in 10 seconds what costs an agent 20 minutes of scaffolding —
especially physical input, hardware devices, and anything on their real desktop.

## Pick the right harness (decision table)

| You need... | Use |
|---|---|
| Drive a CLI/TUI with discrete keypresses, observe screen text | **tmux** `send-keys` / `capture-pane` (see tmux skill) |
| Know what escape sequences a terminal **actually sends** (kitty protocol, releases, repeats, paste markers) | **Byte probe**: raw-mode script that dumps incoming bytes as hex |
| True key **hold-and-release**, mouse, focus events, real terminal emulator behavior | **Xvfb + real terminal + xdotool** (see x11-gui-automation skill) |
| Verify app logic independent of flaky I/O (mic, network, model) | **Fake backend / stub**: deterministic script behind a config env var |
| Test code-level behavior (parsers, key matching) | **Unit tests** against the app's own key-parsing utilities — cheapest, do this first |

Rule of thumb: escalate only when the cheaper harness *structurally cannot*
produce the input. Example: tmux parses and routes every keypress itself, so it
can never forward kitty-protocol key-release events — no amount of config fixes
that; go straight to Xvfb + a real terminal.

## Determinism tricks

- **Fake backends**: point the app at a stub via its config/env (e.g.
  `PI_DICTATION_BACKEND=/tmp/fake-backend.sh`). Make the stub emit a **counter**
  (`echo "run $((n++))"`) so you can distinguish partial runs from final runs.
- **Defeat heuristic gates** the app uses to ignore noise (silence thresholds,
  cooldowns) via env overrides when testing plumbing.
- **Event logs**: if the app has a debug log hook, use it. If not, add one
  before you start testing — screen state alone hides too much. Verify the
  *event sequence* (`start → partial → commit`), not just the final pixels.
- **Screenshots as evidence**: `ffmpeg -f x11grab ... -frames:v 1 out.png` for
  X displays; read them (you are multimodal) to verify before/after state.
- **Isolate the app's state**: run test instances in a **fresh cwd** (e.g.
  `/tmp/test-foo`) — many tools auto-resume the most recent session for the
  cwd and you will silently take over the human's conversation/work.

## Gotchas ledger (scar tissue — read before debugging weirdness)

- **Bundled apps**: if the binary is a build artifact, harness-level code fixes
  require a rebuild; source-loaded plugins/extensions may hot-reload. Know which
  parts of your change need what, or you'll test stale code.
- **tmux pane drift**: window indices shift as windows are created/killed. Pin
  targets by pane ID (`%N`) and `capture-pane` to verify content **before every
  `send-keys`** — or your keystrokes land in the human's other panes and set
  their agents loose.
- **`pkill -f` self-match**: your own `bash -c` command line contains the
  pattern; `pkill -f` will kill your shell. Use `pkill -x` or `pgrep` first.
- **Xvfb + kitty**: unset `WAYLAND_DISPLAY`/`XDG_SESSION_TYPE` or kitty
  connects to Wayland and renders nowhere; kitty needs GL (llvmpipe under Xvfb
  works); `--config NONE` bypasses a broken user config. Also note terminals
  may treat inline comments in config values as part of the value.
- **xdotool key names are lowercase**: `keydown space`, not `keydown Space`.
- **Typed shell heredocs are fragile**: sending multi-line scripts through
  `xdotool type` into an interactive app mangles them; write scripts to files
  with your file tools, then run them.
- **Screenshots can be stale**: a TUI only repaints when something triggers a
  render. Blank output may mean "no repaint happened", not "nothing happened" —
  send a harmless keypress or check the event log before concluding failure.
- **A passing unit/fixture test ≠ working feature**: fixture paths often bypass
  the real input device (recorded WAVs instead of the mic). Verify the real
  device path at least once.

## Case study / provenance

Created 2026-08-30 from the pi-harness dictation feature debugging session
(pi session `01a052e1`, cwd `~`). Four bugs, each found by a different harness:
wrong arecord sample-rate flag (event log showed no partials), missing
repaint after programmatic editor writes (keypress-forced screenshots), a
duplicated method name shadowing `commit()` at runtime (standalone tsc flagged
it; counter-backed fake backend proved the final call never happened), and
kitty-protocol sequences unmatched in the input handler (byte probes + Xvfb
hold test). The human's real-keyboard test provided final confirmation that
synthetic input couldn't fully replace.

Helper scripts: see `scripts/README.md`.
