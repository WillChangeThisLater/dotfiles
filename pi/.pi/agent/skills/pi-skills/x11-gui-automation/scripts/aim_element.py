#!/usr/bin/env python3
# aim_element.py — locate UI elements in full-res screenshots for pixel-accurate clicks.
#
# Purpose: the agent must never estimate absolute pixel coordinates by eye — screenshot
# attachments the agent views may be downscaled previews of the real file, and eyeballed
# coords miss small buttons (~40px observed on a 40px-tall Steam Install button). This
# tool does the coordinate math programmatically on the full-res PNG so xdotool clicks
# are exact.
#
# Usage:
#   aim_element.py shot.png --probe X Y [--tol 40] [--top 3]
#       Sample the color at (X,Y), find connected regions of similar color, print each
#       component's bbox/center sorted by pixel count (largest first, up to --top).
#   aim_element.py shot.png --grid out.png [--step 100]
#       Draw a labeled grid overlay (labels are real-pixel coordinates — safe to read
#       off even a downscaled preview).
#   aim_element.py shot.png --zoom out.png X Y [--radius 200]
#       Write a native-resolution crop centered on (X,Y) to out.png.
#       Small images pass through attachments without downscaling — zoom before judging
#       fine detail.
#
# Output (probe mode): one line per component:
#   component N: bbox=x0,y0-x1,y1 center=(cx,cy) size=(w,h) px=count
# Feed the center straight into: xdotool mousemove --sync <cx> <cy> click 1
#
# Deps: python3 + Pillow (no numpy). Working dir: anywhere (paths used as given).

import argparse
import sys
from collections import deque


def load(path):
    from PIL import Image
    im = Image.open(path).convert("RGB")
    return im, im.load(), im.size[0], im.size[1]


def find_components(px, w, h, color, tol):
    """Single pass for matches + BFS connected components among matched pixels."""
    cr, cg, cb = color
    matched = set()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - cr) <= tol and abs(g - cg) <= tol and abs(b - cb) <= tol:
                matched.add((x, y))
    comps = []
    seen = set()
    for seed in matched:
        if seed in seen:
            continue
        q = deque([seed])
        seen.add(seed)
        x0 = x1 = seed[0]
        y0 = y1 = seed[1]
        n = 0
        while q:
            x, y = q.popleft()
            n += 1
            x0 = min(x0, x); x1 = max(x1, x)
            y0 = min(y0, y); y1 = max(y1, y)
            for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1),
                           (x+1, y+1), (x-1, y-1), (x+1, y-1), (x-1, y+1)):
                if (nx, ny) in matched and (nx, ny) not in seen:
                    seen.add((nx, ny))
                    q.append((nx, ny))
        comps.append((n, (x0, y0, x1, y1)))
    comps.sort(reverse=True)
    return comps


def cmd_probe(args):
    im, px, w, h = load(args.image)
    if args.color:
        color = tuple(int(v) for v in args.color.split(","))
        print(f"color-mode color={color} tol={args.tol} image={w}x{h} (probe point not sampled)", file=sys.stderr)
    else:
        color = px[args.x, args.y]
        print(f"probe=({args.x},{args.y}) color={color} tol={args.tol} image={w}x{h}", file=sys.stderr)
    comps = find_components(px, w, h, color, args.tol)
    shown = 0
    for n, (x0, y0, x1, y1) in comps:
        if n < 50:  # ignore specks
            continue
        cw, ch = x1 - x0 + 1, y1 - y0 + 1
        print(f"component {shown}: bbox={x0},{y0}-{x1},{y1} "
              f"center=({(x0+x1)//2},{(y0+y1)//2}) size=({cw},{ch}) px={n}")
        shown += 1
        if shown >= args.top:
            break
    if shown == 0:
        print("no components found (probe may sit on a gradient/antialiased edge — try --tol higher)")
        return 1
    return 0


def cmd_grid(args):
    from PIL import Image, ImageDraw
    im = Image.open(args.image).convert("RGB")
    d = ImageDraw.Draw(im)
    step = args.step
    for x in range(0, im.width, step):
        d.line([(x, 0), (x, im.height)], fill=(255, 0, 0))
        for y in (0, im.height - 12):
            d.text((x + 2, y), str(x), fill=(255, 0, 0))
    for y in range(0, im.height, step):
        d.line([(0, y), (im.width, y)], fill=(255, 0, 0))
        d.text((2, y + 2), str(y), fill=(255, 0, 0))
        d.text((im.width - 40, y + 2), str(y), fill=(255, 0, 0))
    im.save(args.out)
    print(f"grid overlay (step={step}) written to {args.out} — labels are real-pixel coordinates")
    return 0


def cmd_zoom(args):
    from PIL import Image, ImageDraw
    im = Image.open(args.image).convert("RGB")
    r = args.radius
    x0, y0 = max(0, args.x - r), max(0, args.y - r)
    box = (x0, y0, min(im.width, args.x + r), min(im.height, args.y + r))
    crop = im.crop(box)
    if args.crosshair:
        d = ImageDraw.Draw(crop)
        cx, cy = args.x - x0, args.y - y0
        d.line([(cx - 20, cy), (cx + 20, cy)], fill=(255, 0, 0), width=2)
        d.line([(cx, cy - 20), (cx, cy + 20)], fill=(255, 0, 0), width=2)
        crop.save(args.out)
        print(f"crop saved to {args.out}; crop origin=({x0},{y0}) target=({args.x},{args.y}) "
              f"crosshair in crop at ({cx},{cy})")
        print(f"CONVERSION: full_image = crop_origin + crop_offset, i.e. ({x0},{y0}) + crop pixel")
    else:
        crop.save(args.out)
        print(f"native-res crop {box} written to {args.out} (no downscaling expected at this size)")
        print(f"CONVERSION: full_image = crop_origin + crop_offset, crop origin=({x0},{y0})")
    return 0


def main():
    p = argparse.ArgumentParser(description="Locate UI elements in full-res screenshots for pixel-accurate clicks.")
    p.add_argument("image")
    p.add_argument("--probe", nargs=2, type=int, metavar=("X", "Y"))
    p.add_argument("--color", metavar="R,G,B", help="match this exact color instead of sampling the probe point")
    p.add_argument("--tol", type=int, default=40)
    p.add_argument("--top", type=int, default=3)
    p.add_argument("--grid", metavar="OUT")
    p.add_argument("--step", type=int, default=100, help="grid spacing for --grid mode")
    p.add_argument("--zoom", nargs=3, metavar=("OUT", "X", "Y"))
    p.add_argument("--radius", type=int, default=200)
    p.add_argument("--crosshair", action="store_true", help="draw a crosshair at (X,Y) in the zoom crop and print conversion math")
    args = p.parse_args()

    if args.probe or args.color:
        args.x, args.y = args.probe if args.probe else (-1, -1)
        sys.exit(cmd_probe(args))
    if args.grid:
        args.out = args.grid
        sys.exit(cmd_grid(args))
    if args.zoom:
        args.out, args.x, args.y = args.zoom[0], int(args.zoom[1]), int(args.zoom[2])
        sys.exit(cmd_zoom(args))
    p.print_help()
    return 1


if __name__ == "__main__":
    main()
