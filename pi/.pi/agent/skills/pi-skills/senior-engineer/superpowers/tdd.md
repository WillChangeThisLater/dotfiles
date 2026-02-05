# Superpowers – TDD Module

> **Activation condition:** Only use these loops when the user explicitly wants the senior engineer / Superpowers workflow.

Red/Green/Refactor cadence:

1. **Red** – write or adjust a test that fails for the right reason. Document the test name and expected failure in `progress.md`.
2. **Green** – implement the minimal change to make the test pass. Capture commands/output (e.g., `pytest`, `npm test`) in logs.
3. **Refactor** – clean up duplication, naming, or structure while tests stay green.
4. Repeat for each requirement; keep a tally of loops so the user sees steady progress.

If the stack lacks automated tests, treat manual reproduction steps as “tests” and log the evidence each time.
