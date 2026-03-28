# Pokemon Showdown Automation Session Notes

**Date**: 2026-03-17  
**Session**: Battle automation & Teambuilder testing

## Summary

This session tested the browser CLI's ability to automate Pokemon Showdown, including:
- Logging in and authentication
- Starting and playing battles
- Pokemon switching and move execution
- Terastallization
- Teambuilder navigation

## What Worked Well

### Battle Automation
✅ **Login flow**: Username input and "Choose name" button work reliably  
✅ **Starting battles**: Battle button click works consistently  
✅ **Battle state monitoring**: Battle log parsing is the source of truth  
✅ **Pokemon switching**: Switch commands work when selectors are precise  
✅ **Move execution**: Move buttons execute successfully  
✅ **Terastallization**: Tera button click works  
✅ **Tab persistence**: Reusing tab IDs across commands works perfectly  
✅ **Process cleanup**: No hanging processes after the timeout bug was fixed

### Command Performance
- Average command execution: 1-3 seconds
- Battle polling every 5-10 seconds works well
- Commands exit cleanly without hanging (after timeout fix)

## Known Issues & Edge Cases

### 🔴 CRITICAL: Teambuilder Format Selection
**Issue**: Format selection does not persist in UI despite eval reporting success.

**Symptoms**:
- `document.querySelector('button.select.formatselect')?.innerText` returns "[Gen 3] OU"
- Screenshot shows "Select a format"
- Clicking format options via eval works, but UI doesn't update

**Attempted Solutions**:
1. Click button → select option → verify (doesn't persist)
2. Search for format → click result (doesn't persist)
3. Direct click on option button (doesn't persist)
4. Click → setTimeout → click (doesn't persist)

**Possible Causes**:
- Missing event dispatch (input, change, etc.)
- State not updating after click
- UI requires additional interaction
- React/state management issue

**Workaround**: Manual format selection required until fixed.

### 🟡 Medium: Teambuilder Pokemon Selection
**Issue**: Clicking Pokemon in selection list doesn't add them to team reliably.

**Symptoms**:
- `li.result:has-text('Cloyster')` click times out
- `a:has-text('Cloyster')` click doesn't navigate
- Eval-based click (`element.click()`) works sometimes

**Workaround**: Use eval-based element.click() instead of browser CLI click command.

### 🟡 Medium: Battle Timing
**Issue**: Battle state changes during opponent turns can cause command timeouts.

**Symptoms**:
- Commands timeout during opponent switching (Volt Switch/U-turn)
- Battle pauses while opponent is thinking
- Need to wait for "Turn X" confirmation before acting

**Solution**: Poll battle log every 5-10 seconds, wait for "Turn X" before executing moves.

## Battle Automation Learnings

### Battle Log Patterns (Source of Truth)
```
Turn 1
[Opponent] sent out [Pokemon]!
Go! [Your Pokemon]!

[Pokemon] used [Move]!
It's super effective! ([Pokemon] lost X% HP!)
[Pokemon] fainted!

[Pokemon], come back!
Go! [New Pokemon]!

[Pokemon] has Terastallized into the [Type]-type!
```

### Battle Flow
1. Start battle → wait for "Turn 1"
2. Poll battle log every 5-10 seconds
3. Check "Go! [Your Pokemon]!" for your turn
4. Execute move or switch
5. Wait for opponent's move
6. Repeat until battle ends

### Timing Considerations
- **Opponent switching**: Wait for new Pokemon to appear
- **Turn confirmation**: Look for "Turn X" message
- **Move execution**: Execute immediately when ready
- **Timer awareness**: 120 seconds per turn (configurable)

## Teambuilder Automation Learnings

### Format Selection (Broken)
```
# This doesn't persist:
eval "document.querySelector('button.select.formatselect')?.click()"
eval "const x = Array.from(document.querySelectorAll('button.option[name=\"selectFormat\"]')).find(b => b.innerText.includes('[Gen 3]')); if (x) x.click()"
```

### Pokemon Selection (Works with Eval)
```
# Works:
eval "const pokemon = Array.from(document.querySelectorAll('li.result')).find(el => el.innerText.includes('Cloyster')); if (pokemon) pokemon.click()"

# Doesn't work:
click "li.result:has-text('Cloyster')"
```

### Team Navigation
- Teams saved in localStorage
- "[gen3ou] Untitled 1" format in team list
- Click team → edit Pokemon → configure moves/items

## Recommendations for Future Automation

### Battle Automation
1. **Always poll battle log first** - It's the source of truth
2. **Use 5-10 second polling intervals** - Balance speed with reliability
3. **Wait for "Turn X" confirmation** - Don't act during opponent turns
4. **Execute moves quickly** - 180-second turn timer (usually)
5. **Verify with screenshots** - eval results may not reflect UI state

### Teambuilder Automation
1. **Use eval-based clicks** - More reliable than click command
2. **Verify with screenshots** - UI state may not match eval results
3. **Manual format selection** - Until format selection bug is fixed
4. **Consider import/export** - May be more reliable than UI editing

### General
1. **Screenshot verification is critical** - eval can be misleading
2. **Tab persistence works great** - Reuse tab IDs across commands
3. **Commands exit cleanly** - Timeout bug is fixed
4. **Battle state is dynamic** - Poll frequently during battles

## Next Steps

### High Priority
1. **Fix Teambuilder format selection** - Investigate event dispatch/state update
2. **Document battle timing patterns** - Create battle state machine
3. **Create battle automation helper script** - Automate polling + decision making

### Medium Priority
1. **Teambuilder Pokemon selection automation** - Refine eval-based approach
2. **Battle move recommendation system** - AI-assisted move selection
3. **Team import/export automation** - Batch team creation

### Low Priority
1. **Full battle automation** - Complete AI opponent
2. **Team optimization** - Suggest team improvements
3. **Multi-tab battles** - Manage multiple battles simultaneously

## Technical Notes

### Selected Tab ID
`D9D90B694EB97A2E6E7CE2778BD4451F` (Pokemon Showdown tab)

### Commands Tested
- `go` - Navigation ✅
- `click` - Button clicks ⚠️ (works for battles, unreliable for teambuilder)
- `eval` - JavaScript execution ✅ (most reliable)
- `find` - Element search ✅
- `screenshot` - Visual verification ✅
- `type` - Text input ✅ (login)
- `tabs` - Tab management ✅

### Tooling
- Browser CLI with --port 9222 (Chrome DevTools)
- Tab ID persistence for session management
- Battle log parsing for state monitoring
- Screenshot verification for UI state

---

**Session Duration**: ~2 hours  
**Battles Played**: 3 (2 wins, 1 forfeit)  
**Teambuilder**: Gen 3 OU format, Cloyster lead started  
**Status**: Good progress, known issues documented
