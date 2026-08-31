#!/bin/bash

AGENT_ID="${2:-test}"

TMUX_WINDOW_NAME="browser-setup-$AGENT_ID"
if tmux list-windows -F '#W' | grep -q $TMUX_WINDOW_NAME; then
	echo "tmux window '$TMUX_WINDOW_NAME' already exists. Exiting."
	exit 1
fi

# TODO: we should use a lockfile to prevent conflicts

# figure out x display number
DISPLAY_NUM=0
MAX_DISPLAY_NUM=99
while [[ "$DISPLAY_NUM" -le "$MAX_DISPLAY_NUM" ]]; do
    if ! ls /tmp/.X11-unix | grep -q "X${DISPLAY_NUM}"; then
        echo "Found unused DISPLAY_NUM: X${DISPLAY_NUM}"
        break
    fi
    DISPLAY_NUM=$((DISPLAY_NUM + 1))
done
if [[ "$DISPLAY_NUM" -eq "$MAX_DISPLAY_NUM" ]]; then
	echo "Could not find unused X11 display number. Exiting."
	exit 1
fi

# figure out chrome debugging port
CHROME_PORT=9222
MAX_CHROME_PORT=9299
while [[ "$CHROME_PORT" -le "$MAX_CHROME_PORT" ]]; do
    if ! lsof -i :"$CHROME_PORT" >/dev/null 2>&1; then
        echo "Found unused CHROME_PORT: ${CHROME_PORT}"
        break
    fi
	CHROME_PORT=$((CHROME_PORT + 1))
done
if [[ "$CHROME_PORT" -eq "$MAX_CHROME_PORT" ]]; then
	echo "Could not find unused chrome debugging port. Exiting."
	exit 1
fi

# figure out vnc port
VNC_PORT=5902
MAX_VNC_PORT=5999
while [[ "$VNC_PORT" -le "$MAX_VNC_PORT" ]]; do
    if ! lsof -i :"$VNC_PORT" >/dev/null 2>&1; then
        echo "Found unused VNC_PORT: ${VNC_PORT}"
        break
    fi
	VNC_PORT=$((VNC_PORT + 1))
done
if [[ "$VNC_PORT" -eq "$MAX_VNC_PORT" ]]; then
	echo "Could not find unused VNC debugging port. Exiting."
	exit 1
fi

tmux new-window -n "browser-setup-$AGENT_ID"

# create 2x2 grid
tmux split-pane -v
tmux split-pane -h
tmux select-pane -t 0
tmux split-pane -h


P0_CMD="Xvfb :$DISPLAY_NUM -screen 0 1920x1080x24"
P1_CMD="env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE DISPLAY=:$DISPLAY_NUM google-chrome --remote-debugging-port=$CHROME_PORT --user-data-dir=/tmp/chrome-$CHROME_PORT-profile --no-sandbox --disable-gpu"
P2_CMD="env -u WAYLAND_DISPLAY -u XDG_SESSION_TYPE x11vnc -display :$DISPLAY_NUM -rfbport $VNC_PORT -forever -shared -nopw"
P3_CMD="vncviewer localhost:$VNC_PORT"

tmux send-keys -t 0 "$P0_CMD" Enter
sleep 1
tmux send-keys -t 1 "$P1_CMD" Enter
sleep 1
tmux send-keys -t 2 "$P2_CMD" Enter
sleep 1
tmux send-keys -t 3 "$P3_CMD" Enter


# cleanup (for now...)
#sleep 30
#tmux kill-window
