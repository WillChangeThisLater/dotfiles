# Pokemon Showdown Automation Guide

**Site**: https://play.pokemonshowdown.com  
**Last Updated**: 2026-03-18  
**Status**: Active testing

## Overview

Pokemon Showdown is a browser-based Pokemon battle simulator. This guide documents the automation patterns discovered through hands-on testing with the browser CLI.

## Authentication

### Logging In

1. Click the "Choose name" button to open login dialog:
   ```
   click "button.button[name='login']" --tab <TAB_ID>
   ```

2. Type username into input field:
   ```
   type "input.textbox[name='username']" "<USERNAME>" --tab <TAB_ID>
   ```

3. Click submit button:
   ```
   click "form button.button[type='submit']" --tab <TAB_ID>
   ```

**Verification**: Check userbar for username:
```
eval "document.querySelector('.userbar')?.innerText" --tab <TAB_ID>
```

## Navigation

### Starting a Battle

1. Close current battle room (if any):
   ```
   click "button.closebutton" --tab <TAB_ID>
   ```

2. Click Battle! button:
   ```
   click "button.button[name='search']" --tab <TAB_ID>
   ```

### Closing a Battle

```
click "button.closebutton" --tab <TAB_ID>
```

## Battle Automation

### Battle State Monitoring

**Get battle log** (most reliable for state):
```
eval "document.querySelector('.battle-log')?.innerText?.split('\\n').slice(-10).join('\\n')" --tab <TAB_ID>
```

**Get current turn**:
```
eval "document.querySelector('.battle-log')?.innerText?.split('\\n').slice(-1).join('\\n')" --tab <TAB_ID>
```

### Pokemon Switching

**Find available Pokemon**:
```
find "<POKEMON_NAME>" --tab <TAB_ID>
```

**Switch to specific Pokemon**:
```
# Method 1: By position (1st, 2nd, 3rd, etc.)
click "button.has-tooltip[name='chooseSwitch']:nth-of-type(<N>)" --tab <TAB_ID>

# Method 2: By name (requires finding button first)
find "<POKEMON_NAME>" --tab <TAB_ID>
click "button.has-tooltip[name='chooseSwitch']:has-text('<POKEMON_NAME>')" --tab <TAB_ID>
```

**Switch selector pattern**:
- `button[name='chooseSwitch']` - Switch buttons
- `button[name='chooseDisabled']` - Currently active Pokemon (disabled)
- `button.has-tooltip` - Pokemon with tooltips

### Using Moves

**Get available moves**:
```
eval "Array.from(document.querySelectorAll('button[name=\"chooseMove\"]')).map(btn => btn.innerText.trim().split('\\n')[0])" --tab <TAB_ID>
```

**Execute a move**:
```
# Method 1: By type (most reliable)
click "button.movebutton.type-<TYPE>[name='chooseMove']" --tab <TAB_ID>

# Method 2: By position
click "button[name='chooseMove']:nth-of-type(<N>)" --tab <TAB_ID>

# Method 3: Find by name first
find "<MOVE_NAME>" --tab <TAB_ID>
# Then click the button.movebutton.type-<TYPE>
```

**Move button selectors**:
- `button.movebutton.type-<TYPE>` - Move buttons with type class
- `button[name='chooseMove']` - All move buttons
- `div.movemenu` - Move menu container

### Terastallization

**Trigger Terastallize**:
```
click "label.megaevo" --tab <TAB_ID>
```

**Alternative selector**:
```
click "div.megaevo-box" --tab <TAB_ID>
```

**After Tera**: The Tera type selector will appear - click the desired type button.

**Verification**: Battle log will show "has Terastallized into the <TYPE>-type!"

## Battle State Interpretation

### Battle Log Patterns

**Turn start**:
```
"Turn <N>"
```

**Pokemon sent out**:
```
"Go! <POKEMON_NAME>!"
"<OPPONENT> sent out <POKEMON_NAME>!"
```

**Moves executed**:
```
"<POKEMON> used <MOVE>!"
"It's super effective! (<POKEMON> lost X% of its health!)"
"It's not very effective..."
"A critical hit!"
```

**Switches**:
```
"<POKEMON>, come back!"
"<POKEMON> went back to <USER>!"
"<USER> sent out <POKEMON>!"
```

**Status effects**:
```
"<POKEMON> was burned!"
"<POKEMON> restored a little HP using its Leftovers!"
"<POKEMON> was hurt by its burn!"
```

**Terastallization**:
```
"<POKEMON> has Terastallized into the <TYPE>-type!"
```

