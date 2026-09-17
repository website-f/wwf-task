# Code Explanation — the deep technical doc

Everything that is interesting about this build, and why it was done that way. Present from
[`03-CODE-WALKTHROUGH-SCRIPT.md`](03-CODE-WALKTHROUGH-SCRIPT.md); use this when someone digs.

- Task 1: `src/standalone/` — `index.html`, `scrollmap.css`, `scrollmap.js`
- Task 2: `src/wp-plugin/wwf-scrollmap/` — the same CSS and engine, plus a block
- File-by-file index: [`06-FILE-BY-FILE-REFERENCE.md`](06-FILE-BY-FILE-REFERENCE.md)

---

# PART A — the original, in 30 seconds

The reference page is built with **Shorthand**. The second webpart is their "Scrollpoints"
section:

1. A full-screen map image **pinned** to the viewport. Every label, tiger count, the legend
   and the big title are **baked into the artwork** — none of it is HTML.
2. **Story cards** scroll over it (intro → 6 prey species → outro), on a 12-column grid.
3. Cards with a **highlight box** (x/y/w/h as % of the image) dim the map to 50% black and cut
   a bright, blue-bordered window that **travels with a 0.8s CSS transition**.

All measured, not guessed — see [`01-WEBPART-ANALYSIS.md`](01-WEBPART-ANALYSIS.md). The six
hotspot rectangles used in this build are the original's own `data-box` JSON.

## A1. The decision to redesign

The faithful rebuild was built first and is in the git history. This build keeps the
original's **structure** (pinned map, scrolling chapters, per-chapter regions), its
**content**, its **hotspot coordinates** and its **map framing**, and replaces the treatment:
the camera now flies and zooms into each region instead of a static dim, in a dark cinematic
palette, with a layout rule that guarantees the card never covers the region.

🗣 *"Fidelity was the baseline, not the ceiling. If WWF wants the original look back it's a
stylesheet and two config values — the engine doesn't change."*

---

# PART B — Task 1

## B1. Layer model

```
section.tgr                            tall scroll container
├─ div.tgr__stage        position:sticky; height:100dvh; overflow:hidden
│   ├─ div.tgr__camera   transform: translate(x,y) scale(k)   ← "the camera"
│   │   ├─ img.tgr__map
│   │   └─ div.tgr__marker × 6         pins, counter-scaled by --inv
│   ├─ div.tgr__grade    vignette / colour grade
│   ├─ div.tgr__frame    the spotlight — SCREEN space, not camera space
│   ├─ div.tgr__chip     region badge, pinned to the spotlight
│   ├─ svg.tgr__paws     paw trail — screen space
│   └─ nav.tgr__rail     chapter rail (built by JS)
└─ div.tgr__steps        margin-top:-100dvh  ← cards pulled over the stage
    └─ article.step × 8      140vh tall (135vh on phones)
        └─ div.step__pin     position:sticky — THE CARD IS PINNED, NOT SCROLLED
            └─ div.card      data-side, data-zoom, data-label, data-hotspot on .step
```

**The card is pinned.** `.step__pin` is sticky inside a step that is taller than
the screen, so a card holds still at a fixed spot while its region is on the
map, and cards **cross-fade in place** rather than sliding past each other. That
is the structural half of the fix described in B6a; without it, two cards are on
screen during every hand-over and it is ambiguous which one goes with the
highlight.

`position: sticky` rather than the original's scroll-driven `absolute/fixed/absolute` switch:
same pin and park, on the compositor, with zero JS. 🗣 *"I know the pre-sticky pattern they
used; I chose the platform one."*

## B2. Why GSAP — the honest version

The first build was zero-dependency: a hand-written exponential-smoothing spring in a rAF
loop, plus IntersectionObserver. ~250 lines. It worked.

But the genuinely hard part of this webpart is **scrubbed, interruptible, resize-correct**
scroll animation, and that is exactly ScrollTrigger's job:

| What's hard | What GSAP gives |
|---|---|
| Animation tied to scroll *position*, not fired once | `scrub: 0.7` |
| Reversing mid-flight without a restart | inherent to a scrubbed tween |
| Geometry recomputed and animations **re-aimed** after a resize | functional values + `invalidateOnRefresh` |
| Desktop / mobile / reduced-motion as separate behaviours, cleanly torn down | `gsap.matchMedia()` |
| Sequencing a reveal that also plays backwards | `timeline` + `toggleActions: 'play reverse play reverse'` |

