---
name: web-search
description: Meta-skill for researching on the web using browser-tools and lynx; focuses on query strategy, source triage, and summarizing findings with citations.
---

# Web Search Playbook

Use this skill whenever the user needs up-to-date information, troubleshooting steps sourced from the web, or comparisons that aren’t already in the repo. It orchestrates whatever search tools your repo provides (e.g., `browser-tools` for Chrome automation, `lynx` for text-mode browsing) so you can search efficiently and report trustworthy results.

## When to Use
- User explicitly asks you to “look it up,” “check Hacker News,” “see what people recommend,” etc.
- You need confirmation of facts, recent news, pricing, or documentation outside the local project.
- Troubleshooting production errors where error codes or stack traces should be searched verbatim.

Skip this skill if the answer is clearly available in the current repository/docs or if the user forbids external browsing.

## Tool Selection
| Situation | Recommended Tool |
| --- | --- |
| Need JS-heavy pages, interact with forms, take screenshots | `browser-tools` or any Chrome/Firefox automation skill (nav/eval/screenshot) |
| Need fast text dumps, search-engine results, or lightweight pages | `lynx` (or similar text-mode browser) via `lynx -dump -nolist URL` |
| Large research task with multiple findings | Pair with `planning-with-files` to log URLs, notes, and status |

Always mention which tool was used and save captures (e.g., `/tmp/search-result.txt`) when results will be referenced later.

## Workflow

1. **Clarify Objective**
   - Restate the user’s question and ask for missing parameters (time range, geography, stack version) before searching.
   - Example prompt: “To narrow results, do you care about the last 6 months or any time?”

2. **Craft Strong Queries**
   - Start specific: include error codes, API names, and key symptoms.
   - Use quotes for exact phrases; use `-term` to exclude noise.
   - Apply operators when helpful: `site:docs.oracle.com`, `filetype:pdf`, `intitle:"error 500"`.
   - Try synonyms (e.g., “pagination cursor” vs. “infinite scroll offset”).

3. **Execute Searches**
   - **DuckDuckGo Lite via lynx**:
     ```bash
     lynx -dump -nolist "https://duckduckgo.com/lite/?q=<encoded query>"
     ```
   - **Browser-based search** (if a visual SERP or login is required):
     ```bash
     ./browser-nav.js "https://www.google.com/search?q=<query>"
     ```
   - Capture the SERP output (text dump or screenshot) for reference.

4. **Triage Results**
   - Prioritize official docs, reputable blogs, recent timestamps, and community answers with clear acceptance.
   - Open the top 2–4 promising links; skim headings before deep reading.
   - If all matches are low-quality, reformulate the query.

5. **Extract and Record Evidence**
   - For text-friendly pages:
     ```bash
     lynx -dump -nolist <url> > /tmp/<slug>.txt
     ```
   - For dynamic pages:
     ```bash
     ./browser-content.js <url> > /tmp/<slug>.md
     ```
   - Note publication dates, author credibility, and key quotes in your notes (or `findings.md` for long tasks).

6. **Ask the User When Needed**
   - If the search surfaces multiple conflicting approaches (“Node vs. Python solution”), summarize trade-offs and ask the user which direction to pursue.
   - When results hinge on environment details (cloud provider, OS), confirm before acting.

7. **Iterate**
   - Use new keywords found in articles (library names, error IDs) to refine the query.
   - Switch engines (e.g., GitHub search, Stack Overflow, vendor docs) if the general web is noisy.

8. **Summarize with Citations**
   - Provide at least two independent sources when possible.
   - Include direct URLs and the date accessed.
   - Call out uncertainties or remaining questions and suggest next searches if needed.

## Practical Tips
- **Time filters:** add `past year` or `past month` options on DuckDuckGo/Google if results might be stale.
- **Language filters:** append the framework/language (`"react 18" suspense`) to avoid irrelevant hits.
- **Notebooking:** for multi-hour research, keep a running bullet list of URLs + takeaways in `findings.md` so you don’t revisit the same pages.
- **Conflicting sources:** explicitly state disagreements and why you prefer one (e.g., official docs dated 2026 vs. an outdated 2019 blog).

## Hand-off Checklist
- State what was searched (queries, operators, time filters).
- Enumerate sources with short annotations.
- Attach/cite any saved dumps or screenshots from `lynx`/`browser-tools`.
- Flag any assumptions you made so the user can correct them.

## Learned Lessons

Add new heuristics here whenever you discover better querying patterns, niche documentation sources, or ways to combine search tools like `browser-tools` and `lynx` more effectively.
