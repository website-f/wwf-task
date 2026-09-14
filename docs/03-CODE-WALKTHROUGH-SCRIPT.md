# Interview Script — Demo, Code Walkthrough & Q&A Prep

Timing target: Task 1 demo 3 min → code walkthrough 7–8 min → Task 2 plan 7–8 min → Q&A.
Rehearse twice with a timer. Sections marked 🗣 are literal talking points.

---

## 0. Opening (30s)

🗣 "Before writing any code I reverse-engineered the original. The page is built with
Shorthand, and this webpart is their 'Scrollpoints' pattern: a full-screen map image pinned
to the viewport, text cards scrolling over it, and a spotlight that travels between
highlighted regions. All the country labels are baked into the image itself — the
interactivity is entirely scroll-driven. So my rebuild replicates that mechanic exactly,
and then my CMS plan makes the parts Shorthand hard-codes — the points and highlight
boxes — editable data."

## 1. Live demo flow (3 min)

1. Load standalone `index.html` — note: **one file, zero dependencies, no build step**.
2. Scroll slowly: map pins, intro card rises over the bright map.
3. Sambar deer card enters → **camera pushes in**, map dims, spotlight fades in around
   India/Nepal with the glow pulse → next card: springs carry camera + spotlight together.
4. **Scroll fast up/down** — springs bend mid-flight, nothing restarts. 🗣 "This is why
   I wrote a spring engine instead of CSS transitions — transitions restart their curve
   on every change; springs are interruptible by construction."
5. Progress rail: hover labels, click a dot → smooth-jump.
6. Append `?mode=faithful` → the original's exact 0.8s CSS spotlight, no zoom.
   🗣 "Fidelity is one attribute away — cinematic is my proposal on top of it."
7. DevTools responsive 390px: full camera flights between countries.
8. Toggle "Emulate CSS prefers-reduced-motion" → everything snaps instantly.
9. Hover a country label → tooltip hotspot bonus (also keyboard: Tab).

## 2. Code walkthrough (structure to follow in the editor)

### 2.1 HTML (🗣 per block)

```html
<section class="scrollmap" id="tiger-map" aria-label="Tiger range countries">
  <div class="scrollmap__media">        <!-- pinned layer -->
    <img class="scrollmap__map" src="map.jpg" alt="Map of Asia showing…">
    <div class="scrollmap__dim"></div>       <!-- black, opacity .5, toggled -->
    <div class="scrollmap__spotlight"></div> <!-- traveling window -->
  </div>
  <ol class="scrollmap__points">
    <li class="scrollmap__point" data-align="right"
        data-hotspot='{"x":48.5,"y":43,"w":17.1,"h":39.3}'>
      <article class="card"> …heading, rich text, figure+figcaption… </article>
    </li>
    …
  </ol>
</section>
```

🗣 "Semantic choices: the steps are an ordered list because order is meaning; each card is an
`article`; captions are real `figcaption`s. The hotspot data lives in `data-` attributes —
that's deliberate: it's exactly the shape the CMS will emit in Task 2, so the JS engine never
changes between the standalone file and the WordPress block."

🗣 "The original ships the map with an empty alt and the labels are pixels, invisible to
screen readers. I added a visually-hidden data table of the countries — an improvement over
the source, not just a copy."

### 2.2 CSS — the three layers (🗣)

1. **Pinning** — 🗣 "The media layer is `position: sticky; top: 0; height: 100vh` inside the
   tall section. Shorthand does the same thing manually with fixed/absolute switching
   (`data-attach=before/during/after`); sticky gives it to us free of scroll-jank, and I keep
   their absolute-bottom end state so the map parks correctly when the section leaves."
2. **The spotlight trick** — 🗣 "The original does it with two layers: a black 0.5 overlay
   plus a window div that carries a second copy of the map as a background-image, positioned
   to line up with the map underneath. I get the identical visual with ONE element: the frame
   div has `box-shadow: 0 0 0 200vmax rgba(0,0,0,.5)` — the giant hard shadow IS the dim, and
   the element itself is a real hole, so alignment is pixel-perfect by construction, nothing
   to recompute on resize. The border is an `outline` so it draws outside the box without
   shifting geometry. Their values kept exactly: 4px solid `#2a6788`, `0.8s` travel — moving
   left/top/width/height moves the hole and the border together."
3. **Cards & typography** — 🗣 "Real values lifted from their stylesheet: WWF woff for
   uppercase headings at 160→180% with line-height 1.2; Open Sans body stepping
   17→22px across breakpoints; card = white overlay at 0.85 with .5em radius; text #000,
   links #1155cc. Grid: cards are 6 of 12 columns, offset 0/3/6 for left/center/right —
   their exact Layout classes. Scroll rhythm: first point padded 85vh, then 50vh/30vh."
4. **Camera mode (mobile)** — 🗣 "Under 900px the original swaps in a whole separate
   mobile-only section with hand-cropped portrait images — content entered twice. I kept one
   component: below 900px the engine switches from spotlight to a camera — the stage gets
   `translate + scale` so the map flies to each hotspot. Same data, two behaviours."

### 2.3 JavaScript (~120 lines, 🗣 per decision — full detail in 05-CODE-EXPLANATION.md)

The engine has six numbered parts (the comments in the file match):
1. `layoutStage()` — replicates `object-fit: cover` with known numbers and sizes the
   stage div to the rendered image box, so hotspot percentages of the IMAGE are
   percentages of the STAGE — frame and pins position with plain CSS `%`.
