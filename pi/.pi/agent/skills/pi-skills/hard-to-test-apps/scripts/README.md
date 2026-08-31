# Scripts for hard-to-test-apps

Reusable testing helpers referenced from `SKILL.md`. Copy them out (or point
tests at them); they are intentionally dependency-free.

## Available scripts

- `kitty-input-probe.mjs` — byte-level probe for what a terminal actually sends.
  Enables the kitty keyboard protocol (flags 7), captures raw stdin for N
  seconds (default 6), writes a human-readable hex dump (with `ESC+[` markers)
  to a file or stdout.
  Usage: `node kitty-input-probe.mjs [timeout_sec] [outfile]`
  Run it *inside the terminal/app under test* (tmux pane, Xvfb terminal, SSH
  session) and trigger the keys you care about — press, hold, release, paste.
  This is how you answer "does this terminal report key releases?" definitively.

- `fake-backend-counter.sh` — deterministic stub for apps that shell out to a
  backend command (dictation, transcription, model CLIs). Prints a unique,
  incrementing line on every invocation and logs call count to
  `/tmp/fake-backend-count`, so logs prove *which* invocation ran and *whether*
  it ran at all.
  Usage: wire it into the app's backend env var, e.g.
  `PI_DICTATION_BACKEND=/path/to/fake-backend-counter.sh myapp`

## Contributing

Add scripts that were needed at least twice or cost >15 minutes to figure out.
Each script must: start with a metadata header (purpose, usage, deps, cwd
expectations), be copy-paste runnable, and be linked from this README.
See `../SKILL.md` for the workflows these support.
