# capatcha.md (captcha micro-skill)

Purpose: fast, reliable captcha solving loop in isolated X11 sessions (`DISPLAY=:N`) using screenshot verification after every click.

## Core rules
1. **Break into tiny steps**
   - One action at a time: observe -> click -> observe.
   - Never batch many clicks unless target set is obvious and pre-validated.

2. **Use explicit coordinate maps**
   - For grids (3x3, 4x4), estimate bounds, compute tile centers, and click centers only.
   - When precision matters, generate a temporary overlay grid and label cells.

3. **Always verify after each phase**
   - Capture screenshot before and after major actions.
   - Confirm challenge text changed / checkmarks appeared / level advanced.

4. **Recover from mistakes explicitly**
   - If over-clicked, unclick specific wrong tiles using exact tile centers.
   - Prefer corrective clicks over reset/start-over when possible.

## Working loop
1. Screenshot current challenge.
2. Identify challenge type (`checkbox`, `select tiles`, `rotation`, `text/audio`, etc.).
3. If tile challenge:
   - estimate board bounds,
   - compute centers,
   - click only intended tiles,
   - verify selected markers,
   - submit.
4. If uncertain, pause and re-screenshot before submitting.

## Known challenge notes
- **Tile selection**: precision is critical; center clicks reduce edge ambiguity.
- **Text/audio weirdness**: prompt may be delayed/blank; use in-widget refresh icon (not global reset) first.
- **Rotation puzzles**: solve incrementally; rotate one tile, verify seam continuity, continue.

## Useful command snippets
Capture:
```bash
ffmpeg -y -f x11grab -video_size 1920x1080 -i :2 -frames:v 1 /tmp/captcha.png
```

Example click:
```bash
DISPLAY=:2 xdotool mousemove <x> <y> click 1
```

## Session heuristics that worked
- For ambiguous tasks, user-guided micro-steps dramatically improved reliability.
- "Open menu -> verify" style decomposition generalizes to captcha interactions.
- Precision + verification outperforms speed for completion rate.
