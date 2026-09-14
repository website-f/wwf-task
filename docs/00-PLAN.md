# WWF Assignment — Master Plan

**Assignment:** Recreate the 2nd webpart ("Tiger Range Countries" scroll-map) from
https://wwftigers.shorthandstories.com/tiger-prey-why-theyre-crucial-to-ecosystems-across-asia/index.html
and present a CMS integration plan.

---

## 1. What the webpart actually is (key finding)

The original page is built with **Shorthand** (a scrollytelling SaaS). The second webpart is a
**"Scrollpoints" section**, NOT a hover-hotspot map:

- One full-screen **map image pinned (fixed) to the viewport** while the section scrolls.
  All country labels, tiger counts, the legend and the "TIGER RANGE COUNTRIES" title are
  **baked into the image** — they are not HTML.
- A sequence of **text cards** (intro → 6 prey species → outro) scrolls over the pinned map.
  Cards alternate left / right / center via a 12-column grid.
- When a card with a defined **highlight box** (x, y, width, height in % of the image) is active:
  - the whole map dims (black overlay, opacity 0.5),
  - a **spotlight window** shows the highlighted region at full brightness with a
    4px solid `#2a6788` border,
  - the spotlight **animates smoothly (0.8s transition)** from the previous box to the new one.
- Intro and outro cards have no highlight → map shows fully bright.
- On mobile (<900px) Shorthand swaps the whole section for a separate
  "Background Scrollmation" variant using portrait-cropped map images.

Full measured spec (coordinates, colors, fonts, spacing) → `01-WEBPART-ANALYSIS.md`.

## 2. Tech stack decision — Task 1

**Choice: one standalone `index.html` — vanilla HTML + CSS + JavaScript. Zero dependencies.**

Justification (say this in the interview):

| Option | Verdict |
|---|---|
| **Vanilla JS + IntersectionObserver** | ✅ Chosen. The whole effect is "toggle active card + move one absolutely-positioned div with a CSS transition". A library adds nothing but weight. Shows I understand the mechanics, not just an API. |
| GSAP ScrollTrigger | Great tool, but overkill: we don't need scrubbed timelines, just enter/leave triggers. ~80KB dependency for what CSS `transition: 0.8s` already does. |
| React/Vue | Wrong tool for a single static webpart; complicates CMS embedding (Task 2) where server-rendered HTML + a small JS enhancer is ideal. |
| scrollama.js | Acceptable thin wrapper, but it's just IntersectionObserver inside — doing it directly is ~30 lines. |

The assignment explicitly says *"keep dependencies reasonable and justify your choices"* —
zero dependencies with a clear explanation is the strongest possible answer.

**Techniques used:**
- `position: sticky` (with a fixed-position fallback pattern like Shorthand's attach
  before/during/after states) to pin the map.
- `IntersectionObserver` (rootMargin tuned so a card activates around mid-viewport) to set
  the active scrollpoint — no scroll-event thrashing, passive by design.
- Spotlight = dim layer (full-size, `background:#000; opacity:.5`) + highlight `<div>` whose
  `background-image` is the **same map**, `background-size` synced to the map's rendered size,
  `background-position` offset by the box's x/y — so the region inside the window appears
  undimmed. Moving/resizing the div with `transition: all .8s` reproduces the traveling
  spotlight exactly.
- Original assets reused (already downloaded into `research/assets/`): the real map JPG,
  the real `wwf.woff` heading font, the 6 prey photos. Open Sans from Google Fonts.
- Bonus (time-permitting): optional hover hotspots — invisible hit-areas over each country
  label that show a tooltip (satisfies the "hover effects" wording and demos the data-driven
  hotspot model used in Task 2).

## 3. CMS decision — Task 2

**Choice: WordPress with a custom Gutenberg block (built with `block.json` + React editor UI + PHP server render), packaged as a plugin.**

Why WordPress for the demo:
- Easiest credible demo: runs locally in Docker in minutes, interviewers all know it.
- Gutenberg gives us for free: page-editor insertion, live in-editor preview,
  draft/preview-before-publish, revisions, media library.
- A custom block demonstrates real engineering (data model, editor UX, validation,
  server rendering) instead of hiding behind a page-builder plugin.
- ACF Pro (flexible content/repeater) is the pragmatic alternative — mention it, but
  custom block avoids a paid dependency and shows more skill.

