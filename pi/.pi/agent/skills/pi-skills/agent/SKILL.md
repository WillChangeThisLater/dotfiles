---
name: agent
description: Hand off token-intensive work to a headless pi agent (`agent "<task>"`) and get a concise result back. Only use when paul or the task explicitly directs it — never autonomously. Handles log trawling, broad searches, and summarizing big artifacts without flooding your context.
---

# agent — delegation, not exploration

**Hard rule: only run `agent` when explicitly directed to** — by paul or by a
task instruction that names it. Do not decide on your own that a task would be
better delegated; if you weren't told to use `agent`, do the work in-context.

`agent` is a headless pi instance. You hand it a task as an argument, it works
in its own context window, and you get back just the answer. Your context only
pays for the result, never the trawl.

## When to hand off (when directed, these are good fits)

Hand off when the *work of finding out* is bigger than the *answer*:

- **Log/session trawling** — "find sessions where X happened", "which old runs
  used tool Y", "what did agent Z do about W". Pi session logs live in
  `~/.pi/agent/sessions/` and total hundreds of MB — reading them in-context is
  the classic context-rot trap.
- **Broad searches** — "where in this repo is auth handled?", "which scripts
  reference `$TMPDIR`?" when you don't know the answer's size.
- **Summarizing big artifacts** — a long file, a build log, a diff, a directory
  of docs.
- **Throwaway investigation** — anything where you'd chain 10+ tool calls and
  keep none of the detail afterward.

Do it yourself (cheaply) when: the answer is one grep away, you need the raw
content in-context for follow-up work anyway, or the task mutates state
(unless you pass `--full`).

## Usage

```bash
# Basic handoff (read-only toolset: read, grep, find, ls)
agent "find pi sessions where the browser CLI tool failed or acted unexpectedly"

# Task that needs write access — opt in explicitly
agent --full "add a usage example to ~/repos/toolbox/README.md"

# Pipe stdin (great for pointing it at a specific artifact)
cat ~/.pi/agent/sessions/<dir>/<session>.jsonl | agent "summarize what went wrong in this session"

# Passthrough: model, thinking, and other pi flags flow through
agent --model haiku "what does src/config.py do? one paragraph"
```

Flags handled by the wrapper itself:

| Flag | Meaning |
|------|---------|
| `--full` | Unlock write/edit tools (default is read-only) |
| everything else | Passed straight to `pi -p` |

Sessions are saved to `~/.pi/agent/agent-runs/` — audit them if a result looks
wrong, but they stay out of your normal session list.

## Effort level

Say it in the prompt — there is no flag. The wrapper doesn't touch model or
thinking settings; your wording controls how hard the worker searches:

| Level | Phrasing | What the worker does |
|-------|----------|----------------------|
| minimal | "one-shot, minimal — answer from one or two lookups, don't iterate" | single tool call or pure reasoning |
| low | "a few targeted lookups, stop at the first adequate answer" | 2–5 calls, first decent answer wins |
| medium *(default when unspecified)* | (no need to say anything) | search until solid, verify surprises |
| high | "be thorough — multiple search strategies, cross-check, don't stop at the first hit" | sustained search, corroborates findings |
| extreme | "exhaustive — enumerate systematically, keep going until confident nothing is missed" | burns tokens on purpose, expects long runtime |

Rules of thumb: **minimal/low** for recall-style questions and single-artifact
summaries; **high/extreme** when a false negative is expensive (audits,
"has this ever happened?", pre-mortems).

## Result contract

Always specify the shape of the answer you want — the worker returns its final
message verbatim into your context, so make it count:

- "a concise list: session IDs + one-line summaries"
- "a table with file, line number, and what's wrong"
- "under 200 words, no preamble"
- "the exact command(s), nothing else"

Ask for *references* (session IDs, paths, line numbers) rather than quoted
content, so a follow-up `agent` run or a targeted `read` can chase details
without re-trawling.

## Chaining

For a big job, hand off the trawl first, then work the details yourself:

```bash
agent "list all pi sessions from the last two weeks that used the tmux skill, as a table: session id, date, task" 
# → pick interesting rows, then:
agent "in session <id>, what did the agent try after the first test failure? short answer"
```

Each run is independent — the worker has no memory of prior `agent` calls, and
no access to your context. Put everything it needs in the prompt.

## Examples from the wild

Real pi sessions where `agent` would have absorbed the token burn (result chars
= tool output that flooded the parent's context):

- **Repo-clutter survey** — "the repo is getting quite cluttered... do NOT
  remove or change anything, but flag files/folders that may be good cleanup
  candidates." Cost: 142 tool calls, 115K result chars, for a final answer
  that was a short list.
  ```bash
  agent "survey ~/repos/browser-cli and list files/dirs that look like cleanup candidates: path, why, risk level. Read-only, change nothing."
  ```
- **System security scan** — "do a security scan of my system. report anything
  suspicious: weird processes, strange open connections." Cost: 69 tool calls,
  114K result chars; the same task shape recurred across sessions.
  ```bash
  agent "security scan of this system: unusual processes, odd listening ports, suspicious cron entries. Report only findings, ranked by suspicion."
  ```
- **Docs audit** — "double check ALL the markdown docs to make sure the new
  system structure is understood." Cost: 310 tool calls, 201K result chars —
  exhaustive search, tiny report. Effort: extreme.
  ```bash
  agent "read every .md in ~/repos/i/docs and flag any doc whose description of the system structure is stale. Output: path + what's stale + suggested fix."
  ```
- **Recurring summaries** — "summarize all the skills i have globally for
  ~/.pi" was requested on three separate days (likely retries). A recurring,
  perfectly delegable job:
  ```bash
  agent "list every skill under ~/.pi/agent/skills with a one-line description. Table format."
  ```

## Pitfalls

- **Under-specified tasks come back wrong.** The worker can't ask you
  questions. Include paths, time ranges, and the expected output shape.
- **Don't hand off latency-critical steps.** A run takes tens of seconds to
  minutes. Fine mid-task; bad in a tight loop.
- **`--full` is a real handoff of write power** — keep the task narrow and the
  paths explicit.
- **Verify surprising results** by reading the worker's session under
  `~/.pi/agent/agent-runs/` before acting on them.
