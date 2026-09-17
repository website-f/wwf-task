# WWF Interview Assignment — "Tiger Range Countries" Scroll-Map Webpart

Recreation of the 2nd webpart from
[WWF's tiger-prey Shorthand story](https://wwftigers.shorthandstories.com/tiger-prey-why-theyre-crucial-to-ecosystems-across-asia/index.html)
(Task 1) + CMS integration plan (Task 2).

## Status

- [x] Reference page reverse-engineered (Shorthand "Scrollpoints" section)
- [x] Original assets captured (map, WWF font, 6 prey photos, mobile crops)
- [x] Planning pack complete (`docs/`)
- [x] Task 1 build — standalone [src/standalone/index.html](src/standalone/index.html)
      (verified by capturing the original and the rebuild in headless Chromium at the same
      viewports and scroll states — `research/shots/desktop-*` are the original,
      `research/shots/verify-*` are the rebuild)
- [x] Task 2 demo — WordPress Gutenberg block [src/wp-plugin/](src/wp-plugin/)
      (`docker compose up -d` → localhost:8280)
- [ ] Rehearsal

## Quick start

- **Task 1**: open `src/standalone/index.html` in a browser. Three files, one vendored
  dependency (GSAP + ScrollTrigger), no build step. Scroll: the map pins, the camera flies
  and **zooms into each highlighted region**, a paw-print trail walks between them, and the
  card always lands in the *opposite* half of the screen so it never covers the region.
- **Task 2**: `cd src/wp-plugin && docker compose up -d`, then the three WP-CLI commands in
  [src/wp-plugin/README.md](src/wp-plugin/README.md#12-install--seed-one-block-run-once) →
  **http://localhost:8280 is the live webpart**. Edit it at
  http://localhost:8280/wp-admin (**admin / admin**) → Pages → "Tiger Range Countries".
  Editors draw the regions on the map, drag them to move, drag corners to resize.

## Layout

```
src/core/        THE WEBPART. No CMS in it. Schema + styles + engine + JSON renderer.
src/adapters/    one folder per CMS — each just maps that CMS onto the schema
  headless/        runnable: an HTML page + content.json, no server template at all
  drupal-twig/     Twig template + Paragraph field mapping
  sharepoint-spfx/ web part class + property pane
src/wp-plugin/   the fully-built adapter: a Gutenberg block with a visual hotspot editor
src/standalone/  Task 1 demo — hand-written markup against the same core
tools/           sync-core.js (core → adapters) · check-parity.js (do they all agree?)
```

Proof rather than assertion:

```
$ node tools/check-parity.js
steps rendered   WordPress 8 · headless 8 · Node 8
MATCH   WordPress vs headless
MATCH   headless vs Node
All three renderers agree. The content contract holds across CMSs.
```

## New to this code? Start here

Two from-scratch explainers that assume nothing — every class, every style, every animation,
and how a folder becomes a WordPress plugin:

- **[docs/10-TASK1-EXPLAINED.md](docs/10-TASK1-EXPLAINED.md)** — the webpart: the film-crew
  mental model, every class and its CSS, GSAP in ten minutes, what happens on one scroll,
  the zoom maths
- **[docs/11-TASK2-EXPLAINED.md](docs/11-TASK2-EXPLAINED.md)** — the plugin: what a plugin
  *is*, what a block *is*, where the data is stored, `block.json` / `render.php` / `editor.js`
  field by field, and the journey of one hotspot from mouse-drag to screen

## Read in this order

1. [docs/00-PLAN.md](docs/00-PLAN.md) — master plan, stack + CMS decisions, milestones
2. [docs/01-WEBPART-ANALYSIS.md](docs/01-WEBPART-ANALYSIS.md) — measured spec: mechanics, coordinates, fonts, colors, spacing
3. [docs/02-CMS-INTEGRATION-PLAN.md](docs/02-CMS-INTEGRATION-PLAN.md) — Task 2: data model, editor UX, rendering, validation
4. [docs/03-CODE-WALKTHROUGH-SCRIPT.md](docs/03-CODE-WALKTHROUGH-SCRIPT.md) — interview-day script + Q&A prep
5. **[docs/05-CODE-EXPLANATION.md](docs/05-CODE-EXPLANATION.md) — ⭐ the presentation master doc: every method explained, self code-review, demo runbook**
6. **[docs/06-FILE-BY-FILE-REFERENCE.md](docs/06-FILE-BY-FILE-REFERENCE.md) — every file and every function in one table, plus the known-deviations list**
7. **[docs/07-EDITOR-GUIDE.md](docs/07-EDITOR-GUIDE.md) — the non-technical editor's manual: add the block, draw regions, edit everything, publish**
8. **[docs/08-ADD-TO-A-PAGE.md](docs/08-ADD-TO-A-PAGE.md) — click-by-click: new page → map on the page → published**
9. **[docs/09-INSTALLING.md](docs/09-INSTALLING.md) — how the plugin gets onto an empty WordPress, and what "install" means in Drupal / SharePoint / headless**
10. **[src/core/README.md](src/core/README.md) — how to put this webpart in *any* CMS** · [src/adapters/README.md](src/adapters/README.md) — what an adapter actually costs
8. [docs/04-ASSETS-CHECKLIST.md](docs/04-ASSETS-CHECKLIST.md) — asset inventory + licensing note

## One-paragraph summary of the approach

The webpart is a scroll-driven map: a full-viewport map pins while story cards scroll over
it, and each card's region is highlighted on the map. Task 1 rebuilds it and takes it
further — the camera **flies and zooms** into each region as you scroll, a paw-print trail
walks between regions, pins drop, headings reveal line by line, and the card is always laid
out in the half of the screen the region is *not* in, so it can never cover what you're
reading about. GSAP ScrollTrigger owns the motion; the original's own hotspot coordinates
and left-anchored map framing are kept. Task 2 turns every one of those values into block
attributes behind a WordPress block whose editor lets a non-technical person draw the
regions directly on the map — with the front end rendered server-side from the same markup,
sharing the stylesheet and engine byte-for-byte with Task 1.
Task 2 turns the hard-coded points/hotspots into a JSON data model behind a custom
WordPress Gutenberg block — editors add the block, draw hotspot rectangles directly on the
image, reorder points by drag, and use WP's native draft preview — with the same
front-end engine rendered server-side by the block, and the schema portable to
SharePoint SPFx / Drupal / headless if asked.
