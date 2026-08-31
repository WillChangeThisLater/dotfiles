# job-boards.greenhouse.io controls

## Quick start

```bash
# open a Greenhouse posting
browser go https://job-boards.greenhouse.io/<company>/jobs/<job-id> --port 9222 --timeout 10000

# click "Apply" to open form
browser click "text=Apply" --tab <TAB_ID> --port 9222 --timeout 5000
```

## Reliable patterns

- Greenhouse application pages often include these stable field IDs:
  - `#first_name`
  - `#last_name`
  - `#email`
  - `#phone`
  - `#candidate-location`
  - `#resume` (file input)
  - `#cover_letter` (file input)
- Custom questions often appear as IDs like:
  - `#question_<digits>`
- EEO fields often appear as:
  - `#gender`
  - `#hispanic_ethnicity`
  - `#veteran_status`
  - `#disability_status`

Use `browser eval` to inspect current IDs if a form is customized:

```bash
browser eval "JSON.stringify([...document.querySelectorAll('input,textarea,select')].map(e=>({id:e.id,type:e.type})),null,2)" --tab <TAB_ID> --port 9222 --timeout 5000
```

## Resume attach guidance

### Preferred (most reliable): native UI attach button
- Scroll to `Resume/CV` section.
- Click `Attach` in that section only.
- Verify uploaded filename appears in the form (e.g., `*.pdf` with remove `x` icon).

### Fallback: direct file input
Sometimes `browser type "#resume" "/path/file.pdf"` works, but it can silently fail on some Greenhouse renders.
Always verify via UI text or `files.length`.

## Known issues / gotchas

- Greenhouse forms are often very long; scrolling can reset context.
- Some location fields require selecting an autocomplete suggestion, not just typed text.
- EEO dropdowns may render custom components where `.value` from JS is not trustworthy; prefer visual verification.
- In split-view X11 setups, OAuth/login popups (e.g., accidental Google Drive click) may appear in side panes and confuse automation.
- Avoid clicking provider buttons (`Dropbox`, `Google Drive`) unless intentionally using those flows.

## Verification checklist before final submit

1. Required fields visibly filled (name/email/phone/location/how heard).
2. Resume filename visible under `Resume/CV`.
3. Optional profile links/website set as intended.
4. EEO answers set (if user provided preferences).
5. `Submit application` button visible, but do **not** click without explicit user approval.
