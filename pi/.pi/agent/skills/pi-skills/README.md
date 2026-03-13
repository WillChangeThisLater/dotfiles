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
| [browser-tools](browser-tools/SKILL.md) | Interactive browser automation via Chrome DevTools Protocol—use it when you need to interact with web apps, test frontends, or provide the user a visible browser. |
| [debugging](debugging/SKILL.md) | Repeatable debugging patterns (tmux panes, mitmproxy, rpdb, convo, reverse shells) for tricky issues. |
| [gccli](gccli/SKILL.md) | Google Calendar CLI for listing calendars, viewing/creating/updating events, and checking availability. |
| [lynx](lynx/SKILL.md) | Text-based browser for quick searches and readable dumps of web pages straight from the terminal. |
| [introspection](introspection/SKILL.md) | Inspect the pi harness itself (`~/repos/pi-mono`) to answer questions about commands, settings, or internals. |
| [skill-creation](skill-creation/SKILL.md) | Process for proposing and authoring new skills under `~/.pi/agent/skills/agent-generated` based on lived experience. |
| [llm](llm/SKILL.md) | Workflows for Simon Willison's `llm` CLI (models, attachments, schemas, fragments, logs). |
| [local-llm-hosting](local-llm-hosting/SKILL.md) | Spin up and monitor llama.cpp `llama-server` instances (model sizing, tmux orchestration, health checks). |
| [planning-with-files](planning-with-files/SKILL.md) | Use persistent markdown files (plan, findings, progress) to manage multi-step tasks and resume work reliably. |
| [senior-engineer](senior-engineer/SKILL.md) | Opt-in “Superpowers” workflow that enforces deliberate steps (brainstorm → plan → TDD → debug → review). |
| [tmux](tmux/SKILL.md) | Run all work inside dedicated tmux sessions, manage windows/panes, and capture pane output. |
| [web-search](web-search/SKILL.md) | Meta-skill for researching the web with browser-tools + lynx, focusing on query strategy, source triage, and citations. |
| [youtube-transcript](youtube-transcript/SKILL.md) | Fetch transcripts from YouTube videos for summarization and analysis. |

Verified directories under `pi/.pi/agent/skills/pi-skills/` as of 2026-02-04: `browser-tools`, `debugging`, `gccli`, `lynx`, `introspection`, `skill-creation`, `llm`, `local-llm-hosting`, `planning-with-files`, `senior-engineer`, `tmux`, `web-search`, `youtube-transcript` (plus the shared `LICENSE`).

## Requirements & setup notes
- **browser-tools** – Requires Node.js plus a local Chrome/Chromium launched with `--remote-debugging-port=9222`. Run `npm install` inside `browser-tools/` (vendored `node_modules/` exist but reinstall after upgrades). The scripts (`browser-start.js`, `browser-nav.js`, `browser-eval.js`, `browser-screenshot.js`, `browser-pick.js`, `browser-cookies.js`, `browser-content.js`) assume Chrome is already listening on port `9222`.
- **debugging** – Depends on `tmux`, `mitmproxy`, `nc`, and optionally `ngrok`. The playbook walks through mitmproxy splits, rpdb breakpoints via `nc 127.0.0.1 4444`, `convo` pane summaries, and reverse-shell hygiene, so have those binaries installed.
- **gccli** – Install via `npm install -g @mariozechner/gccli`, then walk through the Google Cloud Console flow (enable Calendar API, create OAuth client, `gccli accounts credentials <json>`, `gccli accounts add <email>`). Config/state lives under `~/.gccli/`.
- **lynx** – Needs the `lynx` binary on `$PATH`. The skill highlights `lynx -dump -nolist`, DuckDuckGo Lite searches, cookie prompts, and optional tracing (`lynx -trace`), so ensure SSL/cookie prompts work in your environment.
- **introspection** – Assumes `~/repos/pi-mono` exists so you can inspect the harness via `rg`, `read`, etc. without relying on upstream docs.
- **skill-creation** – No binaries required, but mandates user approval and directs agents to store new skills under `~/.pi/agent/skills/agent-generated/` once they’ve proven a repeatable workflow.
- **llm** – Requires the `llm` CLI (install via uv/pipx/brew) plus provider API keys. Review Simon Willison’s docs/blog, keep logs in check (`llm logs path`), and obtain user approval before installing new `llm` plugins/fragments.
- **local-llm-hosting** – Assumes `llama-server` (llama.cpp) is installed with CUDA support, along with `tmux`, `nvidia-smi`, `curl`, and (optionally) `huggingface-cli` for model discovery.
- **planning-with-files** – Tooling-light: just create/update `task_plan.md`, `findings.md`, and `progress.md` in each repo when the task is multi-step or user-requested.
- **senior-engineer** – No extra binaries, but this skill pulls in the local `superpowers/*.md` checklists (brainstorm, plan, TDD, debug, review). Activate only when the user explicitly opts in.
- **tmux** – Requires tmux 3.x+. The instructions cover session/window conventions, `tmux capture-pane`, `tmux pipe-pane`, and the Feb 2026 learned-lessons about mitmproxy workflows.
- **web-search** – Builds on `browser-tools` + `lynx`. Make sure both are installed so you can run `lynx -dump -nolist` SERPs, drive Chrome via the helper scripts, save `/tmp` artifacts for citations, and (when needed) pair the workflow with `planning-with-files` to track multi-source research.
- **youtube-transcript** – Node.js project; run `npm install` once, then execute `{baseDir}/transcript.js <video-id-or-url>` for timestamped transcripts (videos must expose captions). The script prints `[mm:ss]` lines that you can quote directly in summaries.

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
- `introspection/` assumes the local `~/repos/pi-mono` fork is available for harness inspection, so those instructions point to machine-specific paths rather than upstream docs.
- `skill-creation/` codifies how and when agents should add new skills under `~/.pi/agent/skills/agent-generated/`, including the requirement for explicit user approval.
- `llm/` captures Simon Willison’s `llm` CLI workflows (attachments, schemas, fragments, plugin hygiene, logs) so agents can drive external models from the terminal.
- `local-llm-hosting/` standardizes how we choose GGUF quantizations, allocate VRAM, and operate llama.cpp `llama-server` in a dedicated tmux session.

## License
MIT (same as the upstream project).
