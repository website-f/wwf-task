# WWF Interview Assignment — "Tiger Range Countries" Scroll-Map Webpart

Recreation of the 2nd webpart from
[WWF's tiger-prey Shorthand story](https://wwftigers.shorthandstories.com/tiger-prey-why-theyre-crucial-to-ecosystems-across-asia/index.html)
(Task 1) + CMS integration plan (Task 2).

## Status

- [x] Reference page reverse-engineered (Shorthand "Scrollpoints" section)
- [x] Original assets captured (map, WWF font, 6 prey photos, mobile crops)
- [x] Planning pack complete (`docs/`)
- [x] Task 1 build — standalone [src/standalone/index.html](src/standalone/index.html)
      (verified with headless-browser screenshots at 5 scroll states, desktop + mobile — see `research/shots/`)
- [x] Task 2 demo — WordPress Gutenberg block [src/wp-plugin/](src/wp-plugin/)
      (`docker compose up -d` → localhost:8280)
- [ ] Rehearsal

## Quick start

- **Task 1**: open `src/standalone/index.html` in a browser. One file, zero dependencies.
  Default is **cinematic mode** (spring camera + push-in zoom + glow pulse + progress
  rail); append `?mode=faithful` for the original's exact CSS behaviour.
- **Task 2**: `cd src/wp-plugin && docker compose up -d` → **http://localhost:8280 is the
  live webpart** (fully seeded: images in media library, page published as front page).
  Edit live: http://localhost:8280/wp-admin (admin / admin) → Pages → "Tiger Range
  Countries" ([full steps](src/wp-plugin/README.md)).

## Read in this order

1. [docs/00-PLAN.md](docs/00-PLAN.md) — master plan, stack + CMS decisions, milestones
2. [docs/01-WEBPART-ANALYSIS.md](docs/01-WEBPART-ANALYSIS.md) — measured spec: mechanics, coordinates, fonts, colors, spacing
3. [docs/02-CMS-INTEGRATION-PLAN.md](docs/02-CMS-INTEGRATION-PLAN.md) — Task 2: data model, editor UX, rendering, validation
4. [docs/03-CODE-WALKTHROUGH-SCRIPT.md](docs/03-CODE-WALKTHROUGH-SCRIPT.md) — interview-day script + Q&A prep
5. **[docs/05-CODE-EXPLANATION.md](docs/05-CODE-EXPLANATION.md) — ⭐ the presentation master doc: every method explained, self code-review, demo runbook**
6. [docs/04-ASSETS-CHECKLIST.md](docs/04-ASSETS-CHECKLIST.md) — asset inventory + licensing note

## One-paragraph summary of the approach

The webpart is a scroll-driven spotlight map: a full-viewport map image (labels baked into
the artwork) pins while intro/species/outro cards scroll over it; active cards with a
hotspot dim the map and frame their region with a traveling 0.8s-eased highlight window.
Task 1 rebuilds this in a single dependency-free HTML file (sticky positioning +
IntersectionObserver + CSS transitions), reusing the original assets for pixel fidelity.
Task 2 turns the hard-coded points/hotspots into a JSON data model behind a custom
WordPress Gutenberg block — editors add the block, draw hotspot rectangles directly on the
image, reorder points by drag, and use WP's native draft preview — with the same
front-end engine rendered server-side by the block, and the schema portable to
SharePoint SPFx / Drupal / headless if asked.
