#!/usr/bin/env bash
# Purpose: tmux status-right segment — battery state icon.
# Usage: called by tmux status-right as #(~/.tmux/scripts/batt_icon.sh)
# Dependencies: upower, /sys/class/power_supply.
# State -> icon (user preference):
#   charging / fully charged -> ⚡ (clean glyph; plugin default 🔌 renders mangled)
#   discharging              -> red ✘ (normal unplugged state, marked red on purpose)
#   no battery / unknown     -> red ✘
state=$(upower -i "$(upower -e | grep -E 'battery|DisplayDevice' | tail -n1)" 2>/dev/null | awk '/state/ {print $2}')
case "$state" in
	charging|fully-charged|"fully charged"|full)
		printf '⚡' ;;
	discharging)
		printf '#[fg=red]✘#[default]' ;;
	*)
		printf '#[fg=red]✘#[default]' ;;
esac