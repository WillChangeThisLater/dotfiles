# Superpowers – Debugging Module

> **Activation condition:** Only follow this systematic debugging flow when Superpowers mode is active.

1. **Observe** – collect logs, stack traces, screenshots, or repro steps before changing anything.
2. **Hypothesize** – write down what you think is wrong and why.
3. **Experiment** – run a targeted test (toggle a flag, add logging, isolate a component). Record commands and outcomes.
4. **Conclude** – update `findings.md` with what you proved/disproved.
5. **Fix** – implement the change, rerun the relevant tests, and confirm the original failure no longer occurs.
6. **Regressions** – run a quick sanity check of related functionality before moving on.