That is ~40 lines of declaration here instead of ~250 lines of machinery I own and have to
defend. It is vendored (`vendor/gsap.min.js`, `vendor/ScrollTrigger.min.js`, ~115KB, deferred)
rather than pulled from a CDN, so there is no third-party runtime dependency and the version is
pinned by the deploy.

What I deliberately did **not** delegate: layout. The grid, the responsive split and the card
are hand-written CSS, because that is where the fidelity lives and I want it readable.

## B3. `freeArea()` — the rule that answers the brief

```js
function freeArea(side) {
  if (isMobile()) return { cx: vw*0.5, cy: vh*0.5, w: vw*0.82, h: vh*0.7 };
  return { cx: side === 'left' ? vw*0.72 : vw*0.30, cy: vh*0.52, w: vw*0.40, h: vh*0.60 };
}
```

The card is laid out in one half of the screen by CSS (`grid-column: 8/span 5` or
`1/span 5`), and every camera shot is solved to land the region in the middle of the **other**
half. On a phone `geo.vh` *is* the 45vh map window, so aiming at its centre is enough.

🗣 *"'The card must not cover the highlighted region' is a structural guarantee here, not
per-chapter tuning. One function decides it — and the editor can see it, because there's a
layout guide in the block editor that draws both boxes."*

## B4. `shotFor()` — the camera maths

`transform-origin: 0 0`, so a point *p* in the camera layer renders at `pos + t + k·p`. One
linear equation per axis:

```js
const k = clamp(min(area.w/boxW, area.h/boxH) * step.zoom, 1.05, isMobile() ? 5 : 3.4);
let tx = area.cx - k*cx - L.x;          // solve so the region centre hits the target
let ty = area.cy - k*cy - L.y;
const padX = L.vw*0.08, padY = L.vh*0.09;                  // allowed bleed
tx = clamp(tx, L.vw - L.x - k*L.w - padX, -L.x + padX);    // never uncover a viewport edge
ty = clamp(ty, L.vh - L.y - k*L.h - padY, -L.y + padY);
```

The bleed matters: regions at the very edge of the artwork — Indonesia at the bottom,
Kazakhstan at the top — would otherwise be clamped into a corner far from their target. 8–9%
of bleed against a stage painted the same forest colour as the vignette is invisible, and buys
a correct composition.

## B5. `projectFrame()` — why the spotlight can't drift

The spotlight is **never tweened**. Every frame the engine reads the camera's live transform
and projects the active hotspot into screen space:

```js
const k = gsap.getProperty(camera,'scale'), tx = …, ty = …;
const w = sp.w/100*geo.w*k,  h = sp.h/100*geo.h*k;
const cx = geo.x + tx + k*((sp.x + sp.w/2)/100*geo.w);
gsap.set(frame, { width: w, height: h, x: cx - w/2, y: cy - h/2 });
```

🗣 *"Derived, not animated — so however the scrub behaves, the bright window is wherever the
map actually is. It cannot get out of register."*

And the dim is one element:

```css
.tgr__frame { box-shadow: 0 0 0 200vmax rgba(2,12,7,var(--dim)); }
```

The giant hard shadow **is** the dim; the element itself is a real hole, so the bright region
is pixel-aligned with the map by construction. The original needs two layers — a black overlay
plus a window carrying a second copy of the map, background-positioned to line up — and has to
recompute that alignment on every resize.

## B6. The declarations

```js
gsap.fromTo(camera,
  { x: () => shotAt(i-1).x, y: () => shotAt(i-1).y, scale: () => shotAt(i-1).k },
  { x: () => shotAt(i).x,   y: () => shotAt(i).y,   scale: () => shotAt(i).k,
    ease: 'power2.inOut', immediateRender: false,
    onUpdate: () => syncCameraVars(step.spot ? step : steps[i-1]),
    scrollTrigger: { trigger: step.el, start: 'top 92%', end: 'top 30%',
                     scrub: 0.7, invalidateOnRefresh: true } });
```

Both endpoints are **functions**. `recompute()` is wired to ScrollTrigger's `refreshInit`, so
on every refresh — resize, orientation change, mobile URL-bar collapse — the geometry is
re-measured and `invalidateOnRefresh` re-runs those functions, re-aiming every flight. 🗣
*"Stale pixel values after a resize is the classic scrollytelling bug. This is the line that
buys the library its place."*

On the same scroll range: the spotlight and chip fade, and the vignette (`grade: 0.45` on wide
shots, `1` on close-ups).

## B6a. The choreography — why a card can never belong to the wrong highlight

