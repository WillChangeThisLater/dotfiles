---
name: notify-blocked
description: Ping paul on ntfy (topic paul-blocked-agents) when you are genuinely BLOCKED and need hands-on human action — sudo passwords, logins, physical steps, urgent approvals. Not for "what next?" questions.
---

# Notify Blocked

When you hit a blocker **only a human can resolve** (password entry, MFA/login,
physical access, an approval that gates all further work), notify paul on his
phone via ntfy so he can act without watching the terminal.

## When to use (and not use)

**USE** when work is blocked and only paul can unblock it:
- a sudo/root password must be typed in a specific pane
- a login, MFA prompt, or payment page is waiting on him
- something must be clicked/physically done at his desk
- a time-critical approval (expiring code, rate-limit window)

**DON'T** use for:
- "what should I do next?" / planning advice
- status updates, FYIs, or questions that can wait for his next message
- anything you could resolve yourself with more investigation

## How to send

Use the helper script:

```bash
~/.pi/agent/skills/agent-generated/notify-blocked/scripts/notify-blocked.sh \
  -m "Sudo needed in tmux 0:3.1 to install openjdk-21-jdk — please enter your password there."
```

The message (-m) is the only required arg. Optional:
- `-n <name>` your agent name (auto-detected from the messaging skill otherwise)
- `-t <session:window.pane>` your tmux target (auto-detected otherwise)
- `-s <title>` custom notification title

Delivery target: `https://ntfy.sh/paul-blocked-agents` (high priority).

## Message rules

1. **1–2 sentences max.** Paul reads these on his phone.
2. **Always include the full tmux location `session:window.pane`** (e.g. `0:3.1`)
   when the action happens in a pane — never a bare pane index. If it's not in
   tmux, say where it is instead (URL, app, machine).
3. Say exactly **what he needs to do** ("enter your sudo password", "complete
   2FA at <url>"), not what happened to you.
4. Start with the verb — he should know within 2 seconds what's being asked.

Good examples:

```
Sudo needed in tmux 0:3.1 — please enter your password there so apt can install openjdk-21-jdk.
Login page open in the browser at github.com/login — need you to complete 2FA, build is paused.
```

## If auto-detection may be wrong

The script auto-detects name and tmux target, but tmux context can drift (see
the tmux skill's "context drift" note). If you were told to work in a specific
pane, pass `-t` explicitly with the full `session:window.pane` target.

## Provenance

Created 2026-10-10 during the REA (reverse-engineer-anything) session: while
installing a JDK+Ghidra via tmux, paul had to be prompted in-pane for a sudo
password and asked for a push-notification mechanism so agents don't have to
wait on him watching the terminal.