**Important terminology note:** "web part" is SharePoint vocabulary. If asked, the same
architecture ports 1:1 to an **SPFx web part** (property pane = our sidebar controls, web part
properties JSON = our block attributes). One slide covers this — it shows the data model is
CMS-agnostic. Same for Drupal (paragraph type) or headless (Strapi/Contentful component).

Full data model, editor UX, validation, rendering pipeline → `02-CMS-INTEGRATION-PLAN.md`.

## 4. Deliverables & folder layout

```
wwf-tiger-webpart/
├── README.md
├── docs/                    ← this planning pack
│   ├── 00-PLAN.md               master plan (this file)
│   ├── 01-WEBPART-ANALYSIS.md   reverse-engineered spec, all measurements
│   ├── 02-CMS-INTEGRATION-PLAN.md  Task 2 full plan
│   ├── 03-CODE-WALKTHROUGH-SCRIPT.md  interview demo script + Q&A prep
│   └── 04-ASSETS-CHECKLIST.md   asset inventory + licensing note
├── research/
│   ├── reference-page.html      downloaded original (725KB)
│   ├── scrollpoints-clean.html  extracted section markup
│   ├── scrollpoints-css.txt     extracted CSS rules
│   └── assets/                  original map, wwf.woff, prey photos
└── src/                     ← to be developed
    ├── standalone/index.html    Task 1 deliverable (single file, no build)
    └── wp-plugin/               Task 2 demo: wwf-scrollmap Gutenberg block
```

## 5. Build milestones

1. **M1 — Static skeleton** (~1h): section markup, pinned map, cards on the grid,
   typography (WWF font + Open Sans), card overlay styling. Desktop only.
2. **M2 — Scroll engine** (~1–2h): IntersectionObserver activation, dim layer,
   traveling spotlight with 0.8s ease, intro/outro undimmed states.
3. **M3 — Responsive** (~1h): breakpoints 620/900/1100px; <900px switch to portrait
   map + stacked cards (mirroring Shorthand's mobile variant); reduced-motion support.
4. **M4 — Polish** (~1h): lazyload images, hover states, focus/keyboard access,
   ARIA, cross-browser pass (Chrome/Firefox/Edge/Safari-sim).
5. **M5 — Bonus hover hotspots** (optional, ~1h): data-driven country pins + tooltips.
6. **M6 — WP plugin demo** (~3–4h): block.json, editor sidebar with hotspot
   repeater (add/edit/reorder/remove), visual box-drawing on the image, render.php
   emitting the exact same markup as the standalone file, shared CSS/JS.
7. **M7 — Rehearse** with `03-CODE-WALKTHROUGH-SCRIPT.md`.

## 6. Fidelity checklist (verify against original before demo)

- [ ] Map pins at full viewport, no letterboxing at 16:9 (image is 4096×1957-class, ~2.09:1 — check `object-fit`/width behavior vs original: original uses `width:100%; min-height:100vh`)
- [ ] First card appears after ~85vh of scroll (original: `padding-top:85vh` on first point)
- [ ] Card rhythm: 50vh top / 30vh bottom padding per point; 20vh section bottom
- [ ] Spotlight border 4px `#2a6788`, travel transition 0.8s
- [ ] Dim = black at 50% only when a highlight is active
- [ ] Cards: white overlay at 0.85 opacity, border-radius .5em, text #000, links #1155cc underlined
- [ ] Headings: WWF font, uppercase, 220%→250%, line-height 1.1
- [ ] Body: Open Sans 17px → 18/20/22px at wider breakpoints
- [ ] Grid: card = 6/12 cols; left cards offset 0, right cards offset 6, center offset 3; ≤sm: 10–12 cols
- [ ] Image captions in small caption style with © credits
- [ ] `prefers-reduced-motion: reduce` → no traveling animation, instant states

## 7. Risks / open questions

- **Sticky vs fixed on iOS Safari** — test; sticky with a tall wrapper is the safe default.
- **Map aspect vs viewport**: at very tall/narrow windows the 2.09:1 map can't cover
  100vh at width 100% — original lets it scale by width and vertically... verify actual
  behavior in DevTools during dev (M1) and match it.
- **Spotlight background-position math** must recompute on resize — cheap, do it on
  `resize` + `ResizeObserver` on the media wrapper.
- Assignment says *partial submission accepted* — desktop-perfect + sensible mobile
  beats everything-half-done. Prioritize M1–M4.
