# Code Explanation & Review — Interview Presentation Master Doc

This is the single document to present from. It explains **every method in the
final code**, why it was chosen over the alternatives, and the code-review
critique you should be ready to give and receive. File references:

- Task 1: [`src/standalone/index.html`](../src/standalone/index.html) (one file: markup + CSS + JS)
- Task 2: [`src/wp-plugin/wwf-scrollmap/`](../src/wp-plugin/wwf-scrollmap/) (WordPress block plugin)

---

# PART A — How the original works (30-second framing)

The reference page is built with **Shorthand**. The second webpart is their
"Scrollpoints" section:

1. A full-screen **map image is pinned** to the viewport while the section scrolls.
   Every label (countries, tiger counts, legend, the big title) is **baked into
   the image** — none of it is HTML.
2. **Story cards** scroll over the pinned map (intro → 6 prey species → outro),
   alternating left/right/center on a 12-column grid.
3. Cards with a **highlight box** (x/y/w/h as % of the image) dim the map to
   50% black and cut a bright, blue-bordered **spotlight window** that
   **travels with a 0.8s transition** between regions.

Everything below reproduces that — then improves specific weaknesses
(accessibility, the mobile fork, the double-image spotlight).

# PART B — Task 1 standalone: every technique explained

## B1. Layer architecture

```
<section class="scrollmap">                     ← tall scroll container
 ├─ .scrollmap__viewport   position:sticky, 100dvh, overflow:hidden
 │   └─ .scrollmap__stage  JS-sized to the map's cover geometry; camera transform
 │       ├─ img.scrollmap__map
 │       ├─ button.scrollmap__pin ×14           ← bonus hover hotspots
 │       └─ .scrollmap__frame                   ← spotlight (dim + window + border)
 └─ .scrollmap__points     margin-top:-100dvh   ← cards pulled up over the stage
     └─ article.scrollmap__point ×8 (data-align, data-hotspot)
```

### Why `position: sticky` and not `position: fixed`?

Shorthand toggles `absolute/fixed/absolute` (`data-attach=before|during|after`)
with scroll listeners — the pre-sticky-era technique. `position: sticky` gives
the identical pin/unpin on the compositor thread with **zero JS**: the viewport
sticks at `top: 0` while the section has room, then naturally "parks" and
scrolls away at the section's end — exactly their `attach=after` state.
*Talking point: I know both patterns; I chose the platform one and can name
what it replaced.*

### The `-100dvh` trick

The sticky viewport occupies the first 100vh of the section. The cards
container pulls itself up by `margin-top: -100dvh` so cards start **over** the
map rather than after it. Scroll length = height of the cards. This is the
standard scrollytelling skeleton (same one scrollama.js documents).

### Why the stage is JS-sized instead of plain `object-fit: cover`

Hotspots are stored as **percentages of the image**. If the image is cropped
by `object-fit`, element percentages no longer match image percentages. So JS
recomputes the cover geometry once per resize:

```js
var s = Math.max(vw / iw, vh / ih);      // cover scale
var w = iw * s, h = ih * s;              // rendered image size
var x = (vw - w) / 2, y = (vh - h) / 2;  // centred overflow (negative)
```

…and sizes the **stage** to exactly that box. Now the frame and the pins
position themselves with plain CSS percentages — **no per-element math, no
drift**. CSS still declares `inset: 0` + `object-fit: cover` as the no-JS
fallback.

> Bug I hit and fixed (honest war story for the interview): I originally reset
> the fallback with `stage.style.inset = 'auto'` *after* setting `left/top` —
> but `inset` is the shorthand for those same properties, so it wiped them.
> The fix: don't touch `inset` at all; explicit `left/top/width/height` win
> anyway because an over-constrained absolute box ignores `right/bottom`.
> Found it by screenshot-diffing states in headless Chromium.

## B2. The spotlight — one element instead of two images

The original implements the spotlight as: a black overlay div (opacity .5)
covering the map **plus** a window div whose `background-image` is a second
copy of the map, background-positioned so its pixels line up with the map
underneath.

My version is one element:

```css
.scrollmap__frame {
  outline: var(--hl-border) solid var(--hl-color);  /* the blue border   */
  box-shadow: 0 0 0 200vmax var(--dim);             /* the dim, with a   */
                                                    /* hole = the element */
  transition: left .8s ease, top .8s ease, width .8s ease, height .8s ease,
              opacity .5s ease;
}
```

- A **200vmax hard box-shadow** dims everything around the box; the box itself
  is the untouched, fully-bright map — a real hole, so alignment is pixel-perfect
  *by construction* (nothing to keep in sync on resize).
