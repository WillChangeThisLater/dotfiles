# pi-skills (dotfiles fork)
This directory is the curated set of pi skills I keep under `~/repos/dotfiles/pi/.pi/agent/skills/pi-skills`. It's forked from [badlogic/pi-skills](https://github.com/badlogic/pi-skills) but trimmed to the tools I rely on with pi-coding-agent (and Codex). The dotfiles repo symlinks this folder into `~/.pi/agent/skills/pi-skills`, so every machine gets the same skill loadout.

## Installation

### Using this dotfiles repo (recommended)
1. From the repo root, run `./install.sh` (or `stow -t ~ pi`).
2. Stow creates `~/.pi/agent/skills -> ~/repos/dotfiles/pi/.pi/agent/skills` alongside the tracked `~/.pi/agent/models.json`.
3. Restart pi-coding-agent so it re-discovers the skills on the next launch.

### Manual install / outside these dotfiles
If you only want the skills:
```bash
mkdir -p ~/.pi/agent/skills
rsync -a pi/.pi/agent/skills/pi-skills ~/.pi/agent/skills/
```
Then point your agent to `~/.pi/agent/skills/pi-skills`. Codex CLI can reuse the same tree via `~/.codex/skills/pi-skills`.

## Available Skills (current tree)

| Skill | Description |
|-------|-------------|
| [browser-tools](browser-tools/SKILL.md) | Interactive browser automation via Chrome DevTools Protocol. |
| [debugging](debugging/SKILL.md) | Repeatable debugging patterns (tmux panes, mitmproxy, rpdb, convo, reverse shells). |
| [gccli](gccli/SKILL.md) | Google Calendar CLI for listing calendars, viewing/creating/updating events, and checking availability. |
| [lynx](lynx/SKILL.md) | Text-based browser for quick searches and readable dumps of web pages straight from the terminal. |
| [meta](meta/SKILL.md) | Inspect the local pi harness (`~/repos/pi-mono`) to answer questions about commands, settings, or internals. |
| [planning-with-files](planning-with-files/SKILL.md) | Persistent `task_plan.md`/`findings.md`/`progress.md` workflow for long-running or multi-step tasks. |
| [senior-engineer](senior-engineer/SKILL.md) | Opt-in "Superpowers" workflow (brainstorm → plan → TDD → debug → review). |
| [tmux](tmux/SKILL.md) | Run all work inside dedicated tmux sessions, manage windows/panes, and capture pane output. |
| [web-search](web-search/SKILL.md) | Meta-skill combining browser-tools + lynx for web research with citation guidelines. |
| [youtube-transcript](youtube-transcript/SKILL.md) | Fetch timestamped YouTube transcripts for summarization or quoting. |

Verified directories under `pi/.pi/agent/skills/pi-skills/` as of 2026-02-04: `browser-tools`, `debugging`, `gccli`, `lynx`, `meta`, `planning-with-files`, `senior-engineer`, `tmux`, `web-search`, `youtube-transcript` (plus the shared `LICENSE`).

## Requirements & setup notes
- **browser-tools** – Requires Node.js plus a local Chrome/Chromium launched with `--remote-debugging-port=9222`. Run `npm install` inside `browser-tools/` (vendored `node_modules/` exist but reinstall after upgrades). The scripts (`browser-start.js`, `browser-nav.js`, `browser-eval.js`, `browser-screenshot.js`, `browser-pick.js`, `browser-cookies.js`, `browser-content.js`) assume Chrome is already listening on port `9222`.
- **debugging** – Depends on `tmux`, `mitmproxy`, `nc`, and optionally `ngrok`. The playbook walks through mitmproxy splits, rpdb breakpoints via `nc 127.0.0.1 4444`, `convo` pane summaries, and reverse-shell hygiene, so have those binaries installed.
- **gccli** – Install via `npm install -g @mariozechner/gccli`, then walk through the Google Cloud Console flow (enable Calendar API, create OAuth client, `gccli accounts credentials <json>`, `gccli accounts add <email>`). Config/state lives under `~/.gccli/`.
- **lynx** – Needs the `lynx` binary on `$PATH`. The skill highlights `lynx -dump -nolist`, DuckDuckGo Lite searches, cookie prompts, and optional tracing (`lynx -trace`), so ensure SSL/cookie prompts work in your environment.
- **meta** – Assumes `~/repos/pi-mono` exists so you can inspect the harness via `rg`, `read`, etc. without relying on upstream docs.
- **planning-with-files** – Tooling-light: just create/update `task_plan.md`, `findings.md`, and `progress.md` in each repo when the task is multi-step or user-requested.
- **senior-engineer** – No extra binaries, but this skill pulls in the local `superpowers/*.md` checklists (brainstorm, plan, TDD, debug, review). Activate only when the user explicitly opts in.
- **tmux** – Requires tmux 3.x+. The instructions cover session/window conventions, `tmux capture-pane`, `tmux pipe-pane`, and the Feb 2026 learned-lessons about mitmproxy workflows.
- **web-search** – Builds on `browser-tools` + `lynx`. You’ll need both installed to follow the query strategy, capture guidance, and `/tmp` artifact workflow outlined in the skill.
- **youtube-transcript** – Node.js project; run `npm install` once, then execute `{baseDir}/transcript.js <video-id-or-url>` for timestamped captions (videos must expose transcripts).

## Skill format
Each directory follows the same `SKILL.md` contract expected by pi-coding-agent / Codex:

```markdown
---
name: skill-name
description: Short summary shown to the agent
---

# Instructions
Detailed steps, helper scripts, and learned lessons.
```

Utility scripts live under each skill's folder and may reference `{baseDir}` to locate resources at runtime.

## Differences from upstream pi-skills
- Only the skills listed above are included; upstream tools like `brave-search`, `gdcli`, `gmcli`, etc. are removed.
- `browser-tools` keeps its `node_modules` checked in so fresh machines work offline after stowing.
- Documentation points to local paths (`~/repos/dotfiles`, `~/repos/pi-mono`) and includes personal workflows (e.g., tmux capture + mitmproxy tips from February 2026 learned-lessons).
- Skills such as `planning-with-files`, `senior-engineer`, and `web-search` emphasize workflow guidance tailored to how I run pi tasks, not just raw tooling notes.
- `senior-engineer/` carries the local-only `superpowers/*.md` checklists, and `tmux/SKILL.md` documents Feb 2026 learned lessons—neither set ships with upstream pi-skills.

## License
MIT (same as the upstream project).
