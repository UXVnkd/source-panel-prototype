# Source Panel — concept prototype

**Unofficial concept for Claude — not an Anthropic product.** All sources, publishers and quotes are fictional.

A clickable prototype of an AI answer with cited claims. Tapping a citation opens a side panel with the source passage; the claim and its source line share a highlight color, and words that changed meaning are flagged.

**Core idea:** bring the source to the claim.

## Run
Open `index.html` in a browser. No build step, no server.

## Demo mode (for recording)
- `index.html?demo` — press Space to play the scripted walkthrough, R to replay
- `index.html?demo=auto` — starts on its own
- Best recorded at 1920×1080 with browser zoom 150%

## Files
| File | What it holds |
|---|---|
| `index.html` | Page structure |
| `style.css` | Layout, colors, motion (all values as CSS variables) |
| `script.js` | Interactions |
| `data.js` | Answer, claims, sources, demo captions (single source of truth) |
| `icons.js` | Lucide icons, inlined (ISC, see `LICENSE-lucide.txt`) |
| `demo.js` | Autoplay walkthrough, only runs with `?demo` |