- `outline` instead of `border` because outline draws **outside** the box and
  never shifts the geometry (no border-box math).
- Moving `left/top/width/height` moves the hole → the traveling dim cutout
  and the border animate together with the original's exact `0.8s ease`.

**Visibility state machine** (in `moveFrame()`):

- point has hotspot → set box, add `.is-active` (opacity 1)
- point has none  → remove `.is-active` (dim fades out; intro/outro = bright map)
- hidden → visible: **jump silently first** (`transition: none`, set box, force
  a reflow with `void frame.offsetWidth`, restore transition) so the frame
  fades in *in place* instead of visibly traveling from a stale position.
  That forced-reflow line is a classic — be ready to explain that style writes
  are batched, and reading `offsetWidth` forces the browser to apply the
  pending `transition:none` before the next write.

## B3. Scroll activation — IntersectionObserver band

```js
new IntersectionObserver(cb, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
```

- Negative top/bottom rootMargins shrink the observed area to a **16%-tall
  strip across mid-viewport**. A card activates when it enters that strip —
  i.e. while the reader is actually reading it. This matches the original's
  activation feel.
- **Why IO over scroll listeners**: the browser only invokes the callback on
  band crossings — no work per frame, no `getBoundingClientRect` layout
  thrash, runs off the main thread until crossing. A naive scroll handler
  measuring 8 cards per frame is the canonical jank generator.
- `threshold: 0` = fire as soon as one pixel enters the band (cards are taller
  than the band, so fractional thresholds would never reach 1 and misfire).
- Activation is **idempotent** (`if (i === active) return`) and stateless per
  entry — resistant to fast scrolling and scroll-direction changes.

## B4. The camera — desktop push-in + mobile fly-to

The original ships **two separate sections** (desktop scrollpoints +
mobile "background scrollmation" with hand-made portrait crops) and toggles
them with display classes — content entered twice, images produced twice.

My rebuild keeps **one component**: the stage gets `transform:
translate(tx,ty) scale(k)` and the **camera moves to the hotspot** — a modest
cinematic *push-in* on desktop (k 1.06–1.45, focal point biased **away from
the card column** so the region never hides behind the card), a full *fly-to*
on mobile (k up to 2.6, focal above centre so the card slides in below).

The math (`cameraFor`), with `transform-origin: 0 0`:

```js
// zoom: how large the hotspot may appear in the viewport
desktop: k = clamp(min(0.55*vw/boxW, 0.6*vh/boxH), 1.06, 1.45)
mobile:  k = clamp(min(0.9 *vw/boxW, 0.55*vh/boxH), 1,    2.6)
// position: solve  stagePos + t + k·hotspotCentre = focalPoint
var tx = focalX - k*cx - stageX;
var ty = focalY - k*cy - stageY;
// never show gaps: clamp so the scaled stage always covers the viewport
tx = clamp(tx, vw - stageX - k*stageW, -stageX);
```

- With origin `0 0`, a stage-local point `p` renders at `stagePos + t + k·p` —
  one linear equation per axis, solved for `t`.
- The clamp keeps map edges glued to viewport edges (no green void).
- Transform-only animation → compositor-composited, no layout or paint.

*Talking point: "the original duplicates the section for mobile; I made one
data model render both behaviours, which is exactly what the CMS needs."*

## B4b. The spring engine — our own animation system (cinematic mode)

CSS transitions restart their easing curve every time the value changes —
scroll quickly through three points and the spotlight visibly "resets".
Cinematic mode replaces transitions with **one rAF loop running
exponential-smoothing springs** over every animated value (camera x/y/zoom +
frame x/y/w/h/opacity):

```js
value += (target − value) · (1 − e^(−rate·dt))
```

Why this is the sophisticated choice (say all four):

1. **Interruptible by construction** — a new target just bends the curve
   mid-flight; velocity is implicit, nothing restarts. Fast scrolling feels
   fluid instead of jumpy.
2. **Frame-rate independent** — `dt` is measured per frame, so 60Hz laptops
   and 144Hz monitors settle in identical wall-clock time. `dt` is clamped
   `(0, 50ms]` with a nominal fallback, guarding tab-switch jumps and
   non-monotonic timestamps (a real bug I caught in headless testing —
   negative `dt` makes the smoothing *diverge*; good war story).
3. **Self-suspending** — when every value settles within epsilon the loop
   stops requesting frames: zero idle cost while the visitor reads. A watchdog
   snaps values to target if rAF is starved (hidden/prerendered pages).
4. **One clock** — camera and spotlight can never drift out of sync because
   the same tick writes both.

