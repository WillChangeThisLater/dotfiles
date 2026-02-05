---
name: planning-with-files
description: Use persistent markdown files (plan, findings, progress) to manage multi-step tasks and resume work reliably.
---

# Planning with Files

Whenever a task is large, multi-step, or the user explicitly requests detailed planning, create persistent markdown files inside the workspace. These files act as durable memory so you can pause, resume, and keep stakeholders informed.

> **Plan selectively.** Use this skill for complex tasks (roughly 3+ steps, cross-session work, or when the user asks for a plan/log). For quick fixes or single-file edits it’s overkill.

## Files

| File | Purpose |
| --- | --- |
| `task_plan.md` | Project overview, phases, checklist, current status |
| `findings.md` | Research notes, decisions, references, test data |
| `progress.md` | Chronological activity log (commands run, errors, next steps) |

Store them at the project root (or a `/notes` subfolder if the repo requires). Always mention their paths in summaries so the user can inspect them.

## Workflow

1. **Assess Need**
   - Ask yourself: is this multi-step, long-running, or user-requested? If yes, announce that you’ll set up planning files.
2. **Capture Context**
   - Confirm task goals with the user if anything is unclear before writing the plan.
3. **Create `task_plan.md`**
   - Suggested template:
     ```markdown
     # Task Plan – <project/task name>

     ## Goals
     - ...

     ## Phases / Checklist
     - [ ] Phase 1 – description
     - [ ] Phase 2 – description

     ## Risks / Questions
     - ...

     ## Definition of Done
     - ...
     ```
4. **Create `findings.md`**
   - Include sections for research, decisions, references, and open questions.
5. **Create `progress.md`**
   - Start with current timestamp, task summary, and first planned actions.
6. **Work Cycle**
   - Before major actions: re-read `task_plan.md` (note this in `progress.md`).
   - After meaningful work (or every ~2 commands): append to `progress.md` and log key insights in `findings.md`.
   - Update checkboxes/status in `task_plan.md` as milestones complete.
7. **Completion**
   - Ensure plan checkboxes are ticked, summarize outcomes, and highlight remaining follow-ups in `progress.md`.

## Helpful Commands

```bash
# Create file using heredoc
cat <<'EOF' > task_plan.md
# Task Plan – ...
EOF

# Append log entry
echo "## $(date -Iseconds)" >> progress.md
echo "- Ran tests, failures in ..." >> progress.md

# Quick view
sed -n '1,80p' task_plan.md
```

When editing inside tmux, use your editor of choice (`nano`, `vim`, etc.) or `tee -a` for append-only updates. Keep entries concise but actionable.

## Best Practices

- **Mini hooks:** add reminders like “Re-read plan before coding” at the top of `task_plan.md`.
- **Error tracking:** whenever something fails, log it (what happened + fix) under `progress.md` and reference it in `findings.md` if the insight matters later.
- **Cross-session resumes:** on reconnect, start by reading the three files and summarizing the current state to the user.
- **Version control:** if working inside a repo, stage these files (unless the user says otherwise) so history captures the plan.

## When Not to Use

- Simple one-off answers or single-command diagnostics.
- Tiny edits that won’t benefit from persistent memory.
- Tasks the user explicitly wants done quickly without extra documentation.

## Learned Lessons

Any agent who uses this skill and uncovers new workflows, edge cases, or improvements should document them here for future reference.
