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

The `browser` CLI is somewhat verbose as it is intended for AI agents. There are two patterns you will need to use again and again:

  * `browser` CLI makes no assumptions about where your chrome instance is running: it just needs a way to connect to it. For our purposes, you should assume the chrome debugging port is on localhost:9222. You should ALWAYS supply `--port 9222` as a flag in your arguments
  * If you leave `--tab` unspecified the browser CLI will assume you want to run in a new tab. You should only spin up new tabs for exceptional purposes - for the most part you should be doing your work in existing tabs. That means you should almost always be supplying a `--tab <tabId>` argument. This also has the advantage of being verbose: supply `--tab` every time means you will not forget what tab you are using for what purpose

Browser commands are hard to time. `browser` CLI bakes in a configurable timeout using `--timeout`. The default is 120 seconds (120000ms). You should start very small with this and use `--timeout 5000` for most commands. Only increase the timeout if the operation you are running in genuinely long running. 

Visual output from the browser is imperative! This let's you actually see the browser tabs and validate your work. You almost always want to have vision enabled. You should check this every time you spin up by navigating to hackernews, taking a screenshot of news.ycombinator.com, and reading that screenshot. If you cannot read the screenshot, give the user a gentle warning letting them know they may want to restart `pi-agent` with a language that has vision capabilities.
