---
name: senior-engineer
description: Opt-in “Superpowers” workflow that enforces deliberate engineering steps (brainstorm → plan → TDD → debug → review).
---

# Senior Engineer Workflow (Opt-In)

Use this skill only when the user explicitly requests a senior-engineer workflow, “superpowers mode,” or a highly structured process. Otherwise stay lightweight.

> **Opt-in only.** Do not enable this workflow unless the user asks for deep planning, wants “your senior engineer hat on,” or calls out Superpowers/TDD explicitly.

When activated, read the detailed checklists under the `superpowers/` subdirectory (e.g., [`brainstorm.md`](superpowers/brainstorm.md)). These files do **not** register as standalone skills, so they’ll only be used when this parent skill tells you to.

## Triggers
- User phrases like “treat this like a senior engineer,” “please use Superpowers,” “follow a rigorous process,” etc.
- Complex, high-stakes coding tasks where the user prefers thorough planning/testing over speed.

## When to Skip
- Quick fixes, single-file edits, or exploratory commands where overhead would slow progress.
- Tasks without user buy-in for the extra documentation.

## Workflow Checklist

1. **Clarify Goals**
   - Ask follow-up questions until requirements are crisp.
   - Document the goal in your plan (planning-with-files recommended for multi-step work).

2. **Brainstorm / Strategy** *(see [`superpowers/brainstorm.md`](superpowers/brainstorm.md) for detailed prompts)*
   - Generate multiple approaches (pros/cons) before coding.
   - Note key risks or unknowns.

3. **Plan (Outline + Tests)** *(see [`superpowers/plan.md`](superpowers/plan.md))*
   - Write a step-by-step plan, including test strategy.
   - If applicable, define expected test cases or acceptance criteria.

4. **Implement via TDD Loop** *(see [`superpowers/tdd.md`](superpowers/tdd.md))*
   - Red: write/adjust tests to fail.
   - Green: implement minimal changes to pass.
   - Refactor: clean up before moving on.
   - Log each loop in your progress notes.

5. **Systematic Debugging (if issues arise)** *(see [`superpowers/debugging.md`](superpowers/debugging.md))*
   - Gather evidence (logs, stack traces) before guessing.
   - Form hypotheses, run targeted experiments, document outcomes.
   - Avoid random changes without recorded reasoning.

6. **Review & Verification** *(see [`superpowers/review.md`](superpowers/review.md))*
   - Re-read the plan/requirements and ensure every checkbox is addressed.
   - Run the full test suite / manual steps.
   - Summarize results, remaining risks, and next steps.

## Tips
- Pair with `planning-with-files` to store the plan, findings, and progress logs.
- Mention explicitly when you’re entering/exiting “Senior Engineer” mode so the user understands the added structure.
- If the user later asks to “speed up” or “skip ceremony,” confirm before dropping the workflow.

## Learned Lessons

Any agent who uses this skill and uncovers new patterns (e.g., better TDD templates, debugging checklists) should document them here for future use.