Different rates per channel tune the feel: camera 3.4/s (heavy, cinematic),
frame 5.2/s (snappier), opacity 6/s. On arrival the frame fires a **glow
pulse** (CSS keyframe on `::after`, replayed by re-adding a class after a
forced reflow).

**Mode switch**: `data-mode="cinematic|faithful"` per instance, `?mode=`
URL override for live comparison. Faithful mode is the original's exact
CSS-transition behaviour — demo both and say the fidelity target is still
one attribute away. `prefers-reduced-motion` forces the instant path.

## B4c. Progress rail

Cinematic desktop also gets a dot-rail (right edge, built by JS from the
points): shows position, hover reveals the point's title, click smooth-scrolls
to that card (`scrollIntoView block:'center'` lands it exactly in the
activation band). Real `<button>`s, `aria-current` marks the active dot,
hidden on mobile and without JS.

## B5. Bonus hover hotspots (pins)

14 invisible `<button>`s positioned over the baked-in country labels
(percentages of the stage, so they ride the camera transform too), with pure
CSS tooltips on `:hover`/`:focus-visible`:

- Real buttons → keyboard focusable, screen-reader announceable
  (`.visually-hidden` text inside).
- Tooltips flip side via `data-tip="left"` for the right-edge countries.
- These demonstrate the **data-driven hotspot model**: in the CMS, this exact
  shape (label + text + %-box) is an editable repeater.

## B6. Typography & fidelity numbers (say these confidently)

| Token | Value | Source |
|---|---|---|
| Headings | `"WWF"` woff, uppercase, 160%→180%, lh 1.2 | `.Theme-Layer-BodyText-Heading-Large` + `.Theme-TextSize-xxsmall` |
| Body | Open Sans, #000, 17→18/20/22px steps | `.Theme-Story` |
| Card | `#fff` @ 0.85, radius .5em | `.Theme-Overlay`, inline `opacity:0.85` |
| Links | `#1155cc` underlined | custom class `zJLAtO` |
| Dim | `#000` @ 0.5 | `.Theme-ScrollpointsSection .Theme-Scrollpoints` |
| Spotlight | 4px solid `#2a6788`, 0.8s | `.Theme-Scrollpoints-Highlight` |
| Rhythm | first card 85vh; 50vh/30vh per card; 20vh tail | `.Scrollpoints__point` rules |
| Grid | card = 6/12 cols at offset 0/3/6; sm 10 cols; xs 12 | `Layout__col-*` classes |
| Hotspots | e.g. Sambar `x48.5 y43 w17.1 h39.3` | `data-box` JSON in the original DOM |

All measured from the downloaded original (`research/` folder) — mention that
you **reverse-engineered the stylesheet rather than eyeballing screenshots**.

## B7. Accessibility — where the rebuild beats the original

- Original map has `alt=""` and all data is pixels → invisible to screen
  readers. Rebuild: descriptive `alt` + a **visually-hidden `<table>`** with
  all 14 countries' data.
- `prefers-reduced-motion: reduce` disables spotlight travel, camera flights,
  card reveals and smooth scroll.
- Semantics: steps are `<article>`s, images use `<figure>/<figcaption>` with
  preserved © credits, pins are focusable buttons.
- No-JS: map renders (CSS cover), cards readable, frame hidden — content-first
  progressive enhancement.

## B8. Performance decisions

- **Zero dependencies** — the engine is ~120 lines; GSAP (~80KB) or scrollama
  would each be replaced by ~10 of those lines. (The brief explicitly asks to
  justify dependency choices.)
- Animations: transform/opacity/box-shadow-position — no layout properties;
  the only geometry writes happen once per activation, not per frame.
- `ResizeObserver` on the viewport (not window `resize` events) also catches
  mobile URL-bar collapse (`100dvh` changes) and container resizes.
- Images: photos resized 4096→1400px (9MB→1.4MB total), `loading="lazy"`
  below the fold, map `fetchpriority="high"`, explicit width/height against CLS.
- Double-boot guard (`data-scrollmap-ready`) + per-instance init → several
  instances per page work (a CMS requirement).

# PART C — Task 2 plugin: file-by-file

## C1. `block.json` — the contract

Single source of truth: attribute schema (typed, with defaults), asset
wiring (`editorScript/editorStyle/style/viewScript`), and `render` pointing at
`render.php`. WordPress auto-enqueues front-end assets **only when the block
is on the page**, once per page regardless of instance count.

Attribute model (mirrors `docs/02-CMS-INTEGRATION-PLAN.md` §1):

