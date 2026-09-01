---
name: browser
description: Interact with google chrome instance via `browser` CLI program
---

# Browser CLI Skill

This skill allows you to interact with a chrome instance via a CLI program, `browser`.
`browser` is a stateless program that lets you run browser automation tasks. Browser
offers primitives such as:


```bash
# go to hackernews in a new tab (--port = the CDP port you resolved, see "CDP port selection")
browser go news.ycombinator.com --port 9222
# list all tabs running in chrome
browser tabs --port 9222
# screenshot a tab
browser screenshot --port 9222 --tab <tabId>
```

# Installation and setup

1. The `browser` CLI should be available on the system PATH. Run `which browser` to confirm this. Complain if this causes an error
2. If `browser` CLI _is_ available, run `browser -h` and make sure it returns something
3. Resolve which CDP port to use — see "CDP port selection" below. The default is 9222, but 9222 is NOT always yours.

# CDP port selection (read this before connecting — real incident 2026-09-01)

Multiple agents share this machine, and any of them may have registered its own chrome
instance on an Xvfb display. Port 9222 is a convention, not a reservation. Attaching to
someone else's browser makes you type into *their* session, and makes your tabs appear in
*their* VNC view — the victim experiences this as their browser being "hijacked".

Before your first browser command, resolve the port:

1. **If you are running in an x11 automation environment** (Xvfb + x11vnc, see the
   x11-gui-automation skill): use the CDP port registered for YOUR environment.
   Check the registry: `~/.pi/agent/skills/pi-skills/x11-gui-automation/scripts/x11_env.sh status`.
   If your environment has no chrome yet, start one with `--remote-debugging-port=<free port>`
   and register it in the env. Do not assume 9222 is yours.
