# DuckDuckGo Search Guide

**Site**: https://duckduckgo.com  
**Last Updated**: 2026-03-20  
**Status**: Tested and working

## Overview

DuckDuckGo is a privacy-focused search engine. This guide documents the automation patterns for searching and navigating results.

## Quick Start

```bash
# Navigate to DuckDuckGo
browser go https://duckduckgo.com --tab <TAB_ID>

# Search for a query (URL params - fastest)
browser go https://duckduckgo.com/?q=your+search+query --tab <TAB_ID>

# Or navigate first, then search
browser go https://duckduckgo.com --tab <TAB_ID>
browser type searchbox_input "your search query" --tab <TAB_ID>
browser click button[type=submit] --tab <TAB_ID>
```

## Key Selectors

| Element | Selector | Notes |
|---------|----------|-------|
| Search input | `#searchbox_input` or `.search-input_searchInput__2ptwh` | Main search field |
| Search button | `button[type=submit]` | Submit search form |
| Reset button | `button[aria-label*="search"]` | Clear search |

## Search Methods

### Method 1: URL Parameters (Recommended)

```bash
browser go https://duckduckgo.com/?q=your+search+query --tab <TAB_ID>
```

**Pros:** Fast, reliable, no form interaction needed  
**Cons:** None

### Method 2: Type and Submit

```bash
browser go https://duckduckgo.com --tab <TAB_ID>
browser type searchbox_input "your search query" --tab <TAB_ID>
browser click button[type=submit] --tab <TAB_ID>
```

**Pros:** Works for any search engine with standard forms  
**Cons:** May timeout if element not focused

### Method 3: JavaScript Evaluation (Fallback)

```bash
browser eval "(async () => {
  const input = document.getElementById('searchbox_input');
  input.value = 'your search query';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('button[type=submit]')?.click();
})" --tab <TAB_ID>
```

**Use when:** Methods 1-2 fail

## Clicking Results

```bash
# Find and click specific result
browser eval "(async () => {
  const link = document.querySelector('a[href*=\"hackernews.com\"]');
  if (link) link.click();
})" --tab <TAB_ID>

# Navigate directly to result URL
browser go https://thehackernews.com/2026/03/speagle-malware-hijacks-cobra-docguard.html --tab <TAB_ID>
```

## Taking Screenshots

```bash
# Standard screenshot
browser screenshot screenshot.png --tab <TAB_ID>

# Full page screenshot
browser screenshot screenshot.png --full-page --tab <TAB_ID>
```

## JavaScript Reference

### Get Current Search Query

```bash
browser eval "(async () => {
  const url = new URL(window.location.href);
  return url.searchParams.get('q');
})" --tab <TAB_ID> --json
```

### Get Search Results

```bash
browser eval "(async () => {
  return Array.from(document.querySelectorAll('a')).slice(0, 10).map(link => ({
    text: link.textContent?.substring(0, 50),
    href: link.href
  }));
})" --tab <TAB_ID> --json
```

### Find Result by Domain

```bash
browser eval "(async () => {
  const link = document.querySelector('a[href*=\"target-domain.com\"]');
  return link ? { text: link.textContent, href: link.href } : null;
})" --tab <TAB_ID> --json
```

## Common Issues & Solutions

### Issue: Search doesn't submit

**Solution:** Use `button[type=submit].click()` instead of keyboard events.

### Issue: "Type operation timeout"

**Solution:** 
- Use URL parameters (Method 1)
- Reduce timeout: `--timeout 5000`
- Ensure element is visible first

### Issue: "Execution context was destroyed"

**Solution:** Navigation happened during JavaScript execution. Use `browser go` directly instead of JS eval for form submission.

## Tips

1. **URL params are fastest** - Use Method 1 for most searches
2. **Reuse tabs** - Keep the same tab ID for related searches
3. **Screenshot after navigation** - Verify page loaded correctly
4. **Use `--json` flag** - For programmatic result parsing

## Example Workflow

```bash
# 1. Navigate to DuckDuckGo
browser go https://duckduckgo.com --tab abc123

# 2. Search for "hacker news"
browser go https://duckduckgo.com/?q=hacker+news --tab abc123

# 3. Click first result
browser eval "(async () => {
  const link = document.querySelector('a[href*=\"hackernews.com\"]');
  if (link) link.click();
})" --tab abc123

# 4. Take screenshot
browser screenshot hackernews.png --tab abc123
```
