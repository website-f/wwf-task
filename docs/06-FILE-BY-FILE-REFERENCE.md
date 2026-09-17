# File-by-File Reference — every file, every function, and what to say about it

The lookup table for interview day. If someone opens a file and asks "what does this do and
why is it here", the answer is on this page.

- Narrative / deep technical version: [`05-CODE-EXPLANATION.md`](05-CODE-EXPLANATION.md)
- Timed demo script: [`03-CODE-WALKTHROUGH-SCRIPT.md`](03-CODE-WALKTHROUGH-SCRIPT.md)
- Editor's manual (for content people): [`07-EDITOR-GUIDE.md`](07-EDITOR-GUIDE.md)

Line numbers are from the current build. Re-check with
`grep -n "function " src/standalone/scrollmap.js` after edits.

---

## Repository map

```
wwf-task/
├── README.md                       how to run both deliverables
├── docs/                           00 plan · 01 spec · 02 CMS plan · 03 script
│                                   · 04 assets · 05 explanation · 06 this file
│                                   · 07 editor guide
├── research/                       the evidence trail
│   ├── reference-page.html         the original page, downloaded (727KB)
│   ├── scrollpoints-section.html   the extracted section markup
│   ├── scrollpoints-css.txt        the extracted CSS rules
│   └── shots/                      desktop-*/mobile-* = ORIGINAL
│                                   new-*/wp-* = THIS BUILD (see shots/README.md)
└── src/
    ├── standalone/                 TASK 1
    │   ├── index.html   (277 ln)   markup + demo scaffolding
    │   ├── scrollmap.css (496 ln)  ── shared byte-for-byte with the plugin
    │   ├── scrollmap.js  (490 ln)  ── shared with the plugin (+ a DOM-ready boot)
    │   ├── vendor/                 GSAP 3.13 + ScrollTrigger, vendored
    │   └── assets/                 map.jpg, wwf.woff, 6 prey photos
    └── wp-plugin/                  TASK 2
        ├── docker-compose.yml      wordpress + mariadb on :8280
        ├── seed-demo.php           idempotent seeder (also the migration example)
        └── wwf-scrollmap/          the plugin
```

🗣 **The one-sentence architecture:** "Two of the three Task 1 files are the plugin's
front-end files, unchanged. The standalone file was written to be CMS output, so nothing had
to change when it became a block."

---

# TASK 1 — `src/standalone/`

## `index.html` (277 lines)

Markup only, plus a little demo scaffolding (the two dark bands top and bottom) that the
theme would own in a real site. Everything the engine needs is in `data-` attributes:

| Attribute | On | Meaning |
|---|---|---|
| `data-tgr` | the section | "boot the engine on me" |
| `data-focal="0 50"` | the section | which part of the map survives the cover crop — `0` keeps the **left** edge, which is where the artwork's own title and legend live |
| `data-paws` / `data-markers` / `data-rail` | the section | feature toggles (`on` / `off`) |
| `data-side="left\|right"` | a `.step` | which half the card occupies — the camera aims at the other half |
| `data-zoom="1"` | a `.step` | zoom multiplier for this region |
| `data-label` | a `.step` | the region badge + chapter-rail text |
| `data-hotspot='{"x":48.5,"y":43,"w":17.1,"h":39.3}'` | a `.step` | the region, as **percentages of the map image** |

🗣 "Percentages of the image, not pixels — so the same numbers work at any viewport and on
any rendition of the picture. Those six hotspots are the original story's own coordinates,
pulled out of its DOM rather than eyeballed."

Also here: a visually-hidden `<table>` with all 14 countries' tiger counts. 🗣 "The original
ships the map with `alt=""` and every label is pixels. This is the fix."

## `scrollmap.css` (496 lines)

