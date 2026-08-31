#!/bin/bash
# spawn-subagent.sh — spawn a pi worker agent in the dedicated `subagents` tmux session.
# Usage: spawn-subagent.sh --purpose <word> --prompt-file <file> [--cwd <dir>] [--model <pattern>] [--print]
# Deps: tmux, pi. Ensures the naming standard (<parent-tag>-<purpose>), fresh cwd,
# session containment (--session-dir inside worker cwd), and the report contract.
set -euo pipefail

usage() { grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -8; exit 1; }

purpose="" prompt_file="" cwd="" model="" print_mode=""
while [[ $# -gt 0 ]]; do
	case "$1" in
		--purpose) purpose="$2"; shift 2 ;;
		--prompt-file) prompt_file="$2"; shift 2 ;;
		--cwd) cwd="$2"; shift 2 ;;
		--model) model="$2"; shift 2 ;;
		--print) print_mode=1; shift ;;
		-h|--help) usage ;;
		*) echo "unknown arg: $1" >&2; usage ;;
	esac
done

[[ -n "$purpose" && -n "$prompt_file" && -f "$prompt_file" ]] || { echo "need --purpose <word> and --prompt-file <existing file>" >&2; usage; }
[[ "$purpose" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo "--purpose must be one word: letters/digits/-/_" >&2; exit 1; }

# parent tag: first 8 chars of our own session id, from pi's bash env.
# session files are <timestamp>_<uuid>.jsonl — take the part after the underscore.
parent_tag="unknown"
if [[ -n "${PI_SESSION_FILE:-}" ]]; then
	parent_tag=$(basename "$PI_SESSION_FILE" .jsonl | awk -F_ '{print $NF}' | cut -c1-8)
fi
window="${parent_tag}-${purpose}"

# fresh cwd, never one that would resume a human session
base="/tmp/subagents"
cwd="${cwd:-$base/$window}"
mkdir -p "$cwd"

# copy the task into the worker cwd as PROMPT.md (single source of truth)
cp "$prompt_file" "$cwd/PROMPT.md"

# standard report-contract preamble (prepended so the task stays authoritative)
preamble="$cwd/.report-contract.md"
cat > "$preamble" <<'EOF'
You are a subagent worker. Rules:
1. Read PROMPT.md in the current directory and execute the task it describes.
2. You have no access to any parent conversation. If PROMPT.md is missing
   information you cannot proceed without, state that in your report and stop.
3. When done — success OR failure — write your final summary to report.md in
   the current directory: what you did, key findings/result, file paths of any
   artifacts, and anything the parent should double-check.
4. Then stop. Do not wait for further input.
EOF

# session containment: worker transcripts live inside the worker cwd
session_args=(--session-dir "$cwd/sessions")

model_args=()
[[ -n "$model" ]] && model_args=(--model "$model")

mode_args=()
[[ -n "$print_mode" ]] && mode_args=(--print)

# make sure the subagents session exists
tmux has-session -t subagents 2>/dev/null || tmux new-session -d -s subagents -x 220 -y 50

if tmux list-windows -t subagents -F '#W' | grep -qx "$window"; then
	echo "ERROR: window '$window' already exists in subagents session. Pick another --purpose or clean it up." >&2
	exit 1
fi

worker_cmd="pi ${session_args[*]} ${model_args[*]} ${mode_args[*]} -- 'Read .report-contract.md, then execute the task in PROMPT.md.'"

tmux new-window -d -t subagents -n "$window" -c "$cwd" "$worker_cmd"

echo "spawned: subagents:$window"
echo "cwd:     $cwd"
echo "monitor: check-subagent.sh $window"
echo "report:  $cwd/report.md"
