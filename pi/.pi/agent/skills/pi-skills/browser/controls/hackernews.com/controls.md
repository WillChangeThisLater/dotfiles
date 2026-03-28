# Hacker News Guide

**Site**: https://news.ycombinator.com  
**Last Updated**: 2026-03-21  
**Status**: Tested and working

## Overview

Hacker News (news.ycombinator.com) is a technology news aggregator and discussion site. This guide documents the automation patterns for navigating and interacting with posts, comments, and various sections.

## Site Sitemap

Hacker News has several main sections:

| URL | Title | Description |
|-----|-------|-------------|
| `/` | Hacker News | Main feed (sorted by score) |
| `/newest` | New Links | Posts sorted by time (newest first) |
| `/ask` | Ask | Questions submitted by users |
| `/show` | Show | "Show HN" posts about projects |
| `/newcomments` | New Comments | Recent comments across all sections |
| `/search?q=TERM` | Search | Search results for TERM |
| `/item?id=NUMBER` | Item | Single post view |
| `/user?id=USERNAME` | User | User profile page |

## Quick Start

```bash
# Navigate to Hacker News
browser go https://news.ycombinator.com --tab <TAB_ID>

# Get top post directly (recommended)
browser eval "(async () => {
  const top = document.querySelectorAll('tr.athing')[1];
  return top ? {
    rank: top.querySelector('.rank')?.innerHTML,
    title: top.querySelector('.titleline')?.innerHTML,
    score: top.nextElementSibling?.querySelector('.score')?.innerHTML,
    submitter: top.nextElementSibling?.querySelector('.hnuser')?.innerHTML,
    age: top.nextElementSibling?.querySelector('.age')?.innerHTML,
    comments: top.nextElementSibling?.querySelector('.subline')?.innerHTML
  } : null;
})" --tab <TAB_ID> --json
```

## Key Selectors

| Element | Selector | Notes |
|---------|----------|-------|
| Post (main feed) | `tr.athing` | Each post row |
| Post title | `.titleline` | Link to post |
| Rank | `.rank` | Post number (1., 2., etc.) |
| Score | `.score` | Upvote count (in next sibling row) |
| Submitter | `.hnuser` | User who submitted |
| Age | `.age` | Time since submission |
| Full subtext | `.subline` | Contains score, submitter, age, comments |

### Important: Two-Row Structure

**Main feed posts have TWO rows:**
1. **First row** (`tr.athing`): Rank + title
2. **Second row** (next sibling): Score, submitter, age, comments

```javascript
// Accessing a post's data
const postRow = document.querySelectorAll('tr.athing')[index];
const scoreRow = postRow.nextElementSibling;

const title = postRow.querySelector('.titleline')?.innerHTML;
const score = scoreRow?.querySelector('.score')?.innerHTML;
const submitter = scoreRow?.querySelector('.hnuser')?.innerHTML;
```

## Navigation Methods

### Method 1: Direct URL Navigation (Recommended)

```bash
# Main feed
browser go https://news.ycombinator.com --tab <TAB_ID>

# Newest posts
browser go https://news.ycombinator.com/newest --tab <TAB_ID>

# Ask section
browser go https://news.ycombinator.com/ask --tab <TAB_ID>

# Show HN section
browser go https://news.ycombinator.com/show --tab <TAB_ID>

# New comments
browser go https://news.ycombinator.com/newcomments --tab <TAB_ID>

# Single post
browser go https://news.ycombinator.com/item?id=47460525 --tab <TAB_ID>
```

**Pros:** Fast, reliable, no form interaction needed  
**Cons:** None

### Method 2: JavaScript Navigation (Fallback)

Use when you need to navigate to specific posts dynamically:

```bash
# Navigate to specific post by ID
browser eval "(async () => {
  const link = document.querySelector('.titleline a[href*=\"item?id=\"]');
  if (link) link.click();
})" --tab <TAB_ID>
```

## Reading Posts

### Get Top Post (Main Feed)

