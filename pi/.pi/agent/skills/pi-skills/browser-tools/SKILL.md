---
name: browser-tools
description: Interactive browser automation via Chrome DevTools Protocol. Use when you need to interact with web pages, test frontends, or when user interaction with a visible browser is required.
---

# Browser Tools

Chrome DevTools Protocol tools for agent-assisted web automation. These tools connect to Chrome running on `:9222` with remote debugging enabled.

## Setup

Run once before first use:

```bash
cd {baseDir}/browser-tools
npm install
```

## Start Chrome (once per tmux session)

```bash
{baseDir}/browser-start.js              # Fresh profile
{baseDir}/browser-start.js --profile    # Copy user's profile (cookies, logins)
{baseDir}/browser-start.js --binary /path/to/chrome  # Override auto-detected binary
```

- The launcher now autodetects Chrome/Chromium paths on macOS, Linux, and Windows. Override detection with `BROWSER_TOOLS_CHROME`, `CHROME_PATH`, or `--binary`.
- If Chrome is already listening on `:9222`, the script exits early so you can keep a persistent session alive across commands.
- Always run this in the tmux window where you want Chrome logs so you can revisit the session later.

### Persistent sessions

1. Create/attach a tmux window just for browser tooling (e.g., `tmux new-window -n browser`).
2. Run `browser-start.js` once. Leave it running for the duration of the task.
3. Reuse the same Chrome instance with `browser-nav.js`, `browser-eval.js`, screenshots, etc. Tabs stay open between commands, so you don't need to renavigate after every step.
4. When you're done, close Chrome (Ctrl+C the process or quit from the GUI) so the remote debugging port is freed.

## Navigate

```bash
{baseDir}/browser-nav.js https://example.com
{baseDir}/browser-nav.js https://example.com --new
```

Navigate to URLs. Use `--new` to open in a new tab instead of reusing the current one.

## Evaluate JavaScript

### Quick expressions

```bash
{baseDir}/browser-eval.js 'document.title'
{baseDir}/browser-eval.js 'document.querySelectorAll("a").length'
```

Inline code is treated as an expression. Wrap multi-step logic in an IIFE if you need statements:

```bash
{baseDir}/browser-eval.js '(function () { /* ... */ })()'
```

### Multi-line scripts without painful quoting

Use `--file` or `--stdin` to execute longer scripts directly from disk:

```bash
# Create a script with write/read tools, then:
{baseDir}/browser-eval.js --file /tmp/browser-script.js

# Or pipe via stdin (helpful for generated code):
{baseDir}/browser-eval.js --stdin < /tmp/browser-script.js
```

When you supply `--file/--stdin`, the script runs verbatim inside an async function—no implicit `return (...)` wrapper—so you can write normal statements and `return` explicitly if you need output.

### Terminal command helper

When a page exposes `window.webTerminal.send` (like our minimal web terminal client), you can run commands without wrestling with inline JavaScript:

```bash
cd {baseDir}/browser-tools
./scripts/browser-term-send.js "ls -la"
./scripts/browser-term-send.js --tail 40 --wait 800 "npm test"
```

The helper automatically appends `\r`, sends the string through `window.webTerminal.send`, waits a short delay, and prints the latest xterm output plus the connection status pill. Use `--no-tail` if you only need to fire-and-forget, or tweak `--tail` / `--wait` to capture longer-running commands.

## Screenshot

```bash
{baseDir}/browser-screenshot.js
```

Capture the current viewport and return a temporary file path. Use this to verify UI changes visually.

## Pick Elements

```bash
{baseDir}/browser-pick.js "Click the submit button"
```

**IMPORTANT**: Use this tool when the user wants to select specific DOM elements on the page. This launches an interactive picker that lets the user click elements to select them. The user can select multiple elements (Cmd/Ctrl+Click) and press Enter when done. The tool returns CSS selectors for the selected elements.

Common use cases:
- User says "I want to click that button" → Use this tool to let them select it
- User says "extract data from these items" → Use this tool to let them select the elements
- When you need specific selectors but the page structure is complex or ambiguous

## Cookies

```bash
{baseDir}/browser-cookies.js
```

Display all cookies for the current tab including domain, path, httpOnly, and secure flags. Use this to debug authentication issues or inspect session state.

## Extract Page Content

```bash
{baseDir}/browser-content.js https://example.com
```

Navigate to a URL and extract readable content as markdown. Uses Mozilla Readability for article extraction and Turndown for HTML-to-markdown conversion. Works on pages with JavaScript content (waits for page to load).

## When to Use

- Testing frontend code in a real browser
- Interacting with pages that require JavaScript
- When the user needs to visually see or interact with a page
- Debugging authentication or session issues
- Scraping dynamic content that requires JS execution

---

## Efficiency Guide

### DOM Inspection Over Screenshots

**Don't** take screenshots to see page state. **Do** parse the DOM directly:

```javascript
// Get page structure
document.body.innerHTML.slice(0, 5000)

// Find interactive elements
Array.from(document.querySelectorAll('button, input, [role="button"]')).map(e => ({
  id: e.id,
  text: e.textContent.trim(),
  class: e.className
}))
```

### Complex Scripts in Single Calls

Wrap everything in an IIFE to run multi-statement code (or place it in a file and call `browser-eval.js --file script.js`):

```javascript
(function() {
  // Multiple operations
  const data = document.querySelector('#target').textContent;
  const buttons = document.querySelectorAll('button');
  
  // Interactions
  buttons[0].click();
  
  // Return results
  return JSON.stringify({ data, buttonCount: buttons.length });
})()
```

### Batch Interactions

**Don't** make separate calls for each click. **Do** batch them:

```javascript
(function() {
  const actions = ["btn1", "btn2", "btn3"];
  actions.forEach(id => document.getElementById(id).click());
  return "Done";
})()
```

### Typing/Input Sequences

```javascript
(function() {
  const text = "HELLO";
  for (const char of text) {
    document.getElementById("key-" + char).click();
  }
  document.getElementById("submit").click();
  return "Submitted: " + text;
})()
```

### Reading App/Game State

Extract structured state in one call:

```javascript
(function() {
  const state = {
    score: document.querySelector('.score')?.textContent,
    status: document.querySelector('.status')?.className,
    items: Array.from(document.querySelectorAll('.item')).map(el => ({
      text: el.textContent,
      active: el.classList.contains('active')
    }))
  };
  return JSON.stringify(state, null, 2);
})()
```

### Waiting for Updates

If DOM updates after actions, add a small delay with bash:

```bash
sleep 0.5 && {baseDir}/browser-eval.js '...'
```

### Investigate Before Interacting

Always start by understanding the page structure:

```javascript
(function() {
  return {
    title: document.title,
    forms: document.forms.length,
    buttons: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input').length,
    mainContent: document.body.innerHTML.slice(0, 3000)
  };
})()
```

Then target specific elements based on what you find.

## Learned Lessons

Any agent who uses this skill and uncovers new workflows, edge cases, or best practices should document them here for future reference.

### 2026-02-12 – Persistent browser + multi-line eval quality-of-life
- `browser-start.js` auto-detects Chrome on macOS/Linux/Windows and accepts `--binary`/`BROWSER_TOOLS_CHROME`, so Linux hosts no longer need manual `google-chrome ...` launches.
- Start Chrome once per tmux session and reuse tabs to avoid renavigation when testing local apps.
- Use `browser-eval.js --file/--stdin` to run long scripts without battling shell quoting; inline code still works for quick expressions.
