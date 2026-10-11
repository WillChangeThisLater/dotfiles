# Partner skills for browser

Skills that couple well with browser automation. This file is deliberately
separate from `SKILL.md`: the core skill doc stays focused and stable; interop
notes live here and change as the skill roster changes.

A skill qualifies as a partner when it shares this skill's *runtime surface* —
the chrome instance behind the CDP port, the X display chrome runs on, or the
human handoff loop.

## x11-gui-automation — where browser instances come from

`~/.pi/agent/skills/pi-skills/x11-gui-automation/SKILL.md` — isolated Xvfb
displays, one per (agent, app). Browser skill sessions usually run *inside* an
env claimed by that skill:

- The CDP port you attach to is registered in the env's state file
  (`x11_env.sh status`); the "CDP port selection" rules in `SKILL.md` are the
  interop contract with it.
- Screenshots via `browser screenshot` capture the *page*; screenshots of the
  display (`import -window root`, `scrot`) capture chrome's own chrome, dialogs
  and anything outside the viewport. Use both when automating beyond the page.
- If you need chrome relaunched, logged-in profiles, or a desktop around the
  browser, that is the x11 skill's territory — claim the env there and attach
  with `browser` here.

## xarrow — point at things for the human

`~/.pi/agent/skills/xarrow/SKILL.md` — draws a big, click-through arrow with a
sign on an X11 screen. Two uses inside browser work:

1. **Human handoff**: when a step needs the human's eyes or hands (2FA, consent
   screens, "which of these 14 tabs do you mean?"), draw the arrow on the
   browser's display and hand over the env's VNC command:

   ```bash
   DISPLAY=:99 xarrow start --at 800,500 \
     --text "Click Submit — page expires in 60s" --color red --size L \
     --duration 0 --say
   ```

   It is click-through and focus-free, so it never disturbs the session; it
   dies with your process (`XARROW_OWNER_PID=$$`), on `--duration`, or on
   `xarrow stop --all`.

2. **Coordinate debugging**: before an `xdotool`-driven click on a
   stubborn page element, `xarrow point --at X,Y --duration 2 --dry-run` /
   short arrow verifies the pixel you computed is the pixel you meant.

## Adding a new partner

Add a section above with: what it does, when in *this* skill's workflow an
agent should reach for it, one copy-paste example, and any safety notes
(shared ports/displays, cleanup, focus). Keep it short — this is a pointer
file, not documentation for the partner itself.