```bash
browser eval "(async () => {
  const top = document.querySelectorAll('tr.athing')[1];
  return top ? {
    rank: top.querySelector('.rank')?.innerHTML,
    title: top.querySelector('.titleline')?.innerHTML,
    score: top.nextElementSibling?.querySelector('.score')?.innerHTML,
    submitter: top.nextElementSibling?.querySelector('.hnuser')?.innerHTML,
    age: top.nextElementSibling?.querySelector('.age')?.innerHTML,
    comments: top.nextElementSibling?.querySelector('.subline')?.innerHTML
  } : null;
})" --tab <TAB_ID> --json
```

### Get Top 5 Posts

```bash
browser eval "(async () => {
  return Array.from(document.querySelectorAll('tr.athing'))
    .slice(1, 6)
    .map(row => {
      const next = row.nextElementSibling;
      return {
        rank: row.querySelector('.rank')?.innerHTML,
        title: row.querySelector('.titleline')?.innerHTML,
        score: next?.querySelector('.score')?.innerHTML,
        submitter: next?.querySelector('.hnuser')?.innerHTML,
        age: next?.querySelector('.age')?.innerHTML
      };
    });
})" --tab <TAB_ID> --json
```

### Get All Posts on Page

```bash
browser eval "(async () => {
  return Array.from(document.querySelectorAll('tr.athing')).map(row => {
    const next = row.nextElementSibling;
    return {
      rank: row.querySelector('.rank')?.innerHTML,
      title: row.querySelector('.titleline')?.innerHTML,
      score: next?.querySelector('.score')?.innerHTML,
      submitter: next?.querySelector('.hnuser')?.innerHTML,
      age: next?.querySelector('.age')?.innerHTML,
      comments: next?.querySelector('.subline')?.innerHTML
    };
  });
})" --tab <TAB_ID> --json
```

## Clicking Posts

### Click First Post

```bash
browser eval "(async () => {
  const link = document.querySelectorAll('tr.athing')[1]
    ?.querySelector('.titleline');
  if (link) link.click();
})" --tab <TAB_ID>
```

### Click Post by Domain

```bash
browser eval "(async () => {
  const link = document.querySelector('.titleline a[href*=\"opencode.ai\"]');
  if (link) link.click();
})" --tab <TAB_ID>
```

### Navigate Directly to Post (Recommended)

```bash
browser go https://news.ycombinator.com/item?id=47460525 --tab <TAB_ID>
```

## Pagination

### Page 2 Link

```bash
browser click "a.morelink" --tab <TAB_ID>
```

Or navigate directly:

```bash
browser go "https://news.ycombinator.com/?p=2" --tab <TAB_ID>
```

## Taking Screenshots

```bash
# Standard screenshot
browser screenshot hn_main.png --tab <TAB_ID>

# Full page screenshot
browser screenshot hn_full.png --full-page --tab <TAB_ID>
```

## JavaScript Reference

### Get Page Number

```bash
browser eval "(async () => {
  const url = new URL(window.location.href);
  return url.searchParams.get('p');
})" --tab <TAB_ID> --json
```

### Get Post Count on Page

```bash
browser eval "(async () => {
  return document.querySelectorAll('tr.athing').length;
})" --tab <TAB_ID> --json
```

### Find Post by Title

```bash
browser eval "(async () => {
  const posts = Array.from(document.querySelectorAll('tr.athing'))
    .map(row => ({
      title: row.querySelector('.titleline')?.innerHTML,
      href: row.querySelector('.titleline')?.href
    }));
  return posts.find(p => p.title.includes('target title'));
})" --tab <TAB_ID> --json
```

### Get Submission Info

```bash
browser eval "(async () => {
  const row = document.querySelectorAll('tr.athing')[0];
  const next = row.nextElementSibling;
  return {
    score: next?.querySelector('.score')?.innerHTML,
    submitter: next?.querySelector('.hnuser')?.innerHTML,
    age: next?.querySelector('.age')?.innerHTML,
    comments: next?.querySelector('.subline')?.innerHTML
  };
})" --tab <TAB_ID> --json
```

### Get Current Section

```bash
browser eval "(async () => {
  const url = new URL(window.location.href);
  return window.location.pathname;
})" --tab <TAB_ID> --json
```

### Get User Info

```bash
browser go https://news.ycombinator.com/user?id=rbanffy --tab <TAB_ID>
browser eval "(async () => {
  return {
    karma: document.querySelector('.karma')?.innerHTML,
    posts: document.querySelectorAll('tr.athing').length
  };
})" --tab <TAB_ID> --json
```

