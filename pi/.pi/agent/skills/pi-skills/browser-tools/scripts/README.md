# Browser Tooling Scripts

This folder collects reusable automation helpers that build on top of the base browser tools. Each script follows the same conventions:

- **Purpose**: documented in the metadata header at the top of the file.
- **Usage**: include concrete CLI examples so other agents can copy/paste.
- **Dependencies**: only rely on tooling installed with this skill (Node, puppeteer, etc.).
- **Working directory**: scripts assume they are executed from the `browser-tools` directory unless noted otherwise.

## Available scripts

| Script | Description |
| --- | --- |
| `browser-term-send.js` | Fire-and-forget helper for sending commands into web terminals that expose `window.webTerminal.send`. Captures recent xterm output so you get quick textual feedback without leaving tmux. |

To add a new helper:

1. Drop it in this folder (subfolders are fine if the skill grows).
2. Start the file with a metadata header (purpose, usage, dependencies, working directory).
3. Update this README and the parent `SKILL.md` so discoverability stays high.
