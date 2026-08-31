---
name: tmux
description: How to communicate with tmux panes
---

# Background
I will often want you to interact with tmux using the tmux cli.

  * "i am ssh'd into the pinephone at pane 0:1.0. use this pane for interacting with the pinephone"
  * "send a hello message to the pi agent running on ai:agents.2.

This skill explains what I mean when I say things like this.

# Init ritual (required)
When the user assigns a tmux target, you must lock a single active target and echo it back before taking actions.

Use this exact target format everywhere:

`session:window.pane`

Example:

`skills:tmux.2`

Required init steps:

1. **Lock active target**
   - Record and use one active target exactly as provided by the user.
   - Do not switch targets unless the user explicitly reassigns it.
2. **Echo target to yourself and user**
   - State: “Active tmux target: `<session:window.pane>`”.
3. **Capture starting state**
   - Run:
     ```bash
     tmux capture-pane -p -t <session:window.pane>
     ```
   - Summarize what is currently running / visible in that pane.
4. **Declare interaction scope**
   - State when you will use this target:
     - Any command intended for that remote box/device/agent.
     - Any follow-up reads (`capture-pane`) for those commands.
5. **Detect active interface and load controls**
   - Use the starting-state capture to identify the active interface in the target pane (e.g. `pi-agent`, `shell`, or another TUI).
   - First read `controls/README.md` for global control conventions.
   - If a matching controls file exists under `controls/<interface>/CONTROLS.md`, read it before complex interactions.
   - Briefly state which controls file you are using.
   - If no controls file exists, say so and proceed with cautious single-step send/capture loops.

Sticky-target rule:
- After init, all tmux interactions for that assigned system must use the active target.
- If a command would use a different target, stop and ask for confirmation first.

## Targeting safety (mandatory — real incidents have damaged the human's sessions)

Never send keystrokes to a target you did not **verify in the same breath**. Both
rules below are absolute; convenience never justifies skipping them.

1. **Verify immediately before every `send-keys`.** The command that sends keys
   and the command that captures the pane's content must run together, and you
   must actually look at the capture before pressing Enter on the send. If the
   pane is not showing exactly what you expect (your shell, your prompt, your
   app), do not send. Panes get renamed, reused, and moved by the human while
   you work — a target verified 10 minutes ago is not verified.
2. **Never construct targets dynamically.** No chaining commands with `||`
   fallbacks, no grepping for window names to derive a target, no `-t` with a
   computed string. If `new-window` fails, STOP and diagnose — do not fall
   through to a different command. If you catch yourself writing
   `tmux send-keys -t $(some pipeline)`, stop entirely.
3. **Prefer pane IDs** (`%N`) for repeat interactions, but re-verify pane
   content even then — pane IDs are stable, but *whose* pane they point at can
   surprise you if the window list shifted between your steps.
4. **For throwaway test environments, create them in a session you own** (e.g.
   `tmux new-session -d -s my-test-env`), never as windows in the human's
   attached session, and drive them only via their pane IDs captured at creation.
5. If a send goes to the wrong pane anyway: tell the human immediately, exactly
   what text went where, so they can undo/interrupt. Do not silently retry.

## Self-reference / current-pane lookup
When the user gives a relative target (for example, just a pane index like `pane 2`), resolve it against your current tmux context first.

Use:
```bash
tmux display-message -p 'session=#{session_name} window=#{window_index}:#{window_name} pane=#{pane_index} id=#{pane_id}'
```

This reports the tmux client context where the command is executed. You can then infer missing pieces:
- If user says `pane Z`, assume `<current-session>:<current-window>.Z`
- If user says `window Y pane Z`, assume `<current-session>:Y.Z`

After resolving, echo the fully-qualified target (`session:window.pane`) before sending keys.

### Known edge case: context drift
The current tmux client context can change over time (different active pane/client, renamed windows, reattached clients, etc.). A previously captured `(session, window, pane)` may become stale.

Therefore:
- Re-run the `display-message` lookup before important relative-target actions.
- Re-run it whenever behavior seems inconsistent (for example, `send-keys` succeeds but effects appear in the wrong place or nowhere visible).
- Prefer pane IDs (like `%3`) for immediate follow-up actions when available, but still refresh context periodically.

# Interacting with panes
Pane interaction is a fundamental part of tmux. There are two primitives `send-keys` and `capture-pane`. `send-keys` gives you the "write" side of the puzzle, `capture-pane` gives you the "read". Together you can do basically everything


