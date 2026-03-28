# Script Pattern for `local-llm-hosting`

Use this directory to capture **agent-generated helper scripts** that pair with the `local-llm-hosting` skill. These scripts automate repeatable tasks such as model validation, performance checks, or health monitoring.

## Conventions

- **Directory per scenario or model family**
  - Example: `qwen3-coder-30b/`, `deepseek-r1/`
  - Keeps multi-file workflows organized (e.g., shell script + config template)
- **Script naming**: `verb-purpose.sh`
  - e.g., `measure-throughput.sh`, `probe-context.sh`
- **Metadata header** inside each script (comment block)
  - include: purpose, dependencies, expected tmux pane/session, sample invocation
- **Link back** from `MODEL_LOG.md`
  - When logging a model run, reference the script path so future operators know which tools were used

## Checklist When Adding a Script
1. Confirm it runs from repo root or explain required working directory
2. Keep dependencies to built-in tools whenever possible (bash, curl, jq)
3. Make execution idempotent—avoid destructive operations
4. Document output format so results can be pasted into `MODEL_LOG.md`

## Example Layout
```
local-llm-hosting/
  scripts/
    qwen3-coder-30b/
      measure-throughput.sh
      probe-context.sh
    shared/
      monitor-vram.sh
```
Feel free to extend as new models or checks come online; just follow the structure above so every script is easy to discover and reuse.
