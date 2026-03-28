---
name: pi-agent controls
description: tmux command recipes for reopening pi-agent states and branching cleanly
---

# Pi Agent Controls
The only interface you have to the system is **tmux**. Every control below is expressed as a `tmux send-keys` recipe that triggers the desired behaviors inside the pi agent pane (default session `agents`, window `pi`, pane `pi.2`).

## 1. Jumping to a prior message with `/tree`
| Step | Command | Notes |
| --- | --- | --- |
| Open the tree selector | `tmux send-keys -t agents:pi.2 "/tree" Enter` | Type `/tree` exactly into the agent prompt and hit Enter. No other input is necessary. |
| Filter to the target | `tmux send-keys -t agents:pi.2 "what do you do"` | Begin typing; the tree filters immediately without Enter. Use `BSpace` (see below) to clear the text when you’re done. |
| Select the highlighted node | `tmux send-keys -t agents:pi.2 Enter` | The tree pre-highlights a node (look for the leading `>`). Press Enter once. Do **not** hit ↓ before Enter—extra navigation triggers the “Summarize branch?” dialog. |
| Decline summaries | `tmux send-keys -t agents:pi.2 Enter` (while “No summary” is already selected) | When the dialog appears, the default selection is “No summary”. Just hit Enter again to confirm. |

## 2. Prompt hygiene inside tmux
- If any text is sitting in the prompt, erase it with a flood of backspaces:
  ```bash
  tmux send-keys -t agents:pi.2 -N 10000 BSpace
  ```
  Repeat until the cursor is at the start of the line.
- When you accidentally submit empty text and see “Already at this point,” clear the prompt anyway before typing the next command.
- `BSpace` is case-sensitive: use `BSpace`, not `Backspace`.

## 3. Menu controls & navigation
- While in `/tree`, the keys behave as follows:
  | Key | Effect |
  | --- | --- |
  | ↑/↓ | Move the highlight (used rarely—prefer search instead). |
  | ←/→ | Page up/down through long lists. |
  | Shift+L | Label entries (rare). |
  | `^D/^T/^U/^L/^A` | Apply filters; `^O` or `Shift+^O` cycles filter modes. |
- To clear a search filter, send `BSpace` repeatedly until the prompt line is empty.
- Within the tree, the ASCII connectors (`├─`, `└─`) show branching structure. Follow a branch up (the parent chain) by searching for earlier messages rather than manually walking the arrows.

## 4. Recovery shortcuts
| Problem | Command | Explanation |
| --- | --- | --- |
| Agent stuck or spamming “why?” | `tmux send-keys -t agents:pi.2 C-d` | `C-d` exits the pi-agent CLI entirely. Restart the agent in a fresh tmux pane or window. |
| Dialog refuses to exit | `tmux send-keys -t agents:pi.2 C-c` | Sends Ctrl+C; if that doesn’t work, follow immediately with `Escape` or `C-d`. |
| Need to reset pane state | `tmux send-keys -t agents:pi.2 Escape` (repeat) | Escape backs out of nested menus/commands until you are back at the idle prompt. |

Use this controls file whenever you need to branch, recover, or keep the tmux prompt clean. If you discover another reliable shortcut while experimenting, add it here so future agents can reuse it.