Example: interacting with a shell

```bash
# assume pane 0 in window 'tmux' in session 'skills' is running /bin/bash
# i have asked you to tell me what currently shows in the pane
# after you've done this, i've asked you to tell me what files exist in the current directory
# using 'ls'

# capture content of the pane 
tmux capture-pane -p -t skills:tmux.0
# sometimes you need to see more history
tmux capture-pane -p -t skills:tmux.0 -S -500

# run 'ls' in the pane. this is done by literally sending "ls\n" to the pane
tmux send-keys -t skills:tmux.0 "ls" Enter
# see the result
tmux capture-pane -p -t skills:tmux.0
```

Example: interacting with pi agent

```bash
# i have asked you to interrupt the pi agent running at agents:pi.2. i've asked you to do this so you can
# introduce yourself. i've asked you to use the name 'bob'. i aksed you to both (a) ask for the agent's name
# and land on a communication protocol you can use for inter-agent comms

# interrupt the agent because i told you to
# wait a second to make sure the esc goes through
tmux send-keys -t agents:pi.2 Escape
sleep 1

# clear any old prompt by entering backspace 10k times
tmux send-keys -t agents:pi.2 -N 10000 BSpace

# give the agent your message
# need 'Enter' at the end to actually send the message
tmux send-keys -t agents:pi.2 "hi. i am 'bob', a pi agent running on paul's system. i'd like you to tell me your name. then, let's figure out ..." Enter

# wait a little, then check response
# this is tricky, and <5> is subjective. if you don't see any visual change in the agent state
# one of at least two things might have happened
#
#   1. the agent is still processing the response and has not output anything. in this case nothing is wrong - the agent is just taking a long time
#   2. the agent is down and will never respond. this is more serious since it mean's the agent you were talking to is effectively dead
#
# there is no perfect answer for how to handle this. my advice is to poll the agent a few times (say, for up to 30 seconds) to see if state changes.
# if not, interrupt it and ask it explicitly for a status update
sleep 5
tmux capture-pane -p -t agents:pi.2
```

What complicates this is that each interactive command you run will have its own CLI interface. For instance, bash will respond to
things like signals (ctrl+c, ctrl+z, etc) like you'd expect, but other programs might not.

The `bash` and `pi-agent` interfaces are relatively simple. `bash` is as you'd expected (newline delimited, use 'enter' to send commands).
`pi-agent` is a bit more complex. There are a few features in `pi-agent` I might ask you to play with that it's worth being aware of:

  * commands: `pi-agent` supports a bunch of custom commands. you can see a few pop up when you type just '/' (no enter)

    ```bash
    tmux send-keys -t agents:pi.2 "/"
    tmux capture-pane -p -t agents:pi.2 # a few commands should pop up
    tmux send-keys -t agents:pi.2 -N 2 Down # navigate to the command you want using arrow keys, which in this case is down 2 from the top
    ```

    you can run a command using '/<command>' with Enter. for instance, to run the settings command:

    ```bash
    tmux send-keys -t agents:pi.2 "/settings" Enter
    tmux capture-pane -p -t agents:pi.2 # setting options should pop up
    ```

  * the menus `pi-agent` uses are interesting. you can actually search the menu by just typing the item
    you are looking for. for instance, this shows you all commands with 'auto' in them:

    ```bash
    # assume you are already in /settings
    # do NOT use enter here
    tmux send-keys -t agents:pi.2 "resize"
    tmux capture-pane -p -t agents:pi.2 # options should pop up
    ```

  * `Escape` will often get you from a sub menu to the home menu 

  * pi agent has a bunch of interesting options that i may ask you to work with (for instance, /tree and /resume). these have more complex menus
    you should let me know this is your first time using these commands and let me know that, even if you experiment around, you may need help

## Controls
Read `controls/README.md` first for global control conventions and maintenance expectations.

Some interfaces have custom control documentation that will help you interact with them. `pi-agent`, for instance,
has controls at `controls/pi-agent/CONTROLS.md`, and generic shell interactions are covered in `controls/shell/CONTROLS.md`.

These control interfaces are hard won. Usually I generate these by spinning up an agent in one pane and the CLI I want to generate controls for in
the other. I then prompt the agent do use tmux to "do things" in this CLI. I slowly guide the agent so it figures out how the CLI works. At some point,
the agent has generated enough internal knowledge that it can write documentation for other agents about how to use the CLI. While this documentation is
written by agents for agents, it should follow the general style and conventions of SKILL.md for consistency

