# Scripts for subagents

Helper scripts referenced from `../SKILL.md`. They exist so agents can't get
the naming/cwd/session-containment details wrong.

- `spawn-subagent.sh` — spawn a worker pi in `subagents:<parent-tag>-<purpose>`.
  Enforces the naming standard, fresh cwd under `/tmp/subagents/`, session
  containment (`--session-dir` inside the worker cwd), and prepends the
  report-contract preamble to the task.
- `check-subagent.sh` — one-shot status: window alive/dead, last 15 pane lines,
  and whether `report.md` has been written.

## Contributing

Keep these scripts boring and strict: they are guardrails, not conveniences.
Any new flag must preserve the invariants (naming, containment, report
contract). Link new scripts here and in SKILL.md.