```jsonc
backgroundImage: {id, url, alt, width, height}   // media library ID, not just URL
dimOpacity, highlightColor, highlightWidth, travelMs, cardOpacity
points: [{ id, align, heading, body(html), image{id,url,alt}, caption,
           hotspot: {x,y,w,h} | null }]
```

Why attributes (not a custom post type): the webpart stays copy-pasteable
between pages, works in synced patterns, and versions with post revisions —
free rollback. A CPT would only pay off if one map were shared across many
pages.

## C2. `render.php` — server rendering

- Emits **exactly the Task 1 markup** → `view.js`/`style.css` are shared
  verbatim between standalone and CMS. That symmetry is the architecture's
  core claim: *the standalone file was already shaped like CMS output*.
- Security walk: `esc_attr/esc_url/esc_html` on every scalar,
  `wp_kses($body, $allowed)` restricting card HTML to
  `p/br/em/strong/u/a[href|target|rel]`, `sanitize_hex_color` for the colour,
  numeric clamps re-applied server-side (never trust stored numbers).
- `wp_get_attachment_image()` for both map and card images → automatic
  `srcset/sizes`, media-library alt text, lazy loading.
- Design tokens go out as **inline CSS custom properties** on the section —
  per-instance theming with zero extra CSS.
- Missing required image → editors see a red notice, visitors see nothing.

## C3. `editor.js` — the editing experience

