# Browser CLI Controls Documentation

This directory contains site-specific automation guides for the browser skill.
Agents should check these controls before exploratory interaction on a site.

## Structure

```
controls/
├── README.md                    # This file - general patterns
├── duckduckgo.com/
│   └── controls.md              # DuckDuckGo-specific patterns
├── pokemonshowdown.com/
│   └── controls.md              # Pokemon Showdown patterns
└── <domain>/
    └── controls.md              # New site documentation
```

## When to Write Documentation

Write a `controls.md` file whenever you:
- Discover a reliable workflow for a new site
- Find a useful command pattern
- Solve a tricky interaction problem
- Need to document work for future agents

**Why this matters:** Future agents won't need to rediscover the same patterns, saving time and reducing duplication.

## File Naming

Use the domain name directory with a `controls.md` file:
`controls/<domain>/controls.md`

**Examples:**
- `controls/duckduckgo.com/controls.md`
- `controls/github.com/controls.md`
- `controls/npmjs.com/controls.md`

## Documentation Content

Each file should cover:

1. **Quick start** - Basic navigation examples
2. **Key selectors** - Important HTML elements
3. **Common patterns** - Search, click, form interactions
4. **Known issues** - Edge cases and workarounds

## Maintenance

**Update documentation when:**

- Selectors change (sites update frequently)
- New reliable patterns are discovered
- Workarounds for issues are found
- Documentation becomes outdated or incorrect

**Why this matters:** Sites change often. Keeping documentation current ensures future agents can work reliably without rediscovering patterns or fighting outdated selectors.
