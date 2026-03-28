# mitmweb.localhost Controls

**Base URL:** `http://127.0.0.1:8081`

This file documents **safe, high‑value patterns** for agents using the `browser` CLI to inspect and reason about traffic in mitmweb. It focuses on:

- Filtering flows
- Selecting flows
- Inspecting request/response/connection/timing
- Replay (with guardrails)
- Exporting flows
- Clearing history (with human confirmation)

**Important:** Interception (`~d`, `~http`, `~all`) is powerful but currently **unsafe for agents to toggle** in this environment. See “Interception Caveats” at the end.

---

## 1. Getting to mitmweb

Open mitmweb in a known tab:

```bash
browser go "http://127.0.0.1:8081/#/flows" --port 9222 --timeout 10000
# Note the returned tabId and reuse it
```

Get existing tabs:

```bash
browser tabs --port 9222
```

---

## 2. Filtering the flows list

### 2.1 URL `?s=` search filter (recommended)

mitmweb’s flows view accepts a query parameter `s` that acts as a search filter. You can navigate directly to a filtered view:

```bash
# Filter to a domain
browser go "http://127.0.0.1:8081/#/flows?s=youtube.com" --tab <mitm-tab-id> --port 9222 --timeout 10000

# Filter to an API path fragment
browser go "http://127.0.0.1:8081/#/flows?s=/api/" --tab <mitm-tab-id> --port 9222 --timeout 10000

# Filter to a specific host / pattern
browser go "http://127.0.0.1:8081/#/flows?s=doubleclick.net" --tab <mitm-tab-id> --port 9222 --timeout 10000
```

This is more reliable than trying to type into the “Search” box via JS. It also avoids fighting controlled inputs.

### 2.2 Reading the current flows (no scroll needed)

Instead of scrolling the UI, inspect the table rows directly:

```bash
browser eval "(async () => {
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  return {
    rowCount: rows.length,
    sample: rows.slice(0, 5).map(r => r.textContent.trim())
  };
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

To look at the **last N** flows:

```bash
browser eval "(async () => {
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  return {
    rowCount: rows.length,
    last5: rows.slice(-5).map(r => r.textContent.trim())
  };
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

---

## 3. Selecting a flow

### 3.1 First flow matching a substring

Select the first flow whose row text contains a substring (URL fragment, host, path, etc.):

```bash
browser eval "(async () => {
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  const row = rows.find(r => r.textContent.includes('YOUR-SUBSTRING'));
  if (!row) return 'not-found';
  row.click();
  return 'clicked';
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

Examples:

```bash
# First flow hitting /api/
browser eval "(async () => {
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  const row = rows.find(r => r.textContent.includes('/api/'));
  if (!row) return 'not-found';
  row.click();
  return 'clicked';
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

Once clicked, mitmweb navigates to a detail view:

```text
#/flows/<flow-id>/request?s=...
```

---

## 4. Navigating tabs within a flow

From a selected flow’s detail view, use link text to switch between tabs.

### 4.1 Request tab

```bash
browser eval "(async () => {
  const link = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent.trim() === 'Request');
  if (link) link.click();
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

### 4.2 Response tab

```bash
browser eval "(async () => {
  const link = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent.trim() === 'Response');
  if (link) link.click();
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

### 4.3 Connection & Timing tabs

```bash
# Connection
browser eval "(async () => {
  const link = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent.trim() === 'Connection');
  if (link) link.click();
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000

# Timing
browser eval "(async () => {
  const link = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent.trim() === 'Timing');
  if (link) link.click();
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

---

## 5. Inspecting requests & responses

### 5.1 Quick request summary (URL, method, status, size, time)

From the Timing tab, you can pull a compact summary:

```bash
browser eval "(async () => {
  const link = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent.trim() === 'Timing');
  if (link) link.click();

  const cells = Array.from(document.querySelectorAll('td'))
    .map(td => td.textContent.trim())
    .filter(Boolean);

  // cells come back as grouped rows: [url, method, status, size, time, ...]
  return {
    href: window.location.href,
    cells: cells.slice(0, 20)
  };
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

Agents can then interpret `cells` as:

- `[url, method, status, size, time, url2, method2, ...]` depending on the UI version.

### 5.2 Response status & body snippet

```bash
browser eval "(async () => {
  const respTab = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent.trim() === 'Response');
  if (respTab) respTab.click();

  const bodyEl = document.querySelector('pre, textarea');
  const text = bodyEl ? bodyEl.textContent : null;

  return {
    href: window.location.href,
    hasBody: !!text,
    bodySnippet: text ? text.slice(0, 500) : null
  };
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

Notes:

- Many telemetry endpoints (e.g. `stats/qoe`, `stats/watchtime`) are `204 No Content` and will have no response body.
- For JSON APIs and HTML endpoints, this snippet is often enough to see the structure.

---

## 6. Replay (medium value, with guardrails)

mitmweb supports replaying a selected flow to the server. This is powerful but can cause side-effects.

### 6.1 Basic replay

```bash
browser eval "(async () => {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('Replay'));
  if (!btn) return 'no-replay';
  btn.click();
  return 'clicked-replay';
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

