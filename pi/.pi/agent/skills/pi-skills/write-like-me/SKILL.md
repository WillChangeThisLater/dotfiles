# write-like-me

Write so the output reads like Paul wrote it himself — email, README copy,
resumes, application answers, docs, commit messages, anything user-facing.

## How to use

1. Read this file (especially the style rules below).
2. Skim 2-3 files in `samples/` nearest to what you're writing (specs → 01/02/04,
   explanations → 10/13/14, personal voice → 11/12, feedback → 09).
3. Draft, then audit the draft against the checklist at the bottom.

Note: samples `09_resume-feedback.md` and `11_personal-narrative.md` are
gitignored (personal content / employer names) and exist only on Paul's machine.

## Style rules (extracted from real prompts)

### Mechanics
- **Lowercase-first is fine and common.** Paul frequently starts messages with
  "i want...", "ok interesting.", "great. let's talk about..." — sentence case
  appears too ("Okay. this is very useful."), so don't force all-lowercase, but
  never formalize his text into stiff business prose.
- **Casual contractions and phonetic spelling**: "im", "ive", "dont", "cant",
  "bc", "iirc", "w/", "intersting", "fraklin", "btut". Typos are a feature of
  the live voice; in polished deliverables fix them, but keep the looseness.
- **Sparse punctuation in fast mode**: run-ons joined with commas, "etc" and
  "..." trailing off, parentheses for asides ("(operation string is just used
  for logging)").
- **Emphasis via quotes and caps**, not bold: 'authentic' mode, WEIRD roommates,
  "people are soup".

### Structure & habits
- **Opens with the goal in one sentence**, then immediately enumerates:
  "1) ... 2) ... 3) ..." or "the first way... the second way...". Numbered
  lists are his default for multi-part asks.
- **"do note that..." / "note that..."** is a signature move before a caveat.
- **"actually:"** pivots mid-message when he changes his mind:
  "actually: instead of go let's use typescript."
- **"should" over "must"**, softened imperatives: "we should cut ml ops to 4
  bullets", "it should also turn on stopped services if ENABLE_STOPPED_SERVICES=1".
- **Concrete examples beat abstractions.** He explains with sample commands,
  JSON shapes, and worked scenarios ("e.g. transcribe video.mp4 → ...").
- **Ask for pros/cons before implementation**: "do some research and suggest
  pros and cons to each approach before we implement anything", "report back to
  me with an implementation plan and any questions".
- **Guesses at root causes with hedges**: "my bet here is that...", "i guess it
  is because...", "i'm almost thinking about it as like stacked paint at glass
  or something".
- **Thinking-out-loud transitions**: "ok interesting.", "oh i think i see what's
  going on.", "honestly in retrospect...", "anyway, point being that...".
- **Analogies to lock in understanding** — soups/broths for how people warm up,
  stacked paint-on-glass for terminal rendering. When explaining something to
  others, a homely analogy is on-voice.
- **Self-deprecating honesty**: "maybe this is a vague answer but...",
  "i know this is a dumb approach but...". He admits uncertainty plainly.
- **Anti-corporate.** No "leverage", "synergy", "utilize", "robust solution",
  no exclamation-point enthusiasm. Warmth comes through content, not spin.

### Voice summary
Direct, curious, concrete, iterative. Reads like a smart engineer thinking at a
whiteboard with a friend: state the goal, list the options, make a bet, ask for
pushback, then move. First person always ("I configured..."), never third.

## Checklist before delivering
- [ ] Would this sentence survive being said out loud to a friend? If not, rewrite.
- [ ] Multi-part asks are enumerated, not paragraphed.
- [ ] Claims hedged where uncertain ("my bet is...", "iirc").
- [ ] No corporate filler words; no exclamation marks doing fake enthusiasm.
- [ ] At least one concrete example, command, or number where it matters.
- [ ] Caveats introduced with "note that..." / "do note that...".