Built with plain `wp.element.createElement` — **no build step**, the plugin
runs by mounting the folder. (Say: "in a product codebase this is JSX under
`@wordpress/scripts`; I kept the demo dependency-free deliberately, same
philosophy as Task 1.")

The four Task 2 requirements, mapped to code:

1. **Add via page editor** — `registerBlockType('wwf/scrollmap')` + block.json
   metadata (title, icon, keywords) → it appears in the `+` inserter.
2. **Enter/configure fields** — `InspectorControls` panels: map picker
   (`MediaUpload`), design sliders (`RangeControl`), per-point align
   (`RadioControl`), card image + caption; heading + rich body edited
   **inline in a live card preview** (`RichText` with
   `allowedFormats: bold/italic/link/underline` — matching exactly what
   `render.php`'s `wp_kses` allows; the whitelist exists on both sides).
3. **Edit/Reorder/Remove hotspots** — the Points panel is a repeater:
   select row / ↑ / ↓ / 🗑 (immutable array ops: `map/filter/slice-swap` on
   the attribute — undo/redo works for free because every change flows
   through `setAttributes`). The hotspot itself is **drawn on the map**:
   pointer-down/move/up on the canvas converts client px → image % and
   rubber-bands a box (`clampBox` enforces 0–100 and x+w ≤ 100 on every
   write path — sliders and drawing share it).
4. **Preview before publish** — the canvas *is* the map with numbered boxes;
   plus WordPress native Preview (draft → real front-end render, device
   toggles). Nothing custom to build — that's an argument *for* the platform.

**Validation**: missing background image → `MediaPlaceholder` in the canvas,
warning `Notice` in the sidebar, and `wp.data.dispatch('core/editor')
.lockPostSaving()` — the Publish button physically disables. Try/catch guards
contexts without the editor store (site editor/widgets).

**Demo accelerator**: "Load tiger demo content" seeds the 8 real story points
with the measured hotspot coordinates — full parity with the original in one
click during the interview.

**Animation style control**: the sidebar "Map & design" panel exposes
cinematic vs faithful as a per-instance radio (block attribute `mode` →
`data-mode` in render.php → the same engine switch as the standalone file).

**Site seeder** (`seed-demo.php`, run via `wp eval-file`): imports the 7
images into the media library with alt text, builds the full block with
`serialize_block()`, publishes the "Tiger Range Countries" page and sets it
as the front page. Idempotent (attachments matched by slug, page by path) —
this is how the live demo site was initialised, and it doubles as the answer
to "how would you migrate existing content in?"

## C4. `view.js` / `style.css`

Byte-for-byte the Task 1 engine and styles (minus the demo scaffolding), with
a double-boot guard and DOMContentLoaded wrapper. One `<script>` per page
serves any number of block instances.

## C5. Portability answer (when they say "we don't use WordPress")

The schema in C1 is plain JSON; the renderer consumes data-attributes; the
engine is dependency-free. Porting = re-hosting the same three pieces:

| Target | Editing UI | Render |
|---|---|---|
| SharePoint (SPFx web part) | property pane + React canvas (same drawing code) | web part `render()` |
| Drupal | paragraph type + nested point paragraphs | Twig template |
| Headless (Contentful/Strapi) | component + repeatable entries | any front end + this view.js |

# PART D — Self code-review (strengths, criticisms, answers)

Present 2–3 of these unprompted — reviewers trust candidates who critique
their own work.

**Legitimate criticisms & how I'd answer:**

0. *"You wrote a custom animation system — why not CSS transitions, WAAPI, or
   GSAP?"* CSS transitions restart their curve on every retarget — visible
   resets under fast scrolling. WAAPI has the same restart semantics unless
   you manage composite modes manually. GSAP solves it but costs ~80KB for
   what is here 25 lines of exponential smoothing. The spring is the smallest
   thing that gives interruptibility, and the faithful mode proves I can also
   just… use CSS transitions, matching the original exactly.

1. *"The box-shadow spread is 200vmax — isn't that a huge paint area?"*
   It's one rectangle with a hard (non-blurred) shadow — a single solid paint,
   cheap. The alternative (original's approach) rasterises the map bitmap
   twice. If profiling ever showed it hot, I'd swap to `clip-path:
   polygon(evenodd …)` — I kept box-shadow for older-Safari safety.
2. *"Activation persists when no card is in the band"* (scroll fast and stop
   between cards → last spotlight stays). Intentional and matches the
   original; the alternative (clearing on exit) makes the dim flicker during
   normal reading. The band size (16%) is tuned so gaps between cards are
   short-lived.
3. *"view.js and the standalone engine are duplicated"* — true, deliberate for
   a self-contained assignment. Production: one source package, the standalone
   file becomes a build artifact. I'd also add Playwright visual-regression
   tests (I already screenshot-tested states in headless Chromium during dev).
4. *"Heading is a plain input, not RichText"* — headings are `esc_html`-ed
   plain strings by design (no markup in H2s), which sidesteps entity
   double-encoding. Body text is the rich surface.
5. *"Pin hit-areas are hand-estimated"* — yes, ±1% from the artwork; in the
   CMS model they'd be drawn precisely with the same tool as the spotlight
   boxes. In production I'd split the artwork into a clean base map + HTML
   pins so the labels become editable, translatable and screen-readable.
6. *"`multiline` RichText is soft-deprecated"* — acknowledged; the modern
   pattern is InnerBlocks with core/paragraph. Chosen here to keep the point
   data self-contained in one attribute (simpler migration story); I'd move
   to InnerBlocks if cards ever needed mixed block content.

**Strengths to state plainly:**

- Faithfulness is *measured*, not eyeballed (stylesheet values + extracted
  hotspot JSON from the original DOM).
- One data model drives standalone, desktop spotlight, mobile camera, and the
  CMS editor — nothing is duplicated conceptually.
- Security done properly on the CMS side (kses whitelist mirrored by editor
  allowedFormats, escaping on every output, server-side re-clamping).
- Accessibility exceeds the original (hidden data table, reduced motion,
  focusable pins, semantic figures).

# PART E — Live demo runbook

**Task 1 (3 min)** — open `src/standalone/index.html`:
1. Scroll slowly: map pins → intro card over bright map.
2. Sambar: camera **pushes in**, spotlight fades in *in place* with the glow
   pulse; next card → springs carry camera + spotlight together.
3. **Scroll fast up and down** — the money shot: springs bend mid-flight,
   nothing jumps or restarts. Say "CSS transitions can't do this."
4. Progress rail: hover for labels, click a dot → smooth-jump to that point.
5. Append `?mode=faithful` → the original's exact 0.8s CSS behaviour, no
   zoom. Say "fidelity is one attribute away; cinematic is my proposal."
6. DevTools responsive 390px: full camera flights between countries.
7. DevTools → Rendering → emulate `prefers-reduced-motion` → everything snaps.
8. Hover a country label → tooltip; Tab to a pin → keyboard tooltip.

**Task 2 (4–5 min)** — stack is already seeded: http://localhost:8280
(admin / admin), front page IS the webpart.
1. Show the live front page first (rendered by render.php from block data).
2. wp-admin → Pages → "Tiger Range Countries" → edit: the canvas shows the
   map with 6 numbered hotspot boxes.
3. Select the Sambar point → **Draw region on map** → drag a new box →
   sliders sync; nudge X with the slider.
4. Reorder a point (↑), delete one (🗑), undo (Ctrl+Z — free via attributes).
5. Flip "Animation style" to Faithful → Update → reload front page: same
   content, original behaviour.
6. Fresh-block validation beat: add a new Scroll Map block on a new page →
   Publish is locked until a map image is chosen.
7. Preview → device toggles → Publish.

**Total ~8 min, leaving time for the Part D discussion.**