## Section-Specific Patterns

### Newest Posts

Same selectors as main feed:

```bash
browser go https://news.ycombinator.com/newest --tab <TAB_ID>
browser eval "(async () => {
  return Array.from(document.querySelectorAll('tr.athing')).slice(0, 5)
    .map(row => {
      const next = row.nextElementSibling;
      return {
        rank: row.querySelector('.rank')?.innerHTML,
        title: row.querySelector('.titleline')?.innerHTML,
        score: next?.querySelector('.score')?.innerHTML
      };
    });
})" --tab <TAB_ID> --json
```

### Ask Section

Similar structure, sorted by time:

```bash
browser go https://news.ycombinator.com/ask --tab <TAB_ID>
```

### Show HN Section

Similar structure, filtered for projects:

```bash
browser go https://news.ycombinator.com/show --tab <TAB_ID>
```

### New Comments

Different structure - flat list of recent comments:

```bash
browser go https://news.ycombinator.com/newcomments --tab <TAB_ID>
browser eval "(async () => {
  return Array.from(document.querySelectorAll('tr.athing')).slice(0, 10)
    .map(row => row.textContent?.substring(0, 100));
})" --tab <TAB_ID> --json
```

### Single Post View

```bash
browser go https://news.ycombinator.com/item?id=47460525 --tab <TAB_ID>
browser eval "(async () => {
  return {
    title: document.querySelector('.titleline')?.innerHTML,
    score: document.querySelector('.score')?.innerHTML,
    submitter: document.querySelector('.hnuser')?.innerHTML
  };
})" --tab <TAB_ID> --json
```

## Common Issues & Solutions

### Issue: Score is empty or undefined

**Cause:** Score is in the NEXT sibling row, not the same row as title  
**Solution:** Use `row.nextElementSibling?.querySelector('.score')`

```javascript
// WRONG
const score = row.querySelector('.score')?.innerHTML;

// CORRECT
const next = row.nextElementSibling;
const score = next?.querySelector('.score')?.innerHTML;
```

### Issue: Comments not found

**Cause:** Comments are in `.subline` text content, not a separate element  
**Solution:** Use `.subline` selector for full subtext

```javascript
const next = row.nextElementSibling;
const comments = next?.querySelector('.subline')?.innerHTML;
// or parse text content
const commentsText = next?.querySelector('.subline')?.textContent;
```

### Issue: "Type operation timeout"

**Solution:** 
- Use direct URL navigation instead of form submission
- Use `--timeout 10000` for slower connections
- Navigate to homepage first before querying

### Issue: Search returning "Unknown."

**Cause:** Direct URL search may not work reliably  
**Solution:** Use form submission or specific search URLs with proper parameters

```bash
# Instead of: https://news.ycombinator.com/search?q=term
# Try navigating to search page first, then submitting
```

### Issue: Pagination not loading

**Solution:** 
- Use direct URL navigation with `?p=2` for page 2
- Use `document.querySelectorAll('tr.athing').length` to check post count

## Tips

1. **Always specify `--tab`** - Reuse the same tab ID for related operations
2. **Use `--json` flag** - For programmatic parsing of post data
3. **Start with URL navigation** - Direct URL navigation is fastest and most reliable
4. **Use the two-row structure** - Remember that posts span two rows
5. **Screenshot after major navigation** - Verify page loaded correctly before proceeding
6. **Use `item?id=` for direct post access** - Bypass pagination entirely

## Example Workflows

### Workflow 1: Get Top 5 Posts from Main Feed

```bash
# 1. Navigate to Hacker News
browser go https://news.ycombinator.com --tab abc123

# 2. Get top 5 posts as JSON
browser eval "(async () => {
  return Array.from(document.querySelectorAll('tr.athing'))
    .slice(1, 6)
    .map(row => {
      const next = row.nextElementSibling;
      return {
        rank: row.querySelector('.rank')?.innerHTML,
        title: row.querySelector('.titleline')?.innerHTML,
        score: next?.querySelector('.score')?.innerHTML,
        submitter: next?.querySelector('.hnuser')?.innerHTML,
        age: next?.querySelector('.age')?.innerHTML
      };
    });
})" --tab abc123 --json
```

