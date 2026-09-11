#!/usr/bin/env bash
# Purpose: tmux status-right segment — WiFi connectivity + link quality.
# Usage: called by tmux status-right as #(~/.tmux/scripts/wifi_signal.sh)
# Dependencies: /proc/net/wireless (kernel), no external commands.
# Reads link quality % of the first wireless interface; offline -> ✘.
dev=$(awk 'NR>2 {sub(":$","",$1); print $1; exit}' /proc/net/wireless)
[ -z "$dev" ] && printf '#[fg=red]✘#[default]' && exit 0
# columns: iface flags link lvl noise ...; link is percent-like
# line: iface: flags link level noise ... (whitespace separated)
link=$(awk -v d="$dev" '$1 ~ d ":" {print $3}' /proc/net/wireless | cut -d. -f1)
if [ -z "$link" ] || [ "$link" -le 0 ]; then printf '#[fg=red]✘#[default]'; exit 0; fi
# ascending staircase up to current tier (user preference): weak=▂, fair=▂▄, good=▂▄▆, strong=▂▄▆█
if [ "$link" -lt 25 ]; then bars='▂'; elif [ "$link" -lt 50 ]; then bars='▂▄'; elif [ "$link" -lt 75 ]; then bars='▂▄▆'; else bars='▂▄▆█'; fi
printf '✔ %s' "$bars"