**Agent guidance:**

- Use replay only after the user confirms it’s safe (idempotent GET, known test API, etc.).
- For modifying payloads:
  - Ask the user to:
    - Switch to the **Request** tab,
    - Edit the body in the UI (JSON / form data),
    - Then you can trigger `Replay` as above.

---

## 7. Exporting flows (curl/HTTPie/raw)

Under the **Export▾**/context menu (UI may vary slightly), mitmweb provides:

- `Copy raw request`
- `Copy raw response`
- `Copy raw request and response`
- `Copy as cURL`
- `Copy as HTTPie`

Agents should usually treat these as human-driven:

1. Ensure a flow is selected.
2. Open Export:

   ```bash
   browser eval "(async () => {
     const btn = Array.from(document.querySelectorAll('button'))
       .find(b => b.textContent.trim().startsWith('Export'));
     if (btn) btn.click();
   })()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
   ```

3. Instruct the user:

   - "Click `Copy as cURL` (or `Copy as HTTPie`) and paste the result into your terminal."

Trying to fully automate clipboard operations is brittle and unnecessary; the UI already does the right thing for humans.

---

## 8. Marking flows (visual labels)

The **Mark▾** menu offers:

- Actions: `Replay`, `Duplicate`, `Revert`, `Delete`, `Resume`, `Abort`, `Edit`.
- Visual markers: `⚪ (no marker)`, `🔴 red circle`, `🟠 orange circle`, `🟡 yellow circle`, `🟢 green circle`, `🔵 large blue circle`, `🟣 purple circle`, `🟤 brown circle`.

Agents can open the menu:

```bash
browser eval "(async () => {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim().startsWith('Mark'));
  if (btn) btn.click();
})()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
```

**Recommendation:** Treat color markers as human-facing organization tools. Agents don’t need to manipulate them directly; just know they exist so you can refer to them ("mark these flows red, then...").

---

## 9. Clearing flows (human confirmation required)

Clearing flows is a two-step, destructive operation:

1. Open **File** menu:

   ```bash
   browser eval "(async () => {
     const fileBtn = Array.from(document.querySelectorAll('button,a'))
       .find(el => el.textContent.trim() === 'File');
     if (fileBtn) fileBtn.click();
   })()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
   ```

2. **Human step:** In mitmweb, click `Clear All`. A confirmation dialog appears; the user must confirm to actually clear flows.

3. Optionally verify from the agent:

   ```bash
   browser eval "(async () => {
     const table = document.querySelector('table');
     const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];
     return {rowCount: rows.length};
   })()" --tab <mitm-tab-id> --port 9222 --json --timeout 10000
   ```

**Do not** auto-confirm destructive dialogs from agents.

---

## 10. Interception caveats (for now: human-only)

mitmweb supports intercept patterns (e.g. `~d example.com`, `~http`, `~all`), but in this environment we’ve observed:

- When interception is enabled and there are **paused flows**, Chrome DevTools sessions (used by the `browser` CLI) often fail with:

  ```text
  Session creation timeout after 10000ms
  ```

- This affects:
  - `browser eval`
  - `browser screenshot`
  - Sometimes other DevTools-dependent operations

Behavior we’ve seen:

- Enabling intercept for domains (e.g. `~d bing.com`, `~d news.ycombinator.com`) or `~http` and then driving traffic leads to:
  - Browser navigation timeouts (expected, flows are paused).
  - DevTools timeouts when trying to interact with mitmweb or other tabs.
- Disabling interception and/or releasing/clearing flows restores normal behavior.

**Guidance for agents:**

- **Do not set intercept patterns programmatically.**
- Treat interception as a **human-only tool**:
  - The user configures intercepts and steps through flows directly in mitmweb.
  - You, as an agent, work in **read-only** mode while intercept is active.
- If you see repeated `Session creation timeout` errors while mitmweb is in use:
  - Ask the user whether interception is enabled and flows are paused.
  - Suggest disabling intercept or releasing flows, then retry automation.

Once the DevTools stability issue is better understood or mitigated, this section can be revisited.

---

## 11. Summary: Agent-safe mitmweb patterns

Safe and recommended for agents:

- Use `#/flows?s=...` to filter flows by domain/path.
- Select flows by row text and open detail views.
- Inspect:
  - Request/Response bodies,
  - Connection info,
  - Timing breakdowns.
- Suggest Replay for safe cases (with user confirmation).
- Guide users to Export (curl/HTTPie/raw) and File → Clear All, but let them drive destructive or clipboard actions.
- Avoid setting intercepts; consider mitmweb primarily as a **read-only observability tool** when used via the `browser` CLI.

Use this as a base; add site- or app-specific recipes in separate domain controls files where appropriate.
