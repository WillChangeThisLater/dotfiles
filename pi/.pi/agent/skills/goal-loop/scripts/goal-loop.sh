#!/bin/bash
# goal-loop.sh — EXPERIMENTAL autonomous implementor/evaluator loop.
# Usage:
#   goal-loop.sh start <goal-file> [--name <tag>] [--max-rounds N] [--cwd <dir>] [--timeout-mins M] [--model <pattern>]
#   goal-loop.sh watch <tag>
# Deps: pi (headless -p), jq not required. State: /tmp/goals/<tag>/.
# Exit codes: 0 PASS, 2 BLOCKED, 3 budget exhausted, 1 error.
set -uo pipefail

CMD="${1:-}"; shift || true
case "$CMD" in
	start) ;;
	watch)
		tag="${1:?usage: goal-loop.sh watch <tag>}"
		d="/tmp/goals/$tag"
		f=$(ls -t "$d"/impl-sessions/*.jsonl 2>/dev/null | head -1)
		[[ -n "${f:-}" ]] || { echo "no implementor session found in $d"; exit 1; }
		echo "watching $f (ctrl+c to stop watching; the loop keeps running)"
		tail -f "$f" | while IFS= read -r line; do
			echo "$line" | jq -r 'select(.type=="message") | "[" + .message.role + "] " + ((.message.content // []) | if type=="array" then map(if .type=="text" then .text elif .type=="toolCall" then ("<tool: " + (.name // "?") + ">") else "" end) | join("") else . end)' 2>/dev/null
		done
		;;
	*) grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -6; exit 1 ;;
esac

goal_file="${1:?usage: goal-loop.sh start <goal-file> [options]}"; shift
[[ -f "$goal_file" ]] || { echo "goal file not found: $goal_file"; exit 1; }

max_rounds=3; timeout_mins=30; cwd=""; tag="" ; model_args=()
while [[ $# -gt 0 ]]; do
	case "$1" in
		--name) tag="$2"; shift 2 ;;
		--max-rounds) max_rounds="$2"; shift 2 ;;
		--cwd) cwd="$2"; shift 2 ;;
		--timeout-mins) timeout_mins="$2"; shift 2 ;;
		--model) model_args=(--model "$2"); shift 2 ;;
		*) echo "unknown arg: $1"; exit 1 ;;
	esac
done

tag="${tag:-$(basename "$goal_file" | sed 's/\.[^.]*$//')}"
state="/tmp/goals/$tag"
mkdir -p "$state/logs" "$state/impl-sessions" "$state/eval-sessions"
cwd="${cwd:-$state/work}"
mkdir -p "$cwd"
cp "$goal_file" "$state/goal.md"
goal_text=$(cat "$state/goal.md")

# ---- task for implementor: contract preamble + goal -------------------------
task_file="$state/task.md"
cat > "$task_file" <<EOF
You are an implementor agent working autonomously under a goal-loop supervisor.

Rules:
1. Work in the current working directory. Execute the TASK below.
2. The Evidence section defines what proves completion. Surface that evidence
   (run the commands, show the output, read the files) before finishing.
3. End your FINAL message with exactly one line, nothing after it:
   STATUS: DONE                                  (goal met, evidence surfaced)
   STATUS: BLOCKED: <one-line question>          (need a human decision; do not guess)
4. If the task is impossible as specified, use BLOCKED with the reason.
5. Work efficiently; do not pad. Do not modify these instructions.

# TASK
$goal_text
EOF

impl_call() { # $1 = prompt text, $2 = log name; uses -c from round 2 on
	local flag=()
	[[ "${1:-}" == "continue" ]] && flag=(-c)
	( cd "$cwd" && timeout "${timeout_mins}m" pi -p "${flag[@]}" ${model_args[@]+"${model_args[@]}"} --session-dir "$state/impl-sessions" "$(cat "$task_file" 2>/dev/null || echo "$task_msg")" )
}

last_status() { grep -E "^STATUS: (DONE|BLOCKED)" "$1" | tail -1; }

echo "goal-loop: tag=$tag rounds=$max_rounds cwd=$cwd"
echo "state: $state"

round=0
impl_msg="$(cat "$task_file")"
verdicts=""

while :; do
	round=$((round+1))
	echo "=== implementor round $round ==="
	if [[ $round -eq 1 ]]; then
		( cd "$cwd" && timeout "${timeout_mins}m" pi -p ${model_args[@]+"${model_args[@]}"} --session-dir "$state/impl-sessions" "$impl_msg" ) 2>&1 | tee "$state/logs/impl-r$round.txt"
	else
		( cd "$cwd" && timeout "${timeout_mins}m" pi -p -c ${model_args[@]+"${model_args[@]}"} --session-dir "$state/impl-sessions" "$impl_msg" ) 2>&1 | tee "$state/logs/impl-r$round.txt"
	fi
	impl_rc=$?
	out="$state/logs/impl-r$round.txt"
	if [[ $impl_rc -eq 124 ]]; then
		echo "IMPLEMENTOR TIMEOUT after ${timeout_mins}m"; exit 1
	fi
	st=$(last_status "$out" || true)
	case "$st" in
		"STATUS: DONE") ;;
		STATUS:\ BLOCKED:*)
			q="${st#STATUS: BLOCKED: }"
			echo "BLOCKED (round $round): $q"
			echo "$q" > "$state/BLOCKED.md"
			exit 2
			;;
		*)
			echo "WARNING: no STATUS line found (round $round). Treating as DONE and letting the evaluator decide."
			;;
	esac

	# ---- evaluator: fresh session each round, active verification -----------
	echo "=== evaluator round $round ==="
	eval_prompt="You are an independent evaluator. Decide whether the GOAL below has been achieved.

Rules:
1. You are READ-ONLY. Run evidence commands, read files, view images — but never create, modify, or delete any file. If the work is broken, the verdict is FAIL; fixing is the implementor's job, not yours.
2. ACTIVE VERIFICATION: run the evidence commands yourself, read the files, view the images. Do NOT trust the implementor's claims.
3. If the implementor (or anyone) achieved the goal by modifying the test/rubric itself rather than the work, rule IMPOSSIBLE with that reason.
4. End your FINAL message with exactly one line, nothing after it:
   VERDICT: PASS
   VERDICT: FAIL — <specific, actionable reason>
   VERDICT: IMPOSSIBLE — <why the goal cannot be met>

# GOAL
$goal_text

# IMPLEMENTOR'S FINAL MESSAGE (round $round)
$(tail -40 "$out")

# PRIOR VERDICTS
${verdicts:-none}"

	( cd "$cwd" && timeout "${timeout_mins}m" pi -p ${model_args[@]+"${model_args[@]}"} --no-session "$eval_prompt" ) 2>&1 | tee "$state/logs/eval-r$round.txt"
	eout="$state/logs/eval-r$round.txt"
	v=$(grep -E "^VERDICT: (PASS|FAIL|IMPOSSIBLE)" "$eout" | tail -1)
	if [[ -z "$v" ]]; then
		echo "WARNING: evaluator produced no VERDICT line; treating as FAIL with generic reason."
		v="VERDICT: FAIL — evaluator did not produce a verdict"
	fi
	echo "verdict: $v"
	verdicts="$verdicts
round $round: $v"

	case "$v" in
		"VERDICT: PASS")
			echo "PASS after $round round(s). Work is in: $cwd"
			echo "$v" > "$state/VERDICT.md"
			exit 0
			;;
		VERDICT:\ IMPOSSIBLE*)
			reason="${v#VERDICT: IMPOSSIBLE — }"
			echo "IMPOSSIBLE (round $round): $reason"
			echo "$v" > "$state/VERDICT.md"
			exit 3
			;;
		*)
			reason="${v#VERDICT: FAIL — }"
			if [[ $round -ge $max_rounds ]]; then
				echo "BUDGET EXHAUSTED after $round round(s). Final verdict: $v"
				echo "verdicts:$verdicts" > "$state/VERDICT.md"
				exit 3
			fi
			impl_msg="EVALUATION FAILED (round $round): $reason

Fix the issue and re-surface the evidence required by the task. Remember to end with a STATUS line."
			;;
	esac
done