The first version of this had the camera on a scrubbed tween and the cards on separate
play/reverse triggers. Their scroll ranges overlapped, so the camera could already be sitting
on region N+1 while card N was still fully readable. Two cards up at once, and no way to tell
which card the highlight belonged to. Two rules fixed it.

**Rule 1 — one owner per property.** Each card now has exactly *one* timeline, which fades it
in, holds it, and fades it out. Previously step N's timeline faded card N *in* and step N+1's
faded it *out*: two scrubbed timelines owning one property, where whichever rendered last won
— and a finished tween re-asserts its end value, so card N could snap back to opacity 1 long
after it should have gone.

**Rule 2 — three windows, no overlap.** Reading the incoming step's top edge as `T`:

```
   T 134 → 103    the outgoing card slides out and fades      (its own timeline)
   T  92 →  25    the camera flies and zooms to the new region
   T  22 →   6    the incoming card slides in and fades up    (its own timeline)
```

There is a deliberate beat in the middle where **no card is on screen** and you are just
watching the map travel. That beat is what makes the pairing legible — the card arrives *after*
the camera lands, so it reads as a caption to what you are looking at.

All of it is scrubbed to scroll position, so the order holds at every point and in both
directions. The windows are derived from one measured constant (`stepVh`), so changing the
step height in CSS cannot desynchronise them.

**The badge follows the camera, not the scroll trigger.** The region badge used to be set by a
separate ScrollTrigger, so mid-flight it announced the next region while the frame was still
drawn around the previous one. Now the camera tween's `onUpdate` decides: before the midpoint
we are still leaving the old region, after it we are arriving at the new one, and the badge and
the frame both follow that one decision.

## B6b. Three GSAP bugs worth telling them about

**1. A timeline's duration is the end of its last child, not 1.** The card timeline positions
its tweens at computed fractions (`frac(22)`, `frac(-6)` …) assuming the timeline runs 0→1
across the scroll range. But the last tween ended at 0.59, so GSAP reported the duration as
0.59 and ScrollTrigger scrubbed 0→0.59 across the whole range — stretching every position by
1/0.59. The card's exit therefore finished a whole screen later than intended, which is exactly
the symptom that started this: a card still up while the next region was highlighted. Fix: a
one-second no-op spacer, `ctl.to({}, { duration: 1 }, 0)`.

**2. `fromTo` inside a timeline renders its from-state at build time.** All eight timelines are
built at init, and step 2's spotlight tween starts from `autoAlpha: 1` (because step 1 has a
region). Building it therefore turned the spotlight on at page load, over the intro, where no
region exists. Fix: `immediateRender: false` on every `fromTo` in a scrubbed timeline, plus an
explicit resting state set once after the timelines are built.

**3. Measuring against the wrong box.** `stepVh` was computed as
`step.height / stage.clientHeight`. On desktop the stage *is* the viewport so it was right; on
phones the stage is only 45vh, so it returned 300 instead of 135 and every derived window was
wrong. Fix: measure against `window.innerHeight`.

All three were found with a scripted audit that walks the whole page and asserts two
invariants — *at most one readable card at a time* and *zero overlap between a readable card
and a visible spotlight* — rather than by scrolling and squinting.

## B7. The reveal, the paws, the pins

- **Card reveal** (`gsap.timeline`, `toggleActions: 'play reverse play reverse'`): card lifts
  in → heading lines slide up from behind `overflow:hidden` masks (`.w > span`) → body lines
  stagger → the photo wipes in via `clipPath: inset(0 100% 0 0)` while the image itself
  un-zooms from `scale 1.2` — a Ken Burns that finishes exactly as the wipe lands.
- **Paw trail** (~12 lines): 7 glyphs placed along the line between the previous and next
  region's screen centres, rotated to the heading, alternating ±12px off the centreline,
  staggered in with `back.out(2)` and out again.
- **Pins**: drop in with `back.out(2.2)`; an expanding ring pulses on arrival. They live in the
  camera layer so they ride the zoom, and counter-scale by `--inv` = `1/scale` so they stay a
  constant size on screen. One CSS variable, no per-element maths.

## B8. Responsive — a different shape, not a smaller one

| | ≥900px | <900px |
|---|---|---|
| Stage | 100dvh, full bleed | **45vh map window stuck to the top** |
| Cards | pinned in one half of the screen, side alternating | pinned in the 55vh below the map |
| Card motion | slides in and out through its own outer edge | **a horizontal carousel** — in from the right, out to the left |
| Camera target | the half the card is not in | the centre of the map window |
| Max zoom | 3.4× | 5× |

