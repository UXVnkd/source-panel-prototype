# Source Panel — concept prototype

**Unofficial concept for Claude — not an Anthropic product.**

A clickable prototype of an AI answer with cited claims. Each sentence's citations collapse into one pill. Tapping a pill opens a popover with the exact line from the source, a verdict ("Likely matches" or "Possible change", compared by AI), and "Expand" for the full passage in a side panel (a bottom sheet on phones).

**Core idea:** bring the source to the claim.

The example answer was written for the demo. Its three sources (Pew Research Center, an arXiv paper, BBC Media Centre) are real and quoted word for word; some claims drift from them on purpose.

## Run
Open `index.html` in a browser. No build step, no server.

## Live mode (inside a Claude artifact only)
When the page runs as a Claude artifact and the viewer is signed in, the composer becomes live:
1. If the viewer has the Firecrawl connector, the page searches the web and reads the top 2 pages (repeat questions reuse results for a day; when the free credits run out it falls back for the day).
2. Claude writes an answer from those pages, or from the three built-in sources.
3. A separate Claude call checks each claim against its source, and the page confirms each quoted line really is in the source.
4. Web sources get a trust badge only by rule (official, government, academic site) or by an AI rating that says so.

Anywhere else (a local file, Vercel) the page shows the scripted example.

## Demo mode (for recording)
- `index.html?demo` (or `#demo`): press Space to play the walkthrough, R to replay
- `index.html?demo=auto` (or `#demo-auto`): starts on its own

## Files
| File | What it holds |
|---|---|
| `index.html` | Page structure |
| `style.css` | Layout, colors, motion (all values as CSS variables) |
| `script.js` | Interactions: pills, popover, panel, sheet |
| `data.js` | Answer, claims, sources, demo captions (single source of truth) |
| `live.js` | Live mode (Claude artifact only) |
| `icons.js` | Lucide icons, inlined (ISC, see `LICENSE-lucide.txt`) |
| `demo.js` | Autoplay walkthrough, only runs with `?demo` |
| `video.js`, `render.js` | 4K60 video timeline and frame renderer (Node + Playwright + ffmpeg) |
| `loops/`, `loops-render.js` | Seamless interaction loops for the case study |
| `shots-*.js`, `shots-*.py` | Case-study screenshots composed on a gradient |
| `today/` | Illustrative "checking today" screens for the case study |

Site logos (Pew, arXiv, BBC) belong to their owners and are shown only to identify each source.
