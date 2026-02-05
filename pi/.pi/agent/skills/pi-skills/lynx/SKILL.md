---
name: lynx
description: Text-based browser for quick searches and readable dumps of web pages straight from the terminal.
---

# Lynx Web Browser

`lynx` is a terminal-only browser. It renders HTML as text, does **not** execute JavaScript, and is ideal for quickly searching the web or dumping readable page content without leaving the shell.

## Requirements

- `lynx` installed and available in `$PATH` (check with `lynx -version`).
- Network access. HTTPS works out of the box; use `-accept_all_cookies` if you want to bypass cookie prompts.

## Quick Start (Interactive Mode)

```bash
lynx https://example.com
```

Key bindings (shown in the on-screen help bar):
- Arrow keys: Up/Down to move, Right to follow a link, Left to go back.
- `g`: open the "Go to URL" prompt.
- `/`: search within the current page.
- `q`: quit (confirm with `y`).

Because Lynx cannot run JavaScript, modern sites may show "browser unsupported" banners. Prefer static or "lite" endpoints when possible.

## Searching the Web

Google’s default interface often blocks Lynx. Use lightweight search endpoints instead:

```bash
QUERY="hacker+news"
lynx "https://duckduckgo.com/lite/?q=${QUERY}"
```

Tips:
- `duckduckgo.com/html` or `/lite/` render well in Lynx and support arrow-key navigation between results.
- From within Lynx, press `g`, enter `https://duckduckgo.com/lite/?q=SEARCH+TERMS`, and hit Enter.
- Accept cookies when prompted (press `y` or `A` to always accept for the domain) to avoid repeated dialogs.

## Dumping Pages to Text

For a quick, non-interactive snapshot, use `-dump` together with `-nolist`:

```bash
lynx -dump -nolist https://news.ycombinator.com/ > /tmp/hn.txt
```

- `-dump` prints the rendered text to stdout.
- `-nolist` hides the numbered link list appended by default, keeping output concise.
- Combine with `rg`, `sed`, or editors to extract the info you need.

## Handling Cookies & Certificates

- Accept all cookies automatically: `lynx -accept_all_cookies URL`.
- Ignore certificate warnings (only if you trust the site): `lynx -validate=0 URL`.
- For repetitive workflows, export `LYNX_COOKIE_FILE` to reuse cookie storage between runs.

## Debug / Logging

- Press `=` inside Lynx to view document info (URL, content type, headers).
- Use `lynx -trace` to write request/response traces to `Lynx.trace` (helpful when sites misbehave).

## Learned Lessons

Any agent who uses this skill and uncovers new workflows, edge cases, or best practices should document them here for future reference.