**Forfeits/Victories**:
```
"<USER> forfeited."
"<USER> lost due to inactivity."
"<POKEMON> fainted!"
"<USER> won the battle!"
```

## Timing Considerations

### Critical Timing Issues

1. **Opponent switching** (Volt Switch/U-turn):
   - Battle shows attacking Pokemon briefly
   - Wait for "Go! <NEW_POKEMON>!" message
   - **Don't act until turn confirmation**

2. **Battle pauses**:
   - Opponent may be thinking
   - Poll battle log every 5-10 seconds
   - Look for "Turn <N>" to confirm ready state

3. **Move execution**:
   - Execute moves immediately when ready
   - Use 5-second timeout for commands
   - `--wait 2000` after clicks is usually sufficient

### Recommended Polling Pattern

```bash
# Poll battle state every 5 seconds
while true; do
  npx tsx src/index.ts --port 9222 eval "document.querySelector('.battle-log')?.innerText?.split('\\n').slice(-3).join('\\n')" --tab <TAB_ID> --timeout 5000
  sleep 5
done
```

## Common Issues & Solutions

### Issue: Can't find move buttons
**Solution**: Battle may not be ready. Check battle log for "Turn <N>" message.

### Issue: Wrong Pokemon switched
**Solution**: Use `:nth-of-type()` based on position in switch menu, not name.

### Issue: Terastallize button doesn't work
**Solution**: Click `label.megaevo`, not `button`. Tera type selector appears after.

### Issue: Command times out
**Solution**: Opponent may be switching. Wait for battle log to confirm new turn.

## Battle Flow Example

```bash
# 1. Start battle
click "button.button[name='search']" --tab <TAB_ID>

# 2. Wait for battle to start
eval "document.querySelector('.battle-log')?.innerText?.split('\\n').slice(-5).join('\\n')" --tab <TAB_ID>

# 3. Check opponent and your Pokemon
# (Parse battle log for "Go! <YOUR_POKEMON>!" and "<OPPONENT> sent out <POKEMON>!")

# 4. Decide on switch or move
# If switching:
find "<TARGET_POKEMON>" --tab <TAB_ID>
click "button.has-tooltip[name='chooseSwitch']:nth-of-type(<N>)" --tab <TAB_ID>

# If attacking:
eval "Array.from(document.querySelectorAll('button[name=\"chooseMove\"]')).map(btn => btn.innerText.trim().split('\\n')[0])" --tab <TAB_ID>
click "button.movebutton.type-<TYPE>[name='chooseMove']" --tab <TAB_ID>

# 5. Poll for result
eval "document.querySelector('.battle-log')?.innerText?.split('\\n').slice(-5).join('\\n')" --tab <TAB_ID>

# 6. Repeat from step 2 until battle ends
```

## Selector Reference

| Element | Selector | Notes |
|---------|----------|-------|
| Login button | `button.button[name='login']` | Opens login dialog |
| Username input | `input.textbox[name='username']` | Text input field |
| Battle button | `button.button[name='search']` | Starts random battle |
| Close button | `button.closebutton` | Closes battle room |
| Switch button | `button.has-tooltip[name='chooseSwitch']` | Switch Pokemon |
| Move button | `button.movebutton.type-<TYPE>` | Execute move |
| Terastallize | `label.megaevo` | Tera activation |
| Battle log | `.battle-log` | Battle state container |
| Userbar | `.userbar` | Shows logged in username |

## Tips for Automation

1. **Always poll battle log first** - It's the source of truth
2. **Use specific selectors** - `type-Psychic` is better than `:nth-of-type(1)`
3. **Handle switching carefully** - Wait for "Go!" messages
4. **Keep commands fast** - Use 5-10 second timeouts
5. **Verify actions** - Check battle log after each action
6. **Terastallize strategically** - One Tera per battle, choose wisely

## Testing Notes

- **Battle timers**: Opponents may have 120 seconds per turn
- **Forfeits**: Common in random battles, watch for "left" or "forfeited"
- **Spikes/entry hazards**: Damage on switch, factor into HP calculations
- **Burns/status**: Continuous damage, factor into survival calculations

## Future Improvements

- [ ] Add Tera type selector automation
- [ ] Handle multi-turn moves (Fly, Dig, etc.)
- [ ] Add move priority detection
- [ ] Create battle state parser utility
- [ ] Add HP tracking across turns
- [ ] **CRITICAL**: Fix Teambuilder format selection - clicks on format buttons don't persist selection (eval reports success but UI shows "Select a format"). Needs investigation - possibly requires dispatching additional events or waiting for state update.
