---
name: xarrow
description: "Point at something on the human's X11 screen with a big click-through arrow and a sign (\"click HERE\") using the xarrow CLI. Use whenever the human has to look at, click, type into or choose a specific spot, button, field, window or menu: show me where, point to it, which button, where do I click, guide me through this UI, the human must approve or sign something, or you need the human's hand and they may not be looking at the terminal. Mandatory when it is time-critical: a code that expires, a login or payment page that times out, a build waiting on the human."
license: MIT
allowed-tools: Bash(xarrow:*)
---

# xarrow

`xarrow` draws a big, click-through arrow with a sign on the X11 screen. It never
takes focus, needs no special permissions to draw, and disappears by itself.
Point at the thing itself; a line in the terminal is easy to miss.

## The one pattern

```bash
xarrow start --window "Firefox" --text "Click Allow in this dialog"   # returns at once
# ... watch for the result (page changed, job continued, file appeared) ...
xarrow stop --id <id from start>    # or: xarrow stop --all
```

Every arrow ends by itself: `point` after 8 s, `start` after 300 s, when your
session exits (export `XARROW_OWNER_PID=$$` or it reads `CLAUDE_PID`), and the
human can dismiss `--close-button` arrows with a click. Still always `stop` it
yourself the moment the step is done: `xarrow stop <id>` (the id comes from
`start --json`) or `xarrow stop --all`. A removed arrow means the human saw it:
check the result, do not draw it again.

The arrow appears within ~0.5 s of the command; screenshot immediately after
and it may not be up yet.

## Targets

| You know | Use |
|---|---|
| Exact coordinates (from a screenshot) | `--at X,Y --text "..."` |
| A region (button, field, area) | `--rect x,y,w,h` |
| A window | `--window "Title"` or `--window "ClassName:Title"` |
| An app | `--app "Gnome-terminal"` (raises it, points at it) |
| A UI element label (GNOME/GTK apps, needs `python3-pyatspi`) | `--element "Allow" --app "App"` |
| "wherever the mouse is" | `--mouse` |
| Second monitor | append `--display N` (0-based, XRandR order) |

Coordinates are global screen pixels, top-left origin — the same space
`xdotool`, `scrot` and `import` use. Screenshot with
`DISPLAY=:0 scrot shot.png` and read pixel positions to compute targets.
Unsure what a window is called? `xarrow elements [--match substring]`.

## Time-critical (code expires, page times out, job waits)

```bash
xarrow start --element "Verify" --text "Enter the 2FA code now, it expires in 60 s" \
  --color red --say
```

Say what and by when. One arrow per step: `stop` before pointing at the next thing.

## Sign and look

Full short sentence ("Click Allow", not "here"). `--say` speaks it (needs espeak).
`--color` red, orange, yellow, green, teal, blue, purple, pink, black, white or
#hex. `--duration N` (0 = until stopped — for `point` that blocks the
foreground, so prefer `start`). `--until-click` ends the arrow when the human
clicks the target. `--dry-run --json` prints the resolved target without drawing.

| Option | Values |
|---|---|
| `--style` | `arrow` (default), `ring`, `box` — ring/box mark a region without covering it |
| `--shape` | `bend` (default), `straight`, `zigzag` (urgent), `spiral` (impossible to miss) — arrows only |
| `--size` | `S`, `M` (default), `L` |
| `--corners` | `round` (default), `sharp` |
| `--border` | `shadow` (default), `white-black`, `black` |

## Installing (only if `xarrow` is not on PATH)

Prefer `uv tool install <repo> && uv tool install --reinstall` to refresh. On
machines without uv, `pip install <repo>` is the fallback.

## Errors

Exit 0 ok, 2 bad input, 3 target not found (the error lists the windows that
exist), 4 capability missing (e.g. `--element` without `python3-pyatspi`).
`xarrow doctor --json` reports display, compositor, monitors and speech.
Over SSH: `export DISPLAY=:0` (and `XAUTHORITY=/run/user/$UID/gdm/Xauthority`
under GDM).

## Setup once: clear arrows when the human answers

Point your agent harness's user-prompt hook at `xarrow stop` (e.g. a
`UserPromptSubmit` hook runs `xarrow stop --hook`), so arrows clear the moment
the human replies.