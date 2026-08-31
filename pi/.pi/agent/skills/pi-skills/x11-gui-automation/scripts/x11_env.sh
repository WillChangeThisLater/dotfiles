#!/bin/bash
# x11_env.sh — generic agent-owned X11 environment lifecycle + registry
#
# Convention: ONE display per (agent, app). Each (agent, app) pair gets its own
# Xvfb display, optional x11vnc server, tmux window, and state file. Apps that
# need real input automation never share a display, so xdotool never has to
# multiplex a pointer.
#
# Subcommands:
#   claim  <agent> <app>              allocate display+VNC, create tmux window,
#                                     write state file. Idempotent per (agent,app).
#   run    <agent> <app> <cmd...>     run a command on the app's display in its window
#   port   <agent> <app> <NAME> <n> [purpose]
#                                     register a declared port in the state file
#   release <agent> [app]             release one app or all of an agent's apps
#   status                            human-readable registry report
#
# State: /tmp/x11-env/<agent>/<app>.env  (KEY=VALUE lines + '# ...' comment lines)
# Lock:  /tmp/x11-env.lock (atomic mkdir; covers setup only, not env lifetime)
# Tmux:  session 'env-setup', window 'env-<agent>-<app>' per environment
#
# Exit codes: 0 ok | 2 lock contention | 3 allocation exhausted | 5 verify fail

set -u

LOCK_DIR="/tmp/x11-env.lock"
LOCK_STALE_SECS=600
STATE_ROOT="/tmp/x11-env"
SESSION="env-setup"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------- helpers ---
die() { echo "ERROR: $*" >&2; exit "${2:-1}"; }

state_file() { echo "$STATE_ROOT/$1/$2.env"; }

alloc_port() { # <kind> <start> <max> <free-check-cmd using $n>
    local kind="$1" n="$2" max="$3" check="$4"
    while (( n <= max )); do
        if eval "$check"; then echo "$n"; return 0; fi
        n=$(( n + 1 ))
    done
    return 1
}

