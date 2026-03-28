---
name: browser
description: Interact with google chrome instance via `browser` CLI program
---

# Browser CLI Skill

This skill allows you to interact with a chrome instance via a CLI program, `browser`.
`browser` is a stateless program that lets you run browser automation tasks. Browser
offers primitives such as:


```bash
# go to hackernews in a new tab
browser go news.ycombinator.com --port 9222
# list all tabs running in chrome
browser tabs --port 9222
# screenshot a tab
browser screenshot --port 9222 --tab <tabId>
```

# Installation and setup

1. The `browser` CLI should be available on the system PATH. Run `which browser` to confirm this. Complain if this causes an error
2. If `browser` CLI _is_ available, run `browser -h` and make sure it returns something
3. Confirm that a chrome instance is running AND exposing a remote debugging port on localhost:9222. Do NOT set this up yourself! That chrome instance should be managed by a human user; the human user is the only one who should start or stop this insance.

# Usage
## Controls
`Controls` are notes that document reliable workflows, selectors, and verifiers for specific sites using the `browser` CLI.
You should read `controls/README.md` now so you understand global control conventions.

Before interacting with a site, extract its domain and check for:

`controls/<domain>/controls.md`

If a controls file exists, use it before exploratory interaction.
If no controls file exists, proceed carefully and minimize trial-and-error.

When you discover reliable interaction patterns for a new site, ask the user before writing and then add:

`controls/<domain>/controls.md`

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
  click [options] <selector>        Click element (optionally navigate first with --url, or use --tab for existing tab)
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

  * ALWAYS supply --port 9222 as a flag in your arguments, unless the user specifies otherwise. `browser` CLI makes no assumptions about where your chrome instance is running: it just needs a way to connect to it
  * ALWAYS specify --tab if you want to perform multiple operations on the same tab. If you leave `--tab` unspecified the browser CLI will assume you want to run in a new tab. You should only spin up new tabs for exceptional purposes - clutter is bad!
  * ALWAYS specify --timeout 5000 initially to your commands. The default system timeout of 120 seconds is too long. You can always increase the timeout if needed. Increase in multiples of 2 (5s -> 10s -> 20s). Alert the user if you hit a command that times out after > 30s; that could indicate network instability that requires human intervention to fix

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