On both breakpoints the pin's top offset plus its height comes to exactly 100vh (desktop
`0 + 100`, phones `45 + 55`), so one constant — `HOLD = stepVh - 100` — describes how long a
card is held still on either. 🗣 *"The card cannot reach the map, because the map and the card
are two separate boxes that add up to the screen. It is arithmetic, not judgement."*

The phone treatment is a genuinely different shape rather than a squeezed desktop: the map gets
a permanent window at the top so it is visible and zoomed the whole way down, and the cards
behave like a deck being dealt sideways underneath it.

Implemented as two `gsap.matchMedia()` contexts, so crossing the breakpoint reverts one set of
ScrollTriggers and builds the other with no stale state. A third context handles
`prefers-reduced-motion: reduce` — same content, states set instantly, no flights.

Cards themselves are flex columns with a **shrinkable photo**: the picture gives up height
before the text does, so a card can never outgrow the screen whatever an editor writes.

## B9. Accessibility

- The original ships the map with `alt=""` and every label is pixels. This build adds a
  descriptive `alt` **and** a visually-hidden `<table>` with all 14 countries' counts, years
  and trends.
- `prefers-reduced-motion` is a first-class branch, not an afterthought.
- Semantic `article` / `figure` / `figcaption`; real `<button>`s in the chapter rail with
  `aria-current`; decorative layers `aria-hidden`.
- Interaction is native scroll, so keyboard users get everything free.
- No-JS: `.tgr:not(.is-ready)` undoes the sticky overlay — static map, readable stacked cards.

## B10. Performance

- Animated properties are `transform` and `opacity` only — compositor work, no layout.
- GSAP 115KB, deferred, vendored, one request from our own origin.
- Photos `loading="lazy"`; map `fetchpriority="high"` with explicit dimensions against CLS.
- Geometry is measured on refresh, not per frame.
- `will-change: transform` on the camera only.

## B11. The two bugs

**1. Two systems owning one property.** The map pins carried
`transform: translate(-50%,-100%) scale(var(--inv))` in CSS, and the drop-in tween animated `y`
on the same element. GSAP rewrites the whole `transform`, so the centring and the counter-scale
vanished and pins rendered enormous at high zoom. Fix: GSAP animates an **inner** element; CSS
owns the outer one.

**2. Functional values evaluated before geometry existed.** `shots` was measured at the end of
`init`, but the tweens were declared before it, so the first evaluation read `undefined` and
the page threw `Cannot read properties of undefined (reading 'grade')`. Fix: `recompute()` runs
before any tween is built, plus a `shotAt(i)` accessor with a wide-shot fallback.

Both were found by screenshotting every chapter in headless Chromium with the console attached
— not by clicking around.

---

# PART C — Task 2

## C1. `block.json` — the contract

Typed attribute schema with defaults, asset wiring, `supports.multiple: true`,
`supports.html: false`, `render: file:./render.php`. Full model in
[`02-CMS-INTEGRATION-PLAN.md`](02-CMS-INTEGRATION-PLAN.md) §1.

🗣 *"Attributes, not a custom post type: copy-pasteable between pages, works in synced
patterns, versions with post revisions — free rollback. A CPT would only pay off if one map
were shared across many pages."*

## C2. `render.php` — server render

