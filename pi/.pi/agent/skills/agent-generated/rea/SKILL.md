---
name: rea
description: Use the REA (Reverse Engineer Anything) CLI at ~/repos/rea to deterministically analyze websites, JavaScript/Electron apps, and native binaries — Ghidra-backed decompilation, evidence-sealed results. Run via `node scripts/rea.mjs`, no MCP needed.
---

# REA — Reverse Engineer Anything (CLI)

Local clone of https://github.com/morluto/rea (HN #2 trending, 2026-10-10) at
`/home/paul/repos/rea`. REA is a **deterministic** analysis toolbox — no LLM
inside. It runs local analysis (Ghidra, apktool, Playwright/CDP, …) and returns
hash-sealed Evidence JSON with exact locations, SHA-256 provenance, and honest
limitations. The agent (you) drives it via bash and interprets the evidence.

Key architectural fact: REA has **no model/harness configuration** — whatever
agent calls the CLI *is* the harness. Skip `rea-agents setup`/MCP entirely.

## Environment setup (required every session)

The repo rejects unsupported Node; paul's default is v25.2.1 which is NOT
supported. Use nvm's 24.12.0, and point at Ghidra:

```bash
source ~/.nvm/nvm.sh && nvm use 24.12.0 >/dev/null
export GHIDRA_INSTALL_DIR="$HOME/tools/ghidra"   # Ghidra 12.1.4 installed here
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
cd ~/repos/rea
node scripts/rea.mjs <command> ...
```

These env vars are also appended to `~/.zshrc` (marker: `REA_GHIDRA`), but
agent bash shells should export them explicitly.

Native binary analysis requires the Ghidra backend (installed 2026-10-10:
JDK 21 via apt in tmux pane, Ghidra 12.1.4 zip from GitHub releases).
`rea doctor` reports what's missing and why.

## Core CLI patterns

- Full command list: `node scripts/rea.mjs --help`; per-command help + global
  flags: `node scripts/rea.mjs <cmd> --help`
- Output control (important — evidence can be huge):
  - `--format json|yaml|md|toon|jsonl`
  - `--filter-output <keys>` — keep only key paths (e.g. `normalized_result.summary`)
  - `--token-limit <n>` / `--token-count` — cap/count output tokens
- Every result is an Evidence envelope: `evidence_id`, `subject` (with sha256),
  `provider`, `normalized_result`, `limitations` — read `limitations` before
  drawing conclusions; they are honest and specific.
- Errors are structured: `code`, `category`, `remediation` — read them, they
  usually tell you exactly what to fix.

## Workflow 1: Website analysis (verified on oann.com)

Passive, no JS execution, headless Chrome via CDP.

1. Start Chrome headless and load the target:
   ```bash
   google-chrome --headless=new --remote-debugging-port=9222 \
     --user-data-dir=/tmp/rea-chrome-profile --no-first-run about:blank &
   browser go example.com --port 9222   # browser skill CLI
   ```
2. List targets, note the page target id (NOT iframes):
   ```bash
   curl -s http://localhost:9222/json | jq -r '.[] | "\(.id) \(.type) \(.url)"'
   ```
3. Analyze the page bundle:
   ```bash
   node scripts/rea.mjs analyze-web-bundle http://127.0.0.1:9222 TARGET_ID \
     --observation-ms 4000 --format json > capture.json
   ```
4. For script sources (deeper analysis), inspect then export then analyze:
   ```bash
   node scripts/rea.mjs inspect-web-page http://127.0.0.1:9222 TARGET_ID \
     --observation-ms 3000 --include-script-sources --format json > inspect.json
   node scripts/rea.mjs export-web-scripts $PWD/inspect.json /tmp/site-scripts
   node scripts/rea.mjs analyze-javascript-application /tmp/site-scripts \
     --format json > app.json
   ```

Gotchas learned the hard way:
- **CDP endpoint must be `http://127.0.0.1:9222`** — `localhost` is rejected
  ("implicit ports / localhost are not valid CDP endpoints").
- `export-web-scripts` requires an `inspect_web_page` capture with retained
  script sources — the `analyze-web-bundle` capture does NOT retain sources.
- The `app.json` from a real site can be 300MB+ — use `--filter-output` or jq
  from the start; never cat it.
- Useful graph node kinds: `javascript-module`, `javascript-asset`,
  `endpoint` (mechanism-tagged calls with exact locations), `storage`, `worker`.
- Follow the browser skill's port-ownership rules; clean up the headless
  Chrome (pkill by `remote-debugging-port` pattern, delete profile dir) when done.

## Workflow 2: Native binary analysis (verified on /usr/bin/kitty)

```bash
node scripts/rea.mjs inspect /usr/bin/kitty          # overview + provider bind
node scripts/rea.mjs function /usr/bin/kitty main    # decompile one function
```

- Backend auto-selects Ghidra when `GHIDRA_INSTALL_DIR` is set; each query
  imports the target into an ephemeral Ghidra project (deleted on close).
- `function` returns: recovered signature, full pseudocode, assembly,
  def-use p-code, callees/callers, decompiler artifacts, and limitations.
- Stripped binaries work fine — `main` and libc calls are still recovered.
- Other useful native commands: `decompile`, `inspect-native-api`,
  `inspect-native-dispatch-metadata` (ObjC/Swift), `demangle-swift`,
  `inspect-binary-layout`, `address-to-file-offset`, `compare`.

## Workflow 3: JavaScript/Electron app (verified on a toy app)

```bash
node scripts/rea.mjs analyze-javascript-application <dir-or-asar>
```
Works backend-free (no Ghidra needed). Recovers module graph, Electron
IPC/boundary analysis, endpoint/storage observations. See the OANN run notes
above — same analyzer, same output shape.

## Blue-team notes (validated reasoning, not yet exercised)

Good fits: XSS sink surface mapping (innerHTML/eval/postMessage with exact
file:line+sha256 evidence), supply-chain tamper watch (`compare-web-captures`
on sealed captures — exact answer to "did any third-party script change"),
third-party/tracker inventory, `discover-webmcp-tools` for agent-facing page
declarations. NOT a scanner: no fuzzing/exploitation/server-side testing —
pair with Burp/ZAP for active DAST; prompt-injection judgment stays with the
agent, REA narrows the surfaces.

## Lessons learned (2026-10-10 session)

- Node version pin matters: v25.2.1 fails `npm install` (engines). Use 24.12.0.
- First build after clone: `npm install && npm run build:cached` (~2s after deps).
- `analyze-web-bundle` error `invalid_request/invalid_input` on a valid target
  almost always means the endpoint string, not the target — use 127.0.0.1.
- Ghidra native decompiler check requires a *full* JDK (javac), not JRE-only.
- For big evidence files, prefer `--filter-output` over post-hoc jq on 300MB JSON.
- Binary provenance so far: only trivial/small ELFs and one real site — treat
  larger targets (Android, firmware, .NET) as untested paths.

## Reusable helper

`scripts/rea-env.sh` (in this skill dir) exports the pinned environment —
`source` it before any `rea.mjs` call.
