---
name: subagents
description: Spawn and manage subagent workers in a dedicated tmux session — context isolation and derailment containment. Use when directed to delegate a task to a subagent.
---

# Subagents

Run worker pi agents in tmux so expensive or risky work happens in a throwaway
context instead of yours.

## What subagents are for (and what they are not)

Subagents buy exactly two things:

1. **Context isolation** (the big one). The worker reads the 300 files, digs
   through the giant log, or explores the unfamiliar repo in *its* context
   window. You receive only the distilled report. Parent context is the scarce
   resource — once it fills with tangential exploration, you get worse at your
   actual job for the rest of the session.
2. **Derailment containment**. The tangential problem gets solved (or fails) in
   a throwaway session. If the worker goes off the rails, you lose nothing; if
   it succeeds, you get the summary and artifacts.

Subagents are **not** for parallelism — while a worker runs you will usually be
synchronously babysitting it via capture-pane, which costs you context anyway.
They are also not for: tasks that need nuance from your conversation (your
context *is* the task), quick tasks, or anything requiring real back-and-forth
with the human (workers talk to you, not the human).

## The rule (v1)

**Only spawn a subagent when the human directs it.** If you believe a task
warrants one, propose it ("this research would burn ~50k tokens of my context —
want me to spin up a subagent?") and wait for yes. Do not spawn proactively.

## Naming standard

```
tmux session:  subagents                      ← all subagents live here
window:        <parent-tag>-<purpose>         ← e.g. 01a052e1-research
```

- `<parent-tag>`: first 8 chars of your session id (auto-derived by the spawn
  script from `PI_SESSION_FILE`; the `#` prefix is dropped — it is painful in
  shell and tmux targets)
- `<purpose>`: one word, describes the task — required so multiple workers per
  parent stay self-documenting in `tmux ls`
- Worker windows are **ephemeral**: kill yours when the task completes or
  fails. A lingering window means an unfinished report.

## Hygiene rules (non-negotiable — these come from real incidents)

- Workers always run with a **fresh cwd** (`/tmp/subagents/<window>/` by
  default). Never spawn a worker in a cwd where `pi` would auto-resume one of
  the human's real sessions.
- Worker sessions are contained: `--session-dir` points inside the worker cwd,
  so worker transcripts never mix with the human's session history.
- Every worker gets a **report contract**: it must write its final summary to
  `report.md` in its cwd, whether it succeeded or failed. You read the file —
  do not parse scrollback.

## Usage

### Spawn (helper script enforces naming, cwd, and report contract)

```bash
# write the task first (self-contained! the worker sees NOTHING of your
# conversation) — put it in the worker's PROMPT.md or pass a file:
~/.pi/agent/skills/subagents/scripts/spawn-subagent.sh \
  --purpose research \
  --prompt-file /tmp/my-task-prompt.md

# options:
#   --cwd <dir>          worker working dir (default /tmp/subagents/<window>/)
#   --model <pattern>    worker model, e.g. --model cheap  (default: pi default)
#   --print              run worker in non-interactive -p mode (exits when done)
```

The script prints the window name to use as the target for all follow-ups.

### Monitor

```bash
~/.pi/agent/skills/subagents/scripts/check-subagent.sh 01a052e1-research
# prints: window alive?, last 15 lines of pane, report.md status (none/partial/final)
```

Poll a few times (30s apart) rather than assuming. When `report.md` exists and
the pane is idle, read the report, then **kill the window**:

```bash
tmux kill-window -t subagents:01a052e1-research
```

### Writing the worker prompt

The worker starts with zero context. Its prompt must contain: the goal, any
file paths it needs, constraints, and the instruction to write `report.md`
(the spawn script appends the standard report-contract preamble automatically —
you write only the task). If you cannot write the prompt without referencing
"as we discussed" or "the bug from earlier", a subagent is the wrong tool.

## Manual fallback (if scripts are unavailable)

```bash
tmux new-window -t subagents -n <parent-tag>-<purpose> -c /tmp/subagents/<win> \
  "pi --session-dir /tmp/subagents/<win>/sessions -- '<one-line task: read PROMPT.md and execute it>'"
```

Prefer the script — it is easy to forget the session-dir containment.