Prints **exactly the Task 1 markup**, which is why `style.css` and `view.js` are shared. The
security walk: every number re-clamped (the same rule as the editor's `clampBox`),
`sanitize_hex_color()` on colours, `esc_attr`/`esc_url`/`esc_html` on scalars, and card HTML
through `wp_kses` limited to `p br em strong u a[href|target|rel]` — a whitelist mirrored by
the editor's `allowedFormats`, so the two ends cannot drift apart.

`wp_get_attachment_image()` for every image → `srcset`, `sizes`, alt and lazy-loading free.

One nice detail: `wwf_scrollmap_heading_lines()` splits the heading on **newlines** into the
masked `.w > span` structure the reveal animates. 🗣 *"The editor controls line breaks by
pressing Enter — typography stays an editorial decision, not an algorithm's."*

## C3. `editor.js` — the editing experience

Plain `wp.element.createElement`, no build step. The four brief requirements, mapped to code:

1. **Add via page editor** — `registerBlockType` + `block.json` metadata → it's in the `+`
   inserter under "Scroll Map".
2. **Enter/configure fields** — `InspectorControls` panels (Map, Motion, Colours, Chapters,
   Chapter N); heading, status chip and rich body edited **inline in a live card preview**.
3. **Edit / reorder / remove** — the Chapters repeater (select, ↑ ↓, duplicate, remove, add
   map-or-text chapter), and the region itself **drawn on the map**: one pointer-handler set
   covering draw / move / resize, all writing through a single `clampBox`.
4. **Preview before publish** — the canvas is live, plus native WordPress draft preview with
   device toggles.

Plus two things that aren't in the brief but sell the block:

- **The layout guide** — ghost boxes on the canvas showing where the region will fly to and
  where the card will sit. The "nothing covers the highlight" rule, visible at edit time.
- **Two-tier validation** — hard rules call `lockPostSaving()` and list their reasons; soft
  accessibility warnings only warn. 🗣 *"Blocking someone's publish over a missing alt text is
  how you teach people to hate the CMS."*

Everything flows through `setAttributes`, so undo/redo and revisions work with no code from me.

**One usability fix found by testing:** three regions overlap over India, which made boxes
unclickable. The selected box now lifts above the rest and its numbered badge is always
clickable. Found because Playwright reported that a different box intercepted the click.

## C4. Assets and dependencies in WordPress

GSAP and ScrollTrigger are vendored into the plugin and registered as **normal WordPress
script handles** in `wwf-scrollmap.php`, with `view.asset.php` declaring them as dependencies
of the view script. 🗣 *"Not a hard-coded `<script>` tag — as handles, WordPress deduplicates
them if another plugin also wants GSAP, and loads them in the right order with `defer`."*

## C5. `seed-demo.php` and the migration story

Imports 7 images with alt text, builds the attribute payload, `serialize_block()`, publishes
the page, sets it as the front page. Idempotent.

🗣 *"It's also my answer to 'how would you migrate existing content?' — a migration is a script
that builds this array and hands it to `serialize_block()`. And it taught me a WordPress
gotcha worth knowing: `wp_insert_post()` expects slashed data and calls `wp_unslash()`
internally, so without `wp_slash()` the `\\u003c` escapes that `serialize_block()` produces get
eaten and every block attribute comes back as literal `u003cpu003e` text. I saw that on the
live page."*

## C6. Portability

| Target | Editing UI | Render |
|---|---|---|
| SharePoint (SPFx) | property pane + React canvas — the drawing code ports as-is | web part `render()` |
| Drupal | paragraph type + nested chapter paragraphs | Twig template |
| Headless (Contentful/Strapi/Sanity) | component + repeatable entries | any front end + this `view.js` |

The schema is plain JSON, the renderer consumes `data-` attributes, and the engine is
framework-free. Porting is re-hosting the same three pieces.

---

# PART D — self code-review

Offer two or three of these unprompted.

1. *"You added a dependency you'd previously argued against."* — Correct, and I'll own it. The
   zero-dependency version is in git; it was 250 lines of spring maths I'd have to defend line
   by line, and its resize story was weaker than `invalidateOnRefresh`. I changed my mind when
   the requirement changed from "travel a rectangle" to "fly a camera".
2. *"200vmax box-shadow — isn't that a huge paint area?"* — One rectangle with a hard,
   non-blurred shadow: a single solid paint. The alternative rasterises the map bitmap twice.
   If profiling ever showed it hot I'd swap to `clip-path: polygon(evenodd …)`.
3. *"`view.js` and `scrollmap.js` are duplicated."* — True, and deliberate for a
   self-contained assignment. In production it's one source package and the standalone file is
   a build artefact.
4. *"Cards are capped in height on mobile — content can be clipped."* — The cap is what
   guarantees the map stays visible, so I chose a visible constraint over a broken layout, and
   the editor guide tells editors to keep phone-facing chapters short. The better fix is a
   "read more" affordance on phones.
5. *"The pins are decorative duplicates of the spotlight."* — Fair. They're toggleable, and
   they exist mostly to demonstrate the counter-scale technique and give the wide shot life.
6. *"`multiline` RichText is soft-deprecated."* — Acknowledged; the modern pattern is
   InnerBlocks with `core/paragraph`. Chosen here to keep a chapter's data in one attribute,
   which makes the migration story simpler. I'd move if cards needed mixed block content.

**Strengths to state plainly**

- Fidelity was *measured* — stylesheet values and hotspot JSON pulled from the original's DOM,
  and the map framing caught by overlaying a screenshot of the original at the same viewport.
- One data model drives the standalone, the desktop layout, the phone layout, the
  reduced-motion path and the CMS editor.
- Security done properly server-side: kses whitelist mirrored by the editor, escaping on every
  output, numbers re-clamped on the server.
- Accessibility exceeds the original in four concrete ways.
- Both bugs I hit are interesting ones with transferable lessons, and I found them by
  automating a browser rather than by clicking around.