port_listening() { lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

display_free() { ! ls /tmp/.X11-unix 2>/dev/null | grep -q "X${1}$"; }

wait_for() { # <seconds> <check-cmd>
    local i=0
    while (( i < $1 )); do
        eval "$2" && return 0
        sleep 1; i=$(( i + 1 ))
    done
    return 1
}

# -------------------------------------------------------------- lock zone ---
claim_lock() {
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        echo "$$-$(date +%s)" > "$LOCK_DIR/owner"
        return 0
    fi
    return 1
}
lock_age() {
    local now mtime
    now=$(date +%s)
    mtime=$(stat -c %Y "$LOCK_DIR/owner" 2>/dev/null || echo "$now")
    echo $(( now - mtime ))
}
release_lock() { rm -rf "$LOCK_DIR"; }

acquire_lock_or_die() {
    if ! claim_lock; then
        local age; age=$(lock_age)
        if (( age > LOCK_STALE_SECS )); then
            echo "x11_env: stale lock (${age}s old) — stealing it." >&2
            rm -rf "$LOCK_DIR"
            claim_lock || die "could not steal stale lock; retry in a moment" 2
        else
            die "another setup is in progress (lock held ${age}s). Wait ~15s and retry. See $LOCK_DIR/owner" 2
        fi
    fi
    trap release_lock EXIT
}

# ------------------------------------------------------------------ claim ---
cmd_claim() {
    local agent="$1" app="$2"
    [[ -n "$agent" && -n "$app" ]] || die "usage: x11_env.sh claim <agent> <app>"
    local sf; sf=$(state_file "$agent" "$app")

    # idempotent re-claim
    if [[ -f "$sf" ]]; then
        echo "x11_env: env for $agent/$app already exists. Reusing." >&2
        cat "$sf"
        return 0
    fi

    acquire_lock_or_die

    # allocate display + vnc
    local display vnc
    display=$(alloc_port "X11 display" 1 99 'display_free $n') || die "no free X11 display (1-99)" 3
    vnc=$(alloc_port "VNC port" 5902 5999 '! port_listening $n') || die "no free VNC port (5902-5999)" 3

    local window="env-${agent}-${app}"
    if ! tmux has-session -t "$SESSION" 2>/dev/null; then
        tmux new-session -d -s "$SESSION" -n "$window"
    elif tmux list-windows -t "$SESSION" -F '#{window_name}' | grep -qx "$window"; then
        # orphaned window (crashed run, no state) — reclaim it
        echo "x11_env: orphaned window '$window' without state — reclaiming." >&2
        local wids
        wids=$(tmux list-windows -t "$SESSION" -F '#{window_name} #{window_id}' | awk -v w="$window" '$1==w{print $2}')
        local wid
        for wid in $wids; do tmux kill-window -t "$wid" 2>/dev/null || true; done
        # NOTE: an orphaned Xvfb may outlive its window; its display stays
        # marked used (socket exists) and will be skipped by allocation.
        tmux has-session -t "$SESSION" 2>/dev/null \
            && tmux new-window -t "$SESSION" -n "$window" \
            || tmux new-session -d -s "$SESSION" -n "$window"
    else
        tmux new-window -t "$SESSION" -n "$window"
    fi

    # grid: p0 Xvfb, p1 x11vnc (app panes are added later via `run` / apps/*.sh)
    local p_xvfb p_vnc
    p_xvfb=$(tmux display-message -p -t "$SESSION:$window.0" '#{pane_id}')
    p_vnc=$(tmux split-pane -v -P -F '#{pane_id}' -t "$p_xvfb")

    tmux send-keys -t "$p_xvfb" "Xvfb :$display -screen 0 1920x1080x24" Enter
    # wait for the X socket before starting x11vnc — x11vnc exits if the
    # display isn't ready yet (startup race; -forever does not save it)
    wait_for 10 "ls /tmp/.X11-unix 2>/dev/null | grep -q 'X${display}$'" \
        || { echo "ERROR: Xvfb socket X$display did not appear" >&2; fail=1; }
    tmux send-keys -t "$p_vnc" "env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE x11vnc -display :$display -rfbport $vnc -forever -shared -nopw" Enter

    mkdir -p "$STATE_ROOT/$agent"
    cat > "$sf" <<EOF
AGENT=$agent
APP=$app
DISPLAY_NUM=$display
VNC_PORT=$vnc
TMUX_SESSION=$SESSION
TMUX_WINDOW=$window
XVFB_PANE=$p_xvfb
VNC_PANE=$p_vnc
CREATED=$(date +%s)
EOF

    # verify
    local fail=0
    wait_for 8 "ls /tmp/.X11-unix 2>/dev/null | grep -q 'X${display}$'" || { echo "ERROR: Xvfb socket X$display did not appear" >&2; fail=1; }
    wait_for 8 "port_listening $vnc" || { echo "ERROR: x11vnc not listening on $vnc" >&2; fail=1; }
    if (( fail )); then
        local log="$STATE_ROOT/$agent/$app.log"
        {
            echo "=== claim failed for $agent/$app (display :$display vnc :$vnc) $(date -Iseconds)"
            echo "--- Xvfb pane ---"; tmux capture-pane -t "$p_xvfb" -p 2>/dev/null | tail -25
            echo "--- VNC pane ---";   tmux capture-pane -t "$p_vnc" -p 2>/dev/null | tail -25
        } > "$log" 2>&1
        echo "Diagnostics saved to $log" >&2
        release_lock
        trap - EXIT
        # kill the Xvfb we started (state file doesn't exist yet, so release
        # can't infer the display) — no orphaned X servers from failed claims
        pkill -f "Xvfb :${display} " 2>/dev/null && rm -f "/tmp/.X${display}-lock" "/tmp/.X11-unix/X${display}" 2>/dev/null
        cmd_release_one "$agent" "$app" >/dev/null 2>&1
        exit 5
    fi

    release_lock
    trap - EXIT
    echo "x11_env: claimed $agent/$app (display :$display, vnc :$vnc, window $window)" >&2
    echo "observe: vncviewer localhost:$vnc" >&2
    cat "$sf"
    return 0
}

# -------------------------------------------------------------------- run ---
cmd_run() {
    local agent="$1" app="$2"; shift 2
    local sf; sf=$(state_file "$agent" "$app")
    [[ -f "$sf" ]] || die "no env for $agent/$app — claim it first"
    source "$sf"
    # each run gets its own window (panes run out of space fast; windows do not)
    local n rw wid
    n=$(grep -c '^RUN_WINDOW=' "$sf" 2>/dev/null)
    n=${n:-0}
    n=$(( n + 1 ))
    rw="${TMUX_WINDOW}-r${n}"
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        wid=$(tmux new-window -P -F '#{window_id}' -t "$SESSION" -n "$rw") || die "could not create run window" 1
    else
        die "tmux session '$SESSION' is gone — environment was torn down" 1
    fi
    echo "RUN_WINDOW=$wid" >> "$sf"
    tmux send-keys -t "$wid.0" "env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE DISPLAY=:$DISPLAY_NUM $*" Enter
    echo "$wid"
}

# ------------------------------------------------------------------- port ---
cmd_port() {
    local agent="$1" app="$2" name="$3" port="$4"; shift 4
    local purpose="${*:-}"
    local sf; sf=$(state_file "$agent" "$app")
    [[ -f "$sf" ]] || die "no env for $agent/$app"
    local key="PORT_${name^^}"
    grep -q "^${key}=" "$sf" && die "port $name already declared for $agent/$app"
    wait_for 5 "port_listening $port" || die "port $port is not listening — refusing to declare it"
    if [[ -n "$purpose" ]]; then
        echo "${key}=${port} # ${purpose}" >> "$sf"
    else
        echo "${key}=${port}" >> "$sf"
    fi
    echo "x11_env: declared $key=$port ${purpose:+($purpose)} for $agent/$app" >&2
}

# ---------------------------------------------------------------- release ---
kill_windows_by_id() { # <window-name>
    local wids wid
    wids=$(tmux list-windows -t "$SESSION" -F '#{window_name} #{window_id}' 2>/dev/null | awk -v w="$1" '$1==w{print $2}')
    for wid in $wids; do
        tmux kill-window -t "$wid" 2>/dev/null && echo "x11_env: killed window $wid"
    done
}

cmd_release_one() {
    local agent="$1" app="$2"
    local sf; sf=$(state_file "$agent" "$app")
    if [[ ! -f "$sf" ]]; then
        # no state: still try to clear an orphaned window by name
        kill_windows_by_id "env-${agent}-${app}" >/dev/null
        return 0
    fi
    source "$sf"
    kill_windows_by_id "$TMUX_WINDOW" >/dev/null
    # kill run windows by recorded id
    local rw
    while IFS= read -r rw; do
        tmux kill-window -t "${rw#RUN_WINDOW=}" 2>/dev/null && echo "x11_env: killed run window ${rw#RUN_WINDOW=}" 
    done < <(grep '^RUN_WINDOW=' "$sf" 2>/dev/null)
    if [[ -n "${DISPLAY_NUM:-}" ]] && pkill -f "Xvfb :${DISPLAY_NUM} " 2>/dev/null; then
        echo "x11_env: killed Xvfb :$DISPLAY_NUM"
        rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}" 2>/dev/null
    fi
    # app-registered cleanup targets (e.g. chrome profile dirs)
    local var val
    while IFS=$'\n' read -r line; do
        case "$line" in PROFILE_DIR=*) val="${line#PROFILE_DIR=}"; [[ -d "$val" ]] && rm -rf "$val" && echo "x11_env: removed $val";; esac
    done < "$sf"
    rm -f "$sf"   # keep $app.log — diagnostics survive cleanup on purpose
    echo "x11_env: released $agent/$app"
}

