---
name: llm-cli-tool
description: Workflows for Simon Willison's `llm` CLI—prompts, chat, attachments, schemas, fragments, plugins, and logs.
---

# LLM CLI Skill

Use this skill whenever you need to drive language models from the shell via Simon Willison’s `llm` CLI (https://llm.datasette.io/). It covers setup, multimodal prompts, structured output, fragments for long context, plugin/fragments management, and log inspection.

## Setup & Model Configuration
1. **Install/upgrade**
   ```bash
   uv tool install llm          # or: pipx install llm / brew install llm
   uv tool upgrade llm          # keep it current
   llm --version
   ```
2. **API keys & models**
   ```bash
   llm keys set openai          # prompts for key
   llm install llm-gemini       # plugin per provider/local runtime
   llm keys set anthropic
   ```
   - Check models: `llm models`, narrow with `-q term` or `--options` to see supported features (streaming, schemas, attachments, tools).
   - Set a per-shell default: `export LLM_MODEL=gpt-4.1-mini`.
3. **Session defaults**
   - Continue a conversation: `llm -c` or `llm --cid <conversation_id>`.
   - Interactive chat: `llm chat -m gpt-4.1 -s 'You are…'`.
   - Force new prompt from stdin: `cat file.py | llm -s 'Explain this code'`.

## Core Prompt Patterns
- `llm 'prompt here'` streams output by default; add `--no-stream` to wait for completion.
- Switch models with `-m <model>` or `-q substr` shorthand (e.g., `-q 4o -q mini`).
- Provide system prompts inline (`-s/--system`) or via templates (`--save name`, later `llm -t name`).
- Define temporary tools with `--functions 'python def...'` or load plugin tools via `-T toolbox(...)`.

## Attachments & Multimodal Input
Documentation: https://llm.datasette.io/en/stable/usage.html#attachments
- Attach local files, STDIN, or URLs:
  ```bash
  llm "describe this" -a screenshot.png
  llm "extract text" -a https://.../scan.pdf
  shot | llm "what do you see?" -a - # 'shot' takes a screenshot and writes it to a temp file
  ```
- Multiple attachments allowed (`-a file1 -a file2`).
- Override MIME detection with `--attachment-type/--at <path-or- -> <type>`.
- Use this to give non-multimodal agents access to image/audio/video content (e.g., transcribe a UI screenshot before reasoning elsewhere).

## Structured Output with `--schema`
Documentation: https://llm.datasette.io/en/stable/schemas.html
- Ask a schema-capable model (OpenAI GPT-4.x/4o, Anthropic Claude 3.x, Gemini 1.5/2.0) for JSON that matches your spec:
  ```bash
  llm --schema 'name string, reason string' \
      "jq write a filter that grabs array entries starting with 'a'" \
      | jq -r '.name'
  llm --schema-multi 'name,bio' "invent two dogs"
  llm --schema dogs.schema.json 'invent a dog'
  ```
- Save reusable schemas inside templates: `llm --schema dogs.schema.json --save dogs` then `llm -t dogs 'prompt'`.
- Inspect logged structured data later with `llm logs --schema 'name string' --data | jq '.'`.

## Fragments & Long Context
Docs: https://llm.datasette.io/en/stable/usage.html#fragments and blog post https://simonwillison.net/2025/Apr/7/long-context-llm/
- Add reusable context chunks with `-f/--fragment` (prompt) or `--sf/--system-fragment` (system prompt):
  ```bash
  llm -f notes.md -f https://example.com/doc 'summarize'
  llm -f cli.py --sf explain_code.txt 'walk through this script'
  ```
- Manage fragments:
  ```bash
  llm fragments set alias path_or_url   # store once
  llm fragments                         # list (search via -q term ...)
  llm fragments show alias              # view content
  llm fragments remove alias            # drop alias (keeps data for logs)
  ```
- Fragment prefixes from plugins (ask user before installing new ones):
  - `docs:` from `llm-docs` (bundle of project docs).
  - `github:` from `llm-fragments-github` (entire repo text).
  - `hn:` from `llm-hacker-news` (discussion threads).
  - `siteshot:` from the `siteshot` fragment loader (rendered web pages/screenshots).
  - `video-frames:` / `llm-video-frames` (sample video frames for vision Q&A).
- Fragments are deduplicated via hash in `logs.db`, so repeating a large context doesn’t bloat storage. Filter historical runs with `llm logs -f alias --expand`.

## Plugins & Fragments Marketplace
- List installed plugins: `llm plugins`.
- Install/upgrade/uninstall:
  ```bash
  llm install llm-gemini
  llm install llm-fragments-github
  llm install -e .    # local development
  llm uninstall llm-gemini
  ```
- Always ask the user before installing new plugins or fragment loaders—they can execute arbitrary code.
- Useful plugin families (see https://llm.datasette.io/en/stable/plugins.html and Simon’s blog posts):
  - **Model bridges:** `llm-gemini`, `llm-anthropic`, `llm-ollama`, `llm-llama-server` (local models via HTTP server).
  - **Fragments/templates:** `llm-docs`, `llm-fragments-github`, `llm-hacker-news`, `siteshot`, `llm-video-frames`, `llm-templates-github`, `llm-templates-fabric`.
  - **Tools:** `llm-tools-simpleeval`, `llm-tools-datasette`, etc.
- After plugin work, confirm availability with `llm models`, `llm fragments`, or plugin-specific commands.

## Logs & Retrieval
Docs: https://llm.datasette.io/en/stable/logging.html
- All prompts/responses log to a SQLite DB (location via `llm logs path`).
- Quick commands:
  ```bash
  llm logs                 # latest entries (Markdown)
  llm logs -r              # just most recent response
  llm logs -n 10 --short   # compact YAML
  llm logs --json | jq '.[0].prompt'
  llm logs -q "ssh" -l -n 5
  llm logs -c              # current conversation
  llm logs --cid <id>
  llm logs --schema 'name string' --data
  llm logs -f docs:llm --expand
  llm logs --tools         # any run that invoked a tool
  llm logs backup /tmp/llm-logs.db
  datasette "$(llm logs path)"   # browse visually
  ```
- Privacy controls: `llm 'prompt' -n/--no-log` for one-off, `llm logs off` / `llm logs on` globally, `llm logs status` to confirm.

## Workflow Patterns
- **Image question answering for non-multimodal agents:** `shot > /tmp/shot.png; llm "explain" -a /tmp/shot.png --schema 'answer string' | jq -r '.answer'`.
- **Command helpers:** `history | tail -n 200 | llm "summarize what I've worked on"`.
- **Prompt pipelines:** store reusable instructions in fragments/templates, then chain structured output to `jq`, `rg`, etc.
- **Continue with tools:** `llm -T simple_eval '2+2?' --td` then `llm -c 'that * 6'` to reuse the same tool context.

## Guardrails
- Never install plugins/fragments or touch user API keys without explicit approval.
- Review plugin README/code before trusting it—plugins can run arbitrary Python.
- Use `--no-log` (or turn logging off) when handling secrets.
- Confirm the active model supports the required features (schemas, attachments, tools) via `llm models --options` before relying on them.

## Learned Lessons
- Shell history shows heavy use of `llm` for Ubuntu admin tasks, screenshots (`-a /tmp/ss.png`), structured prompts piped to `jq`, and fragment-powered web QA (`siteshot`, `llm-video-frames`). Capture similar workflows here as they prove reliable.
- Fragments + schema output + `jq` give deterministic automation hooks—save good schemas/templates for reuse.
