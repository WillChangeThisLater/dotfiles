# Controls Overview

Controls are interface-specific interaction guides (CLI and TUI) used with the tmux skill.

- The tmux skill provides generic pane I/O (`send-keys`, `capture-pane`).
- Controls provide protocol details for a specific interface (menus, key behavior, recovery, safe command patterns).

## Directory structure

- `controls/<interface>/CONTROLS.md` — rules and recipes for one interface (CLI or TUI).
  - Examples:
    - `controls/pi-agent/CONTROLS.md`
    - `controls/shell/CONTROLS.md`

## When to use controls

After tmux init (target lock + starting-state capture), identify the active interface in the pane.

- If a matching controls file exists, read and apply it before complex interaction.
- If no controls file exists, proceed cautiously with single-step send/capture loops and state that no interface-specific controls were found.
- If no controls file exists and the interaction looks repeatable, propose creating one to the user.
- Never create a new controls file silently; get explicit user approval first.

## Global patterns (apply to all controls)

1. **Sticky target first**
   - Respect active target (`session:window.pane`) established during init.
   - Do not switch targets without explicit user confirmation.

2. **One-step interaction loop**
   - Send one action, wait briefly, capture output, decide next action.

3. **Prompt/state hygiene**
   - Reset ambiguous state before complex actions (`C-c`, `Escape`, `BSpace` as appropriate).

4. **Capability checks before assumptions**
   - Verify tools/options in-pane before using advanced syntax or flags.

5. **Small, observable actions**
   - Prefer short, testable commands over large multi-line payloads.

6. **Recovery-first behavior**
   - If behavior is unexpected, stabilize pane state before continuing.

## TUI-specific caution

TUIs may not behave like line-based shells.

- Typed text may be treated as search/filter input, not a command.
- `Enter`, arrows, `Escape`, and control keys may have interface-specific meanings.
- Always capture pane state after each key sequence.
- Prefer short key sequences and verify state transitions before continuing.
- If state is unclear, use documented exit/reset keys for that interface and re-capture.

## Maintenance expectations (authoritative meta rule)

Controls are living docs.  
If an agent discovers:
- a reliable new interaction pattern, or
- a broken/incorrect recipe,

the agent should propose a targeted controls update.

A good proposal includes:
1. exact failing command or behavior,
2. corrected tmux recipe,
3. short rationale based on captured pane output.

Prefer small edits that improve reliability and reusability.

## New controls file proposal policy

When you encounter an interface (CLI or TUI) without `controls/<interface>/CONTROLS.md`:

1. Explicitly notify the user.
2. Ask permission before creating a new controls file.
3. If approved, create a focused controls file with concrete tmux recipes and recovery steps.

Suggested prompt pattern:

> “Looks like I’m interacting with `<interface>`, and we don’t have a control file for it yet (`controls/<interface>/CONTROLS.md`). Want me to draft one?”

## Authoring style for controls

- Use concrete `tmux send-keys` / `tmux capture-pane` recipes.
- Keep steps explicit and sequential.
- Include common failure modes and recovery shortcuts.
- Use `session:window.pane` target format consistently.