cmd_release() {
    local agent="$1" app="${2:-}"
    if [[ -n "$app" ]]; then
        cmd_release_one "$agent" "$app"
    else
        local d
        for d in "$STATE_ROOT/$agent"/*.env; do
            [[ -f "$d" ]] || continue
            cmd_release_one "$agent" "$(basename "${d%.env}")"
        done
        rmdir "$STATE_ROOT/$agent" 2>/dev/null || true
    fi
    # session cleanup when truly empty (0 windows — tmux usually auto-kills
    # empty sessions, so this is a safety net; NEVER kill with windows remaining)
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        [[ "$(tmux list-windows -t "$SESSION" | wc -l)" -eq 0 ]] \
            && tmux kill-session -t "$SESSION" 2>/dev/null \
            && echo "x11_env: session '$SESSION' now empty — killed it"
    fi
    return 0
}

# ----------------------------------------------------------------- status ---
cmd_status() {
    printf "%-22s %-12s %-7s %-5s %-30s %-14s %s\n" AGENT APP DISPLAY VNC "DECLARED PORTS" DETECTED STATE
    local sf agent app line
    for sf in "$STATE_ROOT"/*/*.env; do
        [[ -f "$sf" ]] || continue
        agent=$(basename "$(dirname "$sf")"); app=$(basename "${sf%.env}")
        local display="" vnc="" declared="" window=""
        local -A ports=()
        while IFS= read -r line; do
            case "$line" in
                DISPLAY_NUM=*) display="${line#DISPLAY_NUM=}";;
                VNC_PORT=*)    vnc="${line#VNC_PORT=}";;
                TMUX_WINDOW=*) window="${line#TMUX_WINDOW=}";;
                PORT_*)        ports["${line%%=*}"]="${line#*=}";;
                CHROME_PORT=*|KITTY_PORT=*) ports["${line%%=*}"]="${line#*=}";;
                VNC_PORT=*)    ports["VNC_PORT"]="${line#VNC_PORT=}";;
            esac
        done < "$sf"
        # declared port rendering + liveness
        local k p alive decl=""
        for k in "${!ports[@]}"; do
            p="${ports[$k]}"; p="${p%% *}"
            if port_listening "$p"; then alive="✓"; else alive="✗"; fi
            decl+="${k#PORT_}=$p$alive "
        done
        [[ -z "$decl" ]] && decl="—"
        # detected-but-undeclared listening ports owned by window processes
        # (infra window + every recorded run window)
        local detected="—" ttys ttys_all pids wins
        if [[ -n "$window" ]] && tmux has-session -t "$SESSION" 2>/dev/null \
           && tmux list-windows -t "$SESSION" -F '#{window_name}' | grep -qx "$window"; then
            wins="$window "$(grep '^RUN_WINDOW=' "$sf" 2>/dev/null | cut -d= -f2 | tr '\n' ' ')
            ttys_all=""
            for wins in $wins; do
                # names need session-qualified targets; window ids (@N) work bare
                [[ "$wins" == @* ]] && tgt="$wins" || tgt="$SESSION:$wins"
                ttys=$(tmux list-panes -t "$tgt" -F '#{pane_tty}' 2>/dev/null | sed 's|/dev/||')
                ttys_all+="${ttys}"$'\n'
            done
            ttys=$(echo "$ttys_all" | sed '/^$/d' | sort -u | tr '\n' '|' | sed 's/|$//')
            pids=$(ps -eo pid=,tty= | awk -v t="^($ttys)$" '$2 ~ t {print $1}')
            if [[ -n "$pids" ]]; then
                local -A seen=() line pidport
                local out="" listen_line
                # map pid -> listening port
                while IFS= read -r listen_line; do
                    echo "$listen_line" | grep -qE 'users:\(\("(x11vnc|Xvfb)"' && continue
                    pidport=$(echo "$listen_line" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
                    [[ -z "$pidport" ]] && continue
                    # only pids belonging to this env's windows
                    echo "$pids" | grep -qx "$pidport" || continue
                    local pport
                    pport=$(echo "$listen_line" | grep -oE ':[0-9]+ ' | head -1 | tr -d ': ')
                    [[ -z "$pport" ]] && continue
                    # skip ports already declared
                    local skip=0 dp
                    for dp in "${ports[@]}"; do
                        dp="${dp%% *}"
                        [[ "$pport" == "$dp" ]] && skip=1
                    done
                    (( skip )) && continue
                    [[ -n "${seen[$pport]:-}" ]] && continue
                    seen[$pport]=1
                    out+="${pport},"
                done < <(ss -tlnp 2>/dev/null | grep LISTEN)
                detected="${out%,}"
                [[ -z "$detected" ]] && detected="—"
            fi
        fi
        local state="live"
        [[ -n "$display" ]] && ! ls /tmp/.X11-unix 2>/dev/null | grep -q "X${display}$" && state="DEAD (no Xvfb)"
        if [[ "$state" == "live" ]] && [[ -n "$vnc" ]] && ! port_listening "$vnc"; then state="DEAD (no vnc)"; fi
        local age=$(( $(date +%s) - $(stat -c %Y "$sf") ))
        (( age > 86400 )) && [[ "$state" == "live" ]] && state="stale (${age}s)"
        printf "%-22s %-12s %-7s %-5s %-30s %-14s %s\n" "$agent" "$app" ":$display" "$vnc" "$decl" "$detected" "$state"
    done
}

# ------------------------------------------------------------------- main ---
cmd="${1:-}"
case "$cmd" in
    claim)   shift; cmd_claim "$@";;
    run)     shift; cmd_run "$@";;
    port)    shift; cmd_port "$@";;
    release) shift; cmd_release "$@";;
    status)  cmd_status;;
    "")      die "usage: x11_env.sh {claim|run|port|release|status} ...";;
    *)       die "unknown subcommand: $cmd";;
esac