### Workflow 2: Click and Read Top Post

```bash
# 1. Navigate to Hacker News
browser go https://news.ycombinator.com --tab abc123

# 2. Click first post
browser eval "(async () => {
  const link = document.querySelectorAll('tr.athing')[1]
    ?.querySelector('.titleline');
  if (link) link.click();
})" --tab abc123

# 3. Take screenshot
browser screenshot top_post.png --tab abc123
```

### Workflow 3: Browse Different Sections

```bash
# Main feed
browser go https://news.ycombinator.com --tab abc123

# Newest posts
browser go https://news.ycombinator.com/newest --tab abc123

# Ask section
browser go https://news.ycombinator.com/ask --tab abc123

# Show HN
browser go https://news.ycombinator.com/show --tab abc123
```

### Workflow 4: Get Specific Post

```bash
# Navigate directly to post
browser go https://news.ycombinator.com/item?id=47460525 --tab abc123

# Take screenshot
browser screenshot specific_post.png --tab abc123
```

### Workflow 5: Extract Post Data

```bash
browser go https://news.ycombinator.com --tab abc123

# Get all post data
browser eval "(async () => {
  return Array.from(document.querySelectorAll('tr.athing')).map(row => {
    const next = row.nextElementSibling;
    return {
      rank: row.querySelector('.rank')?.innerHTML,
      title: row.querySelector('.titleline')?.innerHTML,
      score: next?.querySelector('.score')?.innerHTML,
      submitter: next?.querySelector('.hnuser')?.innerHTML,
      age: next?.querySelector('.age')?.innerHTML,
      comments: next?.querySelector('.subline')?.innerHTML
    };
  });
})" --tab abc123 --json
```

## Notes

- The site uses a simple table-based layout with class names like `athing`, `titleline`, `score`
- Posts are ordered by rank (1, 2, 3...) in the table rows
- Use `item?id=` URLs to access specific posts directly
- The `--json` flag is essential for programmatic data extraction
- **Critical**: Posts span TWO rows - the title is in row 1, and score/submitter/comments are in row 2 (the next sibling)
- New comments page has a different, flatter structure
- Search functionality may require form interaction instead of direct URL navigation
## Screenshot Verification

### Taking Screenshot After Navigation

```bash
# Standard screenshot
browser screenshot /tmp/verify_hn.png --tab <TAB_ID>

# Full page screenshot (for comments/discussion pages)
browser screenshot /tmp/verify_hn_full.png --full-page --tab <TAB_ID>
```

### Screenshot Verification Workflow

```bash
# 1. Navigate to Hacker News
browser go https://news.ycombinator.com --tab abc123

# 2. Verify navigation succeeded
browser eval "window.location.href" --tab abc123 --json

# 3. Take verification screenshot
browser screenshot /tmp/verify_hn_feed.png --tab abc123

# 4. Now safe to proceed with complex operations
browser eval "(async () => { /* complex operation */ })" --tab abc123 --json
```

### When to Take Screenshots

- **After major navigation** (new page, new section)
- **After clicking critical links** (comments, posts, user profiles)
- **Before complex JavaScript operations**
- **When debugging selector issues**
- **At the start of any new task**

### Screenshot Naming Convention

| Prefix | Purpose |
|--------|---------|
| `verify_` | Verification after navigation |
| `before_` | State before operation |
| `after_` | State after operation |
| `main_` | Main feed view |
| `item_` | Single post view |
| `comments_` | Comments page view |

### Example: Complete Verification

```bash
# Navigate and verify
browser go https://news.ycombinator.com --tab abc123
browser eval "window.location.href" --tab abc123 --json
browser screenshot /tmp/verify_main_feed.png --tab abc123

# Navigate to specific post
browser go https://news.ycombinator.com/item?id=47453942 --tab abc123
browser eval "window.location.href" --tab abc123 --json
browser screenshot /tmp/verify_item_view.png --tab abc123

# Navigate to comments
browser go https://news.ycombinator.com/newcomments --tab abc123
browser eval "document.querySelectorAll('tr.athing').length" --tab abc123 --json
browser screenshot /tmp/verify_comments.png --full-page --tab abc123
```
