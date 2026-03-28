---
name: pi-harness-introspection
description: Inspect the pi harness itself (~/repos/pi-mono) to answer questions about commands, settings, or internals.
---

# Pi Introspection Skill

Use this skill whenever you or the user needs to understand how the pi harness works internally (commands like `/session`, startup behavior, skill loading, etc.). It guides you to examine the local pi source tree (`~/repos/pi-mono`, forked from `badlogic/pi-mono`) and relevant documentation.

## When to Use
- User asks “How does `/session` work?” “Where are sessions stored?” “How does skill discovery happen?”
- A question arrives that feels “out of band” (unrelated to current coding task) and might refer to pi’s own features or commands.
- You need to confirm implementation details about pi commands, modes, or settings.
- Debugging or extending the harness requires reading its source or docs.

## Repository Layout
- `~/repos/pi-mono/` – full pi mono-repo fork
  - `packages/pi-coding-agent/` – main CLI + agent harness code (Node.js/TypeScript)
  - `docs/` – markdown docs mirrored under the installed npm package (`~/.nvm/.../node_modules/@mariozechner/pi-coding-agent/docs`)
  - `examples/`, `extensions/`, etc. for reference implementations

## Workflow

1. **Confirm Context**
   - Ask the user what they already know and what level of detail they need (high-level summary vs. code-level explanation).

2. **Locate Source**
   - Use `rg`, `ls`, or `find` inside `~/repos/pi-mono` to discover relevant files:
     ```bash
     cd ~/repos/pi-mono
     rg -n "/session" -g"*.ts"
     ```
   - For docs, start with `docs/` or the npm-installed README (`~/.nvm/.../README.md`).

3. **Read Before Editing**
   - Use the `read` tool to inspect files (per harness rules, don’t `cat`).
   - Take note of key functions, modules, or commands.

4. **Summarize Findings**
   - Provide a clear explanation referencing the files inspected (paths + relevant sections).
   - Quote or paraphrase the code/README as needed.

5. **Answer Follow-up Questions**
   - If something is unclear, keep searching the repo (e.g., `rg "new Session"` or `rg "BrowserTools"`).

## Session History
- Pi stores prior agent sessions under `~/.pi/agent/sessions/` (JSON files per session). Use `ls` plus `read` to inspect these when a user references earlier conversations or wants a synthesized summary of past work.
- Keep scope in mind: only surface cross-session details when the user explicitly asks for them, and summarize rather than dumping entire logs.
- Combine history checks with repository inspection when you need to recall decisions, commands run, or explanations given previously.

## Tips
- If a user question feels unrelated to the current repo (“What does `/session` do?” during a coding task), pause and consider whether it’s an introspection request before proceeding.
- Combine this skill with `planning-with-files` if your investigation spans multiple files or needs documentation for future reference.
- When exploring the same topic repeatedly, consider creating notes under `/home/paul/.pi/agent/skills/introspection-notes/` (or similar) so future you can follow faster.
- If the code points to upstream `badlogic/pi-mono`, note the git remote or commit references so the user can sync.

## Learned Lessons

Document useful file locations, command internals, or debugging tricks here as you uncover them. This becomes a living index for self-inspection.
