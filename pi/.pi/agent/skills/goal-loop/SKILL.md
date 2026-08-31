---
name: goal-loop
description: EXPERIMENTAL. Autonomous implementor/evaluator loop — run a pi agent headless on a goal file until an independent evaluator verifies the evidence. Only for mechanically verifiable goals.
---

# goal-loop (EXPERIMENTAL)

> **Status: experimental.** Validated against a 4-case test ladder
> (happy path, lazy-implementor rejection, blocked-surface, impossible-goal
> termination) but not yet hardened by daily use. Expect rough edges; review
> its work before trusting it.

An implementor agent works on a goal headlessly; when it claims done, an
*independent* evaluator agent actively verifies the evidence (runs the tests
itself — it does not trust the implementor's claims). On FAIL, the implementor
is re-prompted with the failure reason in the same session. The human is only
pulled in for blocked decisions, PASS review, or budget exhaustion.

**Use it for**: goals with a mechanically checkable end state (tests pass, file
matches spec, command output correct, repo pushed). **Do not use it for**:
design, taste, open-ended research without a finish line.

## Usage

```bash
# goal file format below; state in /tmp/goals/<tag>/
goal-loop.sh start mytask.md [--max-rounds 3] [--cwd <dir>] [--timeout-mins 30]

goal-loop.sh watch mytask      # live-view the implementor's session stream
```

Exit codes: `0` = VERDICT: PASS (work is in `--cwd`, review it), `2` = BLOCKED
(human decision needed, reason printed), `3` = budget exhausted, `1` = other error.

## goal.md format

```markdown
## Goal
<one measurable end state>

## Evidence
<commands/outputs that prove it — this is what the evaluator will check>

## Constraints
<what must not be done on the way there>
```

The script prepends an implementor contract: end the final message with
`STATUS: DONE` (evidence surfaced) or `STATUS: BLOCKED: <question>` (needs a
human decision — never guess). The evaluator is instructed to actively verify
and end with `VERDICT: PASS`, `VERDICT: FAIL — <reason>`, or
`VERDICT: IMPOSSIBLE — <why>`.

## Design notes

- **No LLM in the orchestration layer**: the supervisor is a bash loop; all
  intelligence lives in the two pi sessions. Verdicts/STATUS are parsed from
  their final messages.
- **Fresh evaluator each round** (no sunk-cost bias); prior verdicts are fed
  in as text so it can spot repeat-fail patterns. Implementor *keeps* its
  session (`pi -p -c`) across rounds — it remembers what it tried.
- **The evaluator must be read-only** — this was a real bug found in testing:
  an unrestricted evaluator fixed the broken work itself and ruled PASS,
  hiding the implementor's failure. Read-only enforcement is prompt-level
  (v1); if it ever misbehaves again, the escalation is running the evaluator
  in a separate read-only mount of the workdir.
- **Budgets**: `--max-rounds` on evaluations, plus a per-call timeout.
- **Worktree containment**: default cwd is `/tmp/goals/<tag>/work/` (same
  lesson as the subagents skill — never spawn into a cwd where pi would
  auto-resume a human session). Point `--cwd` at a git worktree for real repos.
- **Observability**: everything tee'd under `/tmp/goals/<tag>/logs/`;
  `watch` tails the implementor's session JSONL. Interactive takeover is safe
  exactly at round boundaries (never while a `pi -p` is mid-flight — two
  writers on one session file is undefined).

## Test ladder (validation)

1. **Happy path**: trivial goal, PASS in one round.
2. **Lazy implementor**: seeded failing test; evaluator must reject a
   premature DONE and the loop must recover.
3. **BLOCKED**: goal references a decision only the human can make; loop must
   stop in round 1 and surface the question.
4. **Impossible**: goal whose test suite contains an intentional wrong
   assertion; loop must terminate honestly without the evaluator rubber-
   stamping a "fix" that edits the test.
5. **Mini port (validated 2026-08-30)**: ported docopt (~900 lines of dense
   parsing logic) to TypeScript in a single implementor round (~30 min). The
   goal's parity harness (178 fixture cases through both implementations,
   byte-diffed) passed 178/178 on first evaluation, plus 20 self-probed
   adversarial cases by the implementor and 4 independent evaluator-style
   probes (repeat counting, defaults, user-error parity) run by the human.
   Evidence rubric was pre-built by the human so the implementor could not
   redefine done — believed to be the decisive factor.

## Provenance

Designed 2026-08-30 from Claude Code's `/goal` docs, `jthack/claude-goal`
(stop-hook + runaway-guard precedent), the RepoMirror overnight-port field
report (commit-per-edit, scratchpad, budget heuristics), and Huntley's Ralph
loop — with two additions none of them have: an independent evaluator with
active verification, and BLOCKED as a first-class outcome.