| Lines | Block | Worth saying |
|---|---|---|
| 25–58 | `.tgr` + design tokens | `--accent`, `--ink`, `--forest`, `--dim`, `--card-bg`… 🗣 "The CMS themes an instance by writing six custom properties inline — no extra stylesheet, no `!important`." |
| 64–99 | `.tgr__stage` (sticky) · `.tgr__camera` · `.tgr__map` · `.tgr__grade` | `transform-origin: 0 0` on the camera is what makes the camera maths one linear equation. `--inv` is declared here. |
| 105–155 | `.tgr__frame` + corner ticks + `.tgr__chip` | The spotlight: `box-shadow: 0 0 0 200vmax` **is** the dim, and the element itself is a real hole |
| 161–189 | `.tgr__marker` | `transform: … scale(var(--inv))` — the counter-scale that keeps pins a constant size however far the camera zooms |
| 195–204 | `.tgr__paws` | the paw-trail layer |
| 210–260 | `.tgr__bar`, `.tgr__rail` | progress bar; bottom-centred chapter rail (bottom-centred so it can never collide with a card on either side) |
| 266–300 | `.tgr__steps`, `.step`, `.step__pin`, card column | `margin-top: -100dvh` pulls the cards over the stage; `.step` is 140vh and `.step__pin` is **sticky**, so the card holds still while the camera flies; `grid-column 8/5` vs `1/5` is the side split |
| 302–360 | `.card` and its parts | flex column + a shrinkable photo, so a card can never outgrow the screen |
| 386–405 | `.step--wide` | opening/closing cards: wider, larger display type, right-hand side (the map's own title is on the left) |
| 414–460 | Responsive | **the phone split** — see below |
| 470–496 | No-JS + reduced motion | |

🗣 **The phone rule, as arithmetic:** "Under 900px the stage becomes a 45vh map window
stuck to the top, and the cards are pinned in the 55vh below it, sliding in sideways like a
carousel. 45 + 55 = 100 — the map and the cards are two separate boxes that add up to the
screen, so the card physically cannot reach the map. 'Nothing covers the highlight' is not a
judgement call, it's addition."

## `scrollmap.js` (490 lines) — the engine

Dependencies: GSAP + ScrollTrigger. **No rAF loop and no scroll listener in this file.**

| Line | Function | What it does / 🗣 |
|---|---|---|
| 42 | `init(root)` | one instance: read config, build furniture, measure, declare the motion. Guarded against double-boot; several blocks per page work |
| 96 | `measure()` | reimplements `object-fit: cover` **with known numbers** and sizes the camera layer to the rendered image box. 🗣 "Hotspots are percentages of the *image*. If the browser crops it for me, element-% stops matching image-%. Sizing the layer to the cover box makes them the same thing again." |
| 108 | `freeArea(side)` | **THE ONE RULE.** Returns the on-screen box the highlight is aimed into: the half the card is *not* in on desktop; the whole 45vh map window on phones. 🗣 "This function is the answer to 'how do you guarantee the card never covers the region'." |
| 126 | `shotFor(step)` | solves the camera for one region: `k` from how big the region may appear, then `t` from `pos + t + k·p = target`, then clamped so the map never uncovers a viewport edge — with an 8/9% bleed allowed so edge regions (Indonesia, Kazakhstan) still reach their mark |
| 158 | `recompute()` | re-measures everything; wired to `ScrollTrigger.addEventListener('refreshInit', …)` so it runs on every resize, orientation change and mobile URL-bar collapse |
| 180 | `projectFrame(step)` | reads the camera's **live** transform and projects the active hotspot into screen space. 🗣 "The spotlight is never tweened separately — it's derived from the camera every frame, so it cannot drift out of register with the map no matter what the scrub does." |
| 213 | `mm.add('(prefers-reduced-motion: reduce)')` | states, no flights. GSAP reverts the whole context if the user changes the setting |
| 234 | `mm.add('(prefers-reduced-motion: no-preference)')` | the real thing |
| 252 | the camera flight | one scrubbed `fromTo` per step, from the previous shot to this one, over the range where the card rises into reading position. **Both endpoints are functions** — 🗣 "so `invalidateOnRefresh` re-reads them after a resize and re-aims the flight. Stale pixel values after a resize is *the* classic scrollytelling bug; the library fixes it for me." |
| 276 / 288 | spotlight + vignette | fade on the same scroll range |
| 309 | card reveal timeline | `toggleActions: 'play reverse play reverse'` — plays in, reverses on the way back up, so scrolling either way looks deliberate. Heading lines slide up from behind a mask, body lines stagger, the photo wipes in with `clipPath` while the image itself un-zooms (Ken Burns) |
| 328 | chapter state | fires the paw trail and the marker pulse, updates the rail |
| 341 | marker drop-in | `back.out(2.2)` bounce, reversing when scrolled away |
| 355 | `trail(from, to)` | places 7 paw glyphs along the line between the two regions' screen centres, rotated to the heading, staggered in and out. 🗣 "About twelve lines for the bit people remember." |
| 386 | `pulseMarker(i)` | expanding ring on arrival |
| 405 | `buildFurniture(…)` | creates markers, paws, rail and the frame's corner ticks in JS, so the CMS template stays pure content |

### The choreography (the part they will ask about)

Each card has **one** timeline that fades it in, holds it, and fades it out — never two
timelines sharing a property. The card is **pinned** (`.step__pin`, sticky) so cards cross-fade
in place instead of sliding past each other. And the three windows never overlap:

```
   outgoing card leaves   →   camera flies and zooms   →   incoming card arrives
```

with a beat in the middle where no card is up. Verified by a scripted audit that walks the
whole page at four viewports and asserts *at most one readable card* and *zero card-over-
spotlight overlap*; both now read 1 and 0.0%.

### Four bugs worth telling them about

1. **GSAP transforms clobber CSS transforms.** The markers carried
   `transform: translate(-50%,-100%) scale(var(--inv))` in CSS, and the drop-in tween animated
   `y` on the same element — GSAP rewrites the whole `transform`, so the centring and the
   counter-scale vanished and pins rendered huge when zoomed. Fix: GSAP animates an **inner**
   element, CSS owns the outer one. 🗣 "Two things must never both own one property."
2. **Functional values run before geometry exists.** `shots` was measured at the end of `init`
   but the tweens were declared before it, so the first evaluation read `undefined`. Fix:
   `recompute()` runs before any tween is built, plus a `shotAt(i)` accessor with a wide-shot
   fallback.
3. **A timeline's duration is the end of its last child, not 1.** The card timeline's positions
   are computed fractions of the scroll range, but its last tween ended at 0.59, so
   ScrollTrigger scrubbed 0→0.59 and stretched every position by 1/0.59 — the card's exit
   finished a whole screen late, leaving it on screen while the next region was already
   highlighted. Fix: a one-second no-op spacer, `ctl.to({}, { duration: 1 }, 0)`.
   🗣 *"This is the one I'd put on a slide. It looks like a timing-tuning problem and it is
   actually an API-semantics problem."*
4. **`fromTo` in a timeline renders its from-state at build time.** Building step 2's timeline
   set the spotlight to `autoAlpha: 1` on page load, over the intro, where no region exists.
   Fix: `immediateRender: false` plus one explicit resting state after the build.

---

# TASK 2 — `src/wp-plugin/`

## `docker-compose.yml`

WordPress 6.7 / PHP 8.3 / Apache + MariaDB 11, plugin folder bind-mounted into
`wp-content/plugins`. Exact run commands (and two real gotchas) in
[`../src/wp-plugin/README.md`](../src/wp-plugin/README.md).

## `seed-demo.php`

Imports the 7 images **with alt text**, builds the whole attribute payload, wraps it with
`serialize_block()`, publishes the page and sets it as the front page. Idempotent.

🗣 **The bug here is a good one:** "`wp_insert_post()` expects *slashed* data and calls
`wp_unslash()` internally. `serialize_block()` JSON-escapes every `<` as `<`, so without
`wp_slash()` those backslashes get eaten and the block attributes come back as literal
`u003cpu003e` text. I saw it on the live page, not in a test."

## `wwf-scrollmap/wwf-scrollmap.php`

Registers the block, and registers GSAP + ScrollTrigger as normal WordPress script handles
from `vendor/`. 🗣 "Vendored, not CDN: no third-party runtime dependency, works behind a
firewall, version pinned by the deploy. Registering them as *handles* means WordPress
deduplicates if another plugin also wants GSAP — that's why it isn't a hard-coded script tag."

## `wwf-scrollmap/block.json` — the contract

Attribute schema (`sectionTitle`, `backgroundImage`, `focalX/Y`, `showPaws/showMarkers/showRail`,
`accentColor`/`inkColor`/`backdropColor`/`cardColor`, `dimOpacity`, `cardOpacity`, `points[]`),
asset wiring, `supports.multiple`, `supports.html: false`, and `render: file:./render.php`.

🗣 "Attributes, not a custom post type: the block stays copy-pasteable between pages, works
in synced patterns, and versions with post revisions — free rollback. `html: false` stops an
editor dropping to raw HTML and breaking the contract."

## `wwf-scrollmap/render.php` (269 lines)

1. `wwf_scrollmap_heading_lines()` — splits the heading on newlines into
   `<span class="w"><span>…</span></span>` masked lines. 🗣 "The editor controls the line
   breaks by pressing Enter. Typography stays editorial, not algorithmic."
2. `wwf_scrollmap_clamp_box()` — the same bounds rule as the editor's `clampBox`, re-applied.
3. `wwf_scrollmap_rgb()` — hex → `r, g, b` so a colour picker can drive an `rgba()` token.
4. Guard: no map image → an editor-only notice, visitors see nothing.
5. Every number re-clamped, `sanitize_hex_color()` on colours. 🗣 "Attributes live in post
   content, which anyone who can edit the post can edit. Never trust stored data."
6. Tokens out as inline CSS custom properties; `data-focal` / `data-paws` / … out as data
   attributes — the identical contract the standalone uses.
7. `wp_get_attachment_image()` for every image → `srcset`, `sizes`, alt, lazy-loading free.
8. `wp_kses($body, $allowed)` limited to `p br em strong u a[href|target|rel]` — 🗣 "mirrored
   exactly by the editor's `allowedFormats`, so what an editor can type and what the server
   will print cannot drift apart."

## `wwf-scrollmap/editor.js` (664 lines)

Plain `wp.element.createElement`, no build step. 🗣 "In a product codebase this is JSX under
`@wordpress/scripts` — same architecture, one fewer thing for you to install to run my demo."

| Piece | Notes |
|---|---|
| `clampBox()` | the bounds rule in **one** place, used by drawing, moving, resizing and the number fields alike |
| `DEMO` | the 8 real chapters — "Load the tiger demo content" seeds full parity in one click |
| validation | **hard** errors call `lockPostSaving()` and are listed with reasons (map, section title, ≥1 chapter, chapter needs text, map chapter needs a region); **soft** warnings (missing alt text) never block |
| `update / add / remove / move / duplicate` | immutable array ops through `setAttributes`. 🗣 "Which is why undo/redo and post revisions work without a line of code from me." |
| `onDown / onMove / onUp` | one handler set, three gestures: **draw** a region, **move** it from the middle, **resize** from a corner. Verified working by driving real mouse events through Playwright |
| layout guide | ghost boxes showing where the region will land and where the card will sit — 🗣 "the 'card never covers the region' rule made visible at edit time instead of at preview time" |
| card preview | heading, status chip and rich body edited *inside* a styled card under the map |

**Usability fix worth mentioning:** three regions overlap over India, so clicking to select
was unreliable. The selected box now lifts above the others and the numbered badge is always
clickable. 🗣 "Found by trying to automate a click and watching Playwright report that a
different box intercepted it."

## `wwf-scrollmap/view.js` / `style.css`

`style.css` is `scrollmap.css` byte-for-byte. `view.js` is `scrollmap.js` with a DOM-ready
boot, because WordPress decides where the script tag lands. It is registered as **both**
`style` and `editorStyle`, which is what makes the editor canvas a true preview.

---

# Verified, not assumed

| Claim | How it was checked |
|---|---|
| No JS errors, engine boots, 8 steps, 6 markers, rail built | Playwright on the standalone **and** on `http://localhost:8280` — `{"hasSection":true,"steps":8,"gsap":"object","ready":true,"markers":6,"rail":8}`, `NO ERRORS` |
| Desktop + phone layouts at every chapter | screenshots `research/shots/new-d0…7`, `new-m0…7` |
| The WordPress render matches the standalone | `research/shots/wp-0…7` |
| The editor mounts, draws, moves and resizes | `wp-editor-*.png`; drag test moved a region `52% → 56.6%` and resized `15.5% → 20.4%` |
| Map framing matches the original | `research/shots/desktop-intro.png` (the captured original) vs our render |

---

# Known deviations from the original — raise these yourself

| # | Deviation | Why |
|---|---|---|
| 1 | **This is a redesign, not a pixel copy.** The original is a light-mode spotlight with a static 0.8s CSS travel; this flies and zooms a camera, in a dark cinematic treatment | A deliberate step past the brief's "as closely as possible" baseline. The original's *structure*, *content*, *hotspot coordinates* and *map framing* are all kept — git history has the faithful version if they want to see it |
| 2 | Wild-pig region clamped to `h: 20.6` instead of the original's `22.6` | the original's box runs past the bottom edge of the image; the editor won't let a region leave the artwork |
| 3 | Mobile is one component panning one map, not the original's duplicated hand-cropped portrait section | same behaviour from one content entry — and the reason the CMS model only needs one image |
| 4 | Paw trail, pins, chapter rail, progress bar, status chips, numbers | additions. All are editor-toggleable, so an editor can dial the page back to plain |
| 5 | Accessibility additions (map alt text, hidden data table, reduced-motion, focusable rail) | improvements on a source that ships `alt=""` |
