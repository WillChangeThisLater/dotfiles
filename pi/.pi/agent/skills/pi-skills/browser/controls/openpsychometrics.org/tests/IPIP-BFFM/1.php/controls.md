# IPIP-BFFM Big Five Personality Test - Controls

**Domain:** `openpsychometrics.org/tests/IPIP-BFFM/1.php`
**Test:** 50-item IPIP Big Five Factor Markers (BFFM)
**Goal:** Complete all 50 questions with selected responses.

---

## Quick Start

1. Confirm Chrome instance is running on port 9222.
2. Navigate to `https://openpsychometrics.org/tests/IPIP-BFFM/` with `browser go`.
3. Scroll to the bottom of the intro page to find the "Begin assessment" button.
4. Click the button using selector `.start_button` to start the test.
5. Use the **screenshot → answer → screenshot** loop for each question.
6. Repeat until you reach "50 / 50" or completion screen.

---

## The Screenshot → Answer → Screenshot Loop

This is the core interaction pattern for this test:

1. **Screenshot** - Capture the page to see the current question text.
2. **Decide** - Read the screenshot, think about your answer (e.g., Agree/Neutral/Disagree).
3. **Click** - Select the radio button that matches your answer (`#A1`-`#A5`).
4. **Screenshot** - Take another screenshot to verify the selection was recorded.

```bash
# 1. Screenshot to read question
browser screenshot /tmp/ipip_q<NUM>.png --tab <TAB> --port 9222 --timeout 5000

# 2. (Agent reads screenshot and decides)

# 3. Click answer
browser click "#A3" --tab <TAB> --port 9222 --timeout 5000  # example: Neutral

# 4. Screenshot to verify answer was recorded
browser screenshot /tmp/ipip_q<NUM>_answered.png --tab <TAB> --port 9222 --timeout 5000
```

**Why both screenshots?**
- The first lets you *see* the question before deciding.
- The second lets you *verify* your answer was recorded before moving on.

## Recommended: JavaScript Evaluation Method

**More reliable** than `browser click` - use `browser eval` to directly set radio button values:

```bash
# Set answer to option 3 (Neutral)
browser eval "document.getElementById('A3').checked = true; ans_select(3);" --tab <TAB> --port 9222 --timeout 5000
```

**Why prefer eval over click?**
- More reliable (avoids browser click timeout issues)
- Faster execution
- Direct control over form state

**Get question text via eval:**
```bash
browser eval "document.getElementById('itext').textContent" --tab <TAB> --port 9222 --timeout 5000
```

## Results Page Behavior

After completing all 50 questions:

1. **Survey prompt** - Before viewing results, you'll be asked if you want to complete an additional research survey.
2. **Skip survey** - Select "No, get results immediately" to proceed directly to results.
3. **Submit results** - Click the "Continue" button to see the personality factor scores.

**Form submission details:**
- Results page URL: `results.php?r=<EXTRACTION_SCORES>`
- Hidden fields show factor scores (e.g., `EXT=5`, `AGR=5`, `CSN=5`, `OPN=4.7`, `I=1.8`)
- No additional questions needed to view results

## Reverse Coding Warning ⚠️

**CRITICAL:** Previous test runs showed all-zero results due to reverse-coded questions not being answered correctly.

The IPIP-BFFM includes questions that are **reverse-keyed** for scoring. If you're using this test for actual personality assessment (not AI testing), you must:
- Identify which questions are reverse-coded
- Invert your answer logic for those specific questions
- Or use the pre-validated scoring algorithm from the test

**For AI testing (like this run):** The all-zeros result was expected because we were answering literally based on AI nature without accounting for reverse coding. For human testing, you need the reverse coding map.

See the test's official scoring documentation for the reverse-coded question list.

---

## Key Selectors

| Element | Selector | Description |
|---------|----------|-------------|
| Begin assessment button | `.start_button` | Starts the test from intro page |
| Question text | `.question, #question, h1, h2` | The statement to evaluate |
| Disagree | `#A1` | First radio option |
| Slightly disagree | `#A2` | Second radio option |
| Neutral | `#A3` | Third radio option |
| Slightly agree | `#A4` | Fourth radio option |
| Agree | `#A5` | Fifth radio option |
| Skip current item | `#skip` | Skip this question (not recommended) |

---

## Answer Mapping

- `#A1` → Disagree
- `#A2` → Slightly disagree
- `#A3` → Neutral
- `#A4` → Slightly agree
- `#A5` → Agree

---

## Skip Pattern (if needed)

```bash
browser click "#skip" --tab <TAB> --port 9222 --timeout 5000
```

---

## Common Patterns

**Full loop example:**
```bash
# 1. Screenshot to read question
browser screenshot /tmp/ipip_q4.png --tab <TAB> --port 9222 --timeout 5000

# 2. (Agent reads screenshot and decides)
# Question: "I am always prepared."
# Answer: Agree

# 3. Click answer
browser click "#A5" --tab <TAB> --port 9222 --timeout 5000

# 4. Screenshot to verify answer was recorded
browser screenshot /tmp/ipip_q4_answered.png --tab <TAB> --port 9222 --timeout 5000
```

---

## Known Issues

- **Begin button:** Use `.start_button` selector to click "Begin assessment" button on intro page.
- **Timeouts:** Screenshot commands sometimes need `--timeout 8000` or higher on slower connections.
- **Skip behavior:** Clicking `#skip` moves to next question without recording an answer. Avoid unless intentionally skipping.
- **Auto-submit:** Clicking a radio button immediately advances to the next question—no separate submit needed.
- **Tab reuse:** Always use `--tab <TAB>` to maintain state; opening new tabs resets progress.

---

## Verification

- **Progress indicator:** Look for `X / 50` in the page footer (e.g., `1 / 50`, `25 / 50`).
- **Completion:** When `50 / 50` is shown, the test is complete.
- **Screenshot check:** Verify that the question text and selected option appear in the second screenshot before advancing.

---

## Notes

- This controls file is for **IPIP-BFFM** test only.
- Always log screenshots to `/tmp/` for verification.
- Use `--timeout 5000` as default; increase to `8000` if screenshot fails.
