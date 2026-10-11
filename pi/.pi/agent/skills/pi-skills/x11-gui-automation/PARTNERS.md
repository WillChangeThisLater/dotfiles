# Partner skills for x11-gui-automation

Skills that couple well with X11 automation environments. This file is
deliberately separate from `SKILL.md`: the core skill doc stays focused and
stable; interop notes live here and change as the skill roster changes.

A skill qualifies as a partner when it operates on the same *display* an
automation environment owns (its `$DISPLAY`, its VNC port, its state file)
rather than on the host desktop.

## xarrow — point at things on the env's display

`~/.pi/agent/skills/xarrow/SKILL.md` — draws a big,
click-through arrow with a sign on an X11 screen. Installed as an agent
skill named `xarrow` (source: `~/repos/xarrow`).

**When to reach for it:** the escalation ladder in `SKILL.md` ends with
"ask the human with the exact vncviewer command." For the common case —
*which button / item / spot do you mean?* — an arrow is a better handoff
than a screenshot hunt:

```bash
# inside a claimed env (use the env's DISPLAY, from the state file):
DISPLAY=:99 xarrow start --at 800,500 --text "Click Submit — page expires in 60s" \
  --color red --size L --duration 0
# human sees it via the env's normal vncviewer port; nothing else changes
```

Key properties that make it safe here: fully click-through (it never eats
clicks meant for the app under test), never takes focus (won't disturb
xdotool-driven interactions), dies with your process
(`XARROW_OWNER_PID=$$ xarrow start …`) or on `--duration`/`stop --all` — so
an abandoned arrow can't linger in a shared env.

**Targets come from the same evidence you already have:** screenshot pixels
(`--at X,Y`, `--rect X,Y,W,H`), window titles (`--window "Title"`),
or `--dry-run --json` to verify coordinates before drawing.

If the xarrow skill is not installed, skip this and use the plain
ask-for-eyes protocol — nothing else changes.

## Adding a new partner

Add a section above with: what it does, when in *this* skill's workflow an
agent should reach for it, one copy-paste example using the env's DISPLAY/
state file, and any safety notes (shared displays, cleanup, focus). Keep it
short — this is a pointer file, not documentation for the partner itself.