2. **Otherwise (human's desktop chrome assumed)**: default to 9222, but verify nobody else
   owns it first:
   - `curl -s http://localhost:9222/json/version` — if this answers, SOME chrome is live on 9222.
   - Check whose it is: `~/.pi/agent/skills/pi-skills/x11-gui-automation/scripts/x11_env.sh status`
     (a live entry claiming 9222 = another agent's browser — do NOT attach), or ask the human.
   - If it's clearly the human's own chrome (they set it up for you), attach. If you cannot
     tell, ask before attaching.
3. **If the port is taken and you need your own browser**: pick a free port (9223, 9224, ...)
   and launch your own instance, e.g.
   `chrome --remote-debugging-port=9223 --user-data-dir=/tmp/chrome-9223-profile`.
   Use `--port 9223` on every browser CLI command.
4. **Hygiene while attached**: reuse one tab (`--tab`) instead of spawning new ones, close
   the tabs you opened when done, and never close tabs you did not open.

# Usage
## Controls
`Controls` are notes that document reliable workflows, selectors, and verifiers for specific sites using the `browser` CLI.
You should read `controls/README.md` now so you understand global control conventions.

Before interacting with a site, extract its domain and check for:

`controls/<domain>`

If a controls file exists, use it before exploratory interaction.
If no controls file exists, proceed carefully and minimize trial-and-error.

The pattern used to store controls is a bit murky.
Some sites only have a single controls.md file

    `controls/<domain>/controls.md`

Other sites are a bit more involved. These sites may contain lots of pages with nested levels of hierarchy. For instance,

```bash
paul-MS-7E16% tree testsite.org
myblog.org
├── README.md
└── blog
    ├── finance
    │   └── 1.php
    │       └── controls.md
    └── history-BFFM
        └── 1.php
            └── controls.md
```

You should run 'tree' on the top level domain to see the control layouts
When you see more complex layouts, be intuitive. For instance, in the site
above 'myblog.org/README.md' is likely to give you broad information about
site 'myblog.org' like who owns it, how it is structured, what ai agents
have done with this site in the past, etc. more concrete markdowns like
myblog.org/blog/finance/1.php will likely give you nitty gritty details
on how to interact with myblog.org/blob/finance/1.php

When you discover reliable interaction patterns for a new site you should consider adding them as controls so other agents can benefit from your learnings. You should get confirmation from the user before you do this.

If you update controls, keep entries concise and practical (quick start, key selectors, common patterns, known issues, verification).

## Conventions
You can see sample usage of `browser` by running the `browser -h` command. Here's what that returns as of 3-26-2026:

```
Usage: browser [options] [command]

Agent-optimized browser automation CLI

Options:
  -V, --version                     output the version number
  --browser <type>                  Browser type (chromium only for now) (default: "chromium")
  --headless                        Run in headless mode (default: false)
  --slow-mo <ms>                    Slow down actions (default: "0")
  --port <number>                   Connect to Chrome on port
  --host <host>                     Connect to Chrome on remote host (defaults to localhost) (default: "localhost")
  --ws <url>                        Connect via WebSocket URL
  --timeout <ms>                    Operation timeout in milliseconds (default: "30000")
  -h, --help                        display help for command

Commands:
  go [options] <url>                Navigate to URL (creates new tab, or use --tab to navigate existing)
  click [options] <target>          Click element (css:/text:/aria: targets; trusted input events;
                                    --verify <js> post-click check; --tab for existing tab)
  aim [options] <target> <path>     Screenshot with crosshair at where a click would land (no click)
  type [options] <selector> <text>  Type text into input (optionally navigate first with --url, or use --tab for existing
                                    tab)
  screenshot [options] <path>       Capture screenshot (optionally navigate first with --url, or use --tab for existing tab)
  eval [options] <code>             Execute JavaScript (optionally navigate first with --url, or use --tab for existing tab)
  inspect [options] [selector]      Inspect page elements (default: interactive only, --all: full DOM)
  scroll [options] [direction]      Scroll viewport (default: down, or: up, by, to)
  find [options] <text>             Find elements by text content
  wait-for [options] <selector>     Wait for an element to appear
  back [options]                    Go back in browser history
  forward [options]                 Go forward in browser history
  tabs                              List all open tabs in a Chrome instance
  close [options]                   Close a tab in a Chrome instance
  help [command]                    display help for command
```

The `browser` CLI is somewhat verbose as it is intended for AI agents. There are two patterns you should use again and again:

  * ALWAYS supply an explicit --port flag matching the port you resolved in "CDP port selection" (9222 only if you verified nobody else owns it). `browser` CLI makes no assumptions about where your chrome instance is running: it just needs a way to connect to it
  * ALWAYS specify --tab if you want to perform multiple operations on the same tab. If you leave `--tab` unspecified the browser CLI will assume you want to run in a new tab. You should only spin up new tabs for exceptional purposes - clutter is bad!
  * ALWAYS specify --timeout 5000 initially to your commands. The default system timeout of 120 seconds is too long. You can always increase the timeout if needed. Increase in multiples of 2 (5s -> 10s -> 20s). Alert the user if you hit a command that times out after > 30s; that could indicate network instability that requires human intervention to fix

## Clicking and aiming (preferred over eval-based clicks)

`browser click` supports three target kinds:

- `css:<selector>` (or a bare CSS selector) — e.g. `browser click "button[type=submit]"`
- `text:<substring>` — clickable element whose text contains the substring, e.g. `browser click "text:Save"`
- `aria:<label substring>` — element by aria-label, e.g. `browser click "aria:Close dialog"`

`click` resolves the **real hit-target** (if the matched element is hidden — e.g. a visually-hidden
`<input>` whose styled ancestor div is the actual click surface — it walks up to the visible
ancestor), scrolls it into view, and clicks its center using **trusted CDP input events**. It prints
JSON including the resolved element, rect, and center coordinates.

Why this matters: `eval "el.click()"` dispatches a *synthetic* event that React-style frameworks
frequently ignore or revert (form state gets re-synced and your click silently un-happens). Trusted
input events via `browser click` do not have this problem. Prefer it over eval clicks.

Two verification options:

- `--verify "<js>"` — evaluate a JS expression after the click and return it, e.g.
  `--verify "document.querySelector('input[type=checkbox]').checked"`. Use it to confirm the click
  had its intended effect in the same command.
- `browser aim <target> <path>` — **no click**. Injects a crosshair into the live DOM at the point a
  click would land, screenshots, removes the marker, and prints the rect/center. Use it when you are
  about to click at the X11 level (xdotool) or want to confirm targeting before an irreversible
  click. The returned viewport coordinates + window geometry are the correct input for xdotool —
  NEVER eyeball pixel coordinates from a plain screenshot.

```bash
browser aim "text:Submit application" /tmp/aim.png --tab <tabId> --port 9222
# read /tmp/aim.png — crosshair should sit on the button
browser click "text:Submit application" --tab <tabId> --port 9222 --verify "document.body.innerText.includes('Thanks')"
```

## eval hygiene

- The `eval` execution context **shares globals across calls** in a tab. Top-level `const x` in one
  call collides with the next (`Identifier 'x' has already been declared`). Always wrap eval code in
  an IIFE: `browser eval "(() => { ... })()"`.

## Workflow (required)

When exploring or interacting with unfamiliar pages, use this exact evaluation loop for every meaningful action:

1. **Run one command**
   - Execute a single browser action (`go`, `click`, `type`, `eval`, etc.)
2. **Take a screenshot immediately**
   - Save to `/tmp/` with a descriptive name
3. **Read the screenshot**
   - Inspect the image and verify whether the intended state change actually happened

Repeat this loop until the task is complete.

Visual verification is mandatory. Do not assume an action succeeded based only on command output.
If screenshot reading is unavailable, warn the user and proceed cautiously with additional checks (`window.location.href`, element existence, page title), but still prefer screenshots whenever possible.

Example loop:

```bash
browser click "button[type='submit']" --tab <tabId> --port 9222 --timeout 5000
browser screenshot /tmp/after_submit.png --tab <tabId> --port 9222
# read /tmp/after_submit.png and confirm expected UI state before next action
```