2. `moveFrame()` / `setFrameBox()` — spotlight state machine; when the frame was hidden
   it jumps silently first (`transition:none` + forced reflow via `void frame.offsetWidth`)
   then fades in, so it never visibly travels from a stale position.
3. `applyCamera()` — mobile pan/zoom: with `transform-origin: 0 0`, a stage point `p`
   renders at `stagePos + t + k·p`; solve `t` so the hotspot centre hits the focal point,
   clamp so map edges never leave viewport edges.
4. Activation IntersectionObserver, `rootMargin: '-42% 0px -42% 0px'`.
5. Card-reveal IntersectionObserver (subtle fade-up — an enhancement the original
   doesn't have; disabled under reduced-motion).
6. Resize wiring: `img.load`, `ResizeObserver` on the viewport, `matchMedia('(max-width:
   899px)')` change listener.

🗣 Key decisions:
- **IntersectionObserver, not scroll listeners** — "The browser tells me when a card crosses
  the center band; no per-frame work on the main thread, no layout thrash. A scroll handler
  reading `getBoundingClientRect` per card per frame is the classic jank source."
- **The rootMargin trick** — "Negative 42% top and bottom shrinks the observation area to a
  16%-tall band mid-viewport, so a card activates roughly when the reader is reading it —
  matching the original's feel."
- **CSS does the animating** — "JS only sets four style properties; the 0.8s ease is pure CSS,
  GPU-friendly, and `prefers-reduced-motion` disables it in one media query."
- **Resize handling** — "`ResizeObserver` on the viewport re-runs the cover math — it also
  catches the mobile URL-bar collapse that window resize events miss."
- **Zero dependencies** — "The brief said keep dependencies reasonable and justify them.
  Everything here is a platform primitive; GSAP or scrollama would add kilobytes to do the
  same class toggle. If this grew into scrubbed, timeline-linked animation, GSAP
  ScrollTrigger is what I'd reach for — I know where the ceiling is."

## 3. Task 2 presentation track (7–8 min)

Follow `02-CMS-INTEGRATION-PLAN.md` top to bottom. Narrative spine:

1. 🗣 "Everything hard-coded in my standalone file is exactly what becomes content in the
   CMS: one JSON schema — background image, global effect settings, and an ordered array of
   points, each with an optional hotspot in percentage coordinates."
2. Show the block inserted from the `+` menu (requirement: add via page editor).
3. Fill fields (requirement: enter/configure data) — emphasize **drawing the hotspot box on
   the image** instead of typing coordinates. 🗣 "Non-technical editors think visually; the
   numbers still exist in the sidebar for fine-tuning."
4. Reorder points by dragging, delete one (requirement: edit/reorder/remove).
5. Preview draft on desktop + mobile toggle, then publish (requirement: preview).
6. Validation: try publishing without a map image → blocked with a notice; draw a box past
   the image edge → clamped.
7. Rendering: 🗣 "Server renders the same semantic HTML as my standalone file; one shared
   JS/CSS pair per page however many instances; images go through the media library so I get
   srcset and alt for free; content is sanitized with wp_kses on output."
8. Close with the portability table — 🗣 "'Web part' is SharePoint language — the identical
   schema becomes an SPFx property pane; on Drupal it's a paragraph type; headless, it's a
   component. The front-end engine never changes, which is why Task 1 was written
   dependency-free in the first place."

## 4. Q&A preparation

**Q: Why not just embed Shorthand?**
🗣 "Shorthand is a hosted authoring tool with per-story publishing — great for campaigns, but
you can't drop it into an existing CMS page, brand-govern it, or let editors reuse it as a
component. Rebuilding it as a first-class webpart gives the org the pattern without the
license and iframe constraints."

**Q: Why is the text baked into the map image? Would you keep that?**
🗣 "For Task 1 fidelity I reuse their artwork. In production I'd split it: clean base map +
data-driven HTML/SVG pins from the CMS — then counts are editable, translatable, and
accessible. My hotspot data model already supports that; it's a rendering swap. The
trade-off is design control: their designers hand-placed those labels."

**Q: Performance?**
🗣 "One 1.1MB hero image is the whole cost — I'd serve AVIF/WebP renditions via srcset
(the CMS build does this automatically through the media library). JS is ~2KB, no
frameworks; animation is compositor-only (opacity/transform where possible); observers not
scroll listeners; images below the fold lazy-load."

**Q: Accessibility?**
🗣 "Reduced-motion honored; hidden text alternative for the baked-in map data; semantic
list/article/figure structure; contrast on cards is white@0.85 over the map with black text
— passes AA; keyboard users get everything since interaction is native scroll."

**Q: Browser support / edge cases?**
🗣 "Sticky, IO, ResizeObserver are all baseline since ~2020. No-JS fallback: bright map +
readable cards. iOS toolbar viewport changes handled with dvh units with a vh fallback."

**Q: What was hardest?**
🗣 "Keeping the spotlight's background image pixel-aligned with the map underneath at every
viewport size — it needs the rendered dimensions, not percentages alone, hence the
ResizeObserver recompute."

**Q: What would you do with more time?**
🗣 "Split the map into base art + data pins; keyboard/hash navigation between points; Playwright
visual-regression tests against reference screenshots; Storybook for the card component."

## 5. Pre-demo checklist

- [ ] Fresh clone opens offline (font + images local, Open Sans self-hosted fallback)
- [ ] Test at 1920, 1366, 768, 375 widths + reduced-motion
- [ ] WP docker stack starts + demo page seeded (run once the morning of)
- [ ] Backup: screen-recording of both demos in case of machine trouble
- [ ] Print/PDF of `02-CMS-INTEGRATION-PLAN.md` diagrams
