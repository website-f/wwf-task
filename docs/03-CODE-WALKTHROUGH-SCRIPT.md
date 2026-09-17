# Interview Script — demo, code walkthrough, Q&A

Target: Task 1 demo 3 min → code walkthrough 7 min → Task 2 demo + plan 8 min → Q&A.
🗣 = say this out loud. Every class name and line reference below was checked against the
current code.

Deep detail: [`05-CODE-EXPLANATION.md`](05-CODE-EXPLANATION.md) ·
file index: [`06-FILE-BY-FILE-REFERENCE.md`](06-FILE-BY-FILE-REFERENCE.md) ·
editor manual: [`07-EDITOR-GUIDE.md`](07-EDITOR-GUIDE.md)

---

## 0. Before they arrive

- [ ] `cd src/wp-plugin && docker compose up -d`, then check **http://localhost:8280** loads
- [ ] `src/standalone/index.html` open in a second tab
- [ ] `research/shots/desktop-intro.png` (the captured original) open in a third
- [ ] wp-admin logged in already (**admin / admin**), Pages → Tiger Range Countries
- [ ] Screen recording of both demos saved, in case the machine misbehaves

---

## 1. Opening (45s)

🗣 "I started by reverse-engineering the original rather than eyeballing it. The page is built
with Shorthand, and this webpart is their 'Scrollpoints' pattern: a full-screen map pinned to
the viewport, cards scrolling over it, and a spotlight that travels between regions. I pulled
their stylesheet values and the actual hotspot coordinates out of the downloaded DOM — those
are in `docs/01-WEBPART-ANALYSIS.md`.

Then I made a decision I want to be upfront about. I built the faithful version first — it's
in the git history — and then I rebuilt it as something I'd actually propose to WWF. The
structure, the content and the original's own coordinates are all still there. What changed
is that the map now *flies and zooms* into each region instead of just dimming, and the
layout guarantees the card never covers the region you're reading about."

---

## 2. Task 1 demo (3 min) — `src/standalone/index.html`

1. 🗣 "Three files and one dependency. No build step — this is the file, opened from disk."
2. Scroll slowly into the opening. 🗣 "The map pins. Notice the framing: the artwork's own
   title and legend are fully visible on the left." **Put the original screenshot beside it.**
   🗣 "That's the one fidelity detail that cost me the most time — the original anchors its
   crop to the *left* edge, not the centre. A centred crop eats the title at 16:9. I only
   caught it by overlaying my render on a capture of the original at the same viewport size."
3. Keep scrolling into **Sambar deer**. 🗣 "Now the camera. As I scroll it's flying and zooming
   into India and Nepal — it's scrubbed, so the animation *is* the scroll position, not a
   thing that fires once. The region lands on the left, the card is on the right. That's not a
   coincidence I tuned per chapter; it's a rule in the code."
4. **Stop halfway between two chapters.** 🗣 "There's no card on screen here at all. The
   order is deliberate: the old card leaves, *then* the map travels, *then* the new card
   arrives. That beat in the middle is what makes it unambiguous which card goes with which
   highlight — the card reads as a caption to what you're already looking at."
5. **Scroll up and down over a transition.** 🗣 "And it's interruptible — reverse mid-flight
   and the camera goes back. Every part of the hand-over is scrubbed to scroll position, so
   the order holds in both directions."
6. Next chapter: point at the **paw trail** walking across, the **pin dropping**, the heading
   revealing **line by line**, the photo **wiping in** while the image itself un-zooms.
7. Bottom **chapter rail**: hover for names, click to jump.
8. **DevTools → 390px.** 🗣 "On a phone it's a different shape, not a squeezed desktop.
   The map keeps a permanent 45vh window at the top, so it's visible and zoomed the whole way
   down, and the cards are pinned in the 55vh underneath and deal sideways like a carousel —
   in from the right, out to the left. The two boxes add up to the screen, so the card
   physically cannot reach the map."
9. **DevTools → Rendering → emulate `prefers-reduced-motion`.** 🗣 "Same content, all the
   flying switched off. One `gsap.matchMedia` declaration."

---

## 3. Code walkthrough (7 min)

### 3.1 Why a library at all — get this in early

🗣 "The brief says keep dependencies reasonable and justify them, so: **one** dependency, GSAP
with ScrollTrigger, vendored locally rather than from a CDN.

I'll defend it honestly. My first version was zero-dependency — a hand-written spring engine
and IntersectionObserver, about 250 lines. It worked. But the hard part of this webpart isn't
'move a div'; it's *scrubbed, interruptible, resize-correct* scroll animation. ScrollTrigger
does that as declarations instead of machinery: about 40 lines here. It also gives me
`matchMedia` scoping for desktop/mobile/reduced-motion that reverts itself cleanly, and
`invalidateOnRefresh`, which fixes the classic scrollytelling bug where everything is aimed at
stale pixel values after a resize.

What I did *not* do is reach for a library for the layout. The layout is where the fidelity
lives, so that's hand-written CSS that I can explain line by line."

### 3.2 The data contract — `index.html`

```html
<section class="tgr" data-tgr data-focal="0 50" data-paws="on" data-markers="on" data-rail="on">
  <div class="tgr__stage">                  <!-- sticky, 100dvh -->
    <div class="tgr__camera"><img class="tgr__map" …></div>
    <div class="tgr__grade"></div>          <!-- vignette -->
    <div class="tgr__frame"></div>          <!-- the spotlight, in SCREEN space -->
    <div class="tgr__chip">…</div>          <!-- region badge -->
    <div class="tgr__bar"></div>
  </div>
  <div class="tgr__steps">
    <article class="step" data-side="right" data-label="India &amp; Nepal" data-zoom="1"
             data-hotspot='{"x":48.5,"y":43,"w":17.1,"h":39.3}'>
      <div class="card">…</div>
    </article>
  </div>
</section>
```

🗣 "Content in elements, behaviour in `data-` attributes. That split is the whole Task 2
architecture: this is exactly what `render.php` prints, so the CSS and the engine move across
to WordPress unchanged. The hotspots are percentages of the *image*, which is why they survive
any viewport and any rendition — and they're the original's own numbers."

### 3.3 The three ideas in `scrollmap.js`

Open the file and walk these in order.

**① `freeArea()` — line 108. The rule.**
🗣 "This is the answer to 'how do you guarantee the card never covers the region'. It returns
the box on screen that the highlight is allowed to land in: on desktop, the half the card is
*not* in; on a phone, the map window at the top. Every camera shot is solved to put the region
in the middle of that box. It's structural, not per-chapter tuning."

**② `shotFor()` — line 126. The camera maths.**
🗣 "`transform-origin` is `0 0`, so a point *p* on the map renders at `position + t + k·p` —
one linear equation per axis. I pick `k` from how large the region is allowed to appear, then
solve `t` so the region's centre lands on the free area's centre, then clamp so the scaled map
never uncovers a viewport edge. I allow about 8% of bleed, because regions at the very edge of
the artwork — Indonesia, Kazakhstan — would otherwise get pinned into a corner."

**③ `projectFrame()` — line 180. Why the spotlight can't drift.**
🗣 "The spotlight isn't tweened. Every frame I read the camera's live transform and project the
active hotspot into screen space. So however the scrub behaves, the bright window is derived
from where the map actually is — it can't get out of register. And the dim isn't a separate
layer: the element has a 200vmax hard box-shadow, so the shadow *is* the dim and the element
itself is a real hole."

**Then the declarations — line 252:**

```js
gsap.fromTo(camera,
  { x: () => shotAt(i-1).x, y: () => shotAt(i-1).y, scale: () => shotAt(i-1).k },
  { x: () => shotAt(i).x,   y: () => shotAt(i).y,   scale: () => shotAt(i).k,
    ease: 'power2.inOut',
    scrollTrigger: { trigger: step.el, start: 'top 92%', end: 'top 30%',
                     scrub: 0.7, invalidateOnRefresh: true } });
```

🗣 "That's the camera. Both endpoints are **functions**, and `invalidateOnRefresh` re-runs them
on every refresh — so after a resize or an orientation change the flight is re-aimed at the new
geometry. No rebuild, no stale pixels. This is the single line I'd point at if someone asked
what the library bought me."

### 3.4 Two bugs — tell them these

🗣 "**One.** The map pins carried a CSS transform — centring plus a `scale(1/camera-scale)`
counter-scale so they stay the same size on screen. The drop-in tween animated `y` on the same
element, and GSAP rewrites the whole `transform` property, so my counter-scale vanished and
the pins rendered enormous when zoomed in. Fix: GSAP animates an inner element, CSS owns the
outer one. The lesson is that two systems must never both own one property.

**Two.** The tweens read geometry through functions, but the geometry was measured at the end
of `init` — *after* the tweens were declared — so the first evaluation read `undefined` and the
page threw. Fix: measure first, plus an accessor with a wide-shot fallback. I found both by
screenshotting every chapter in headless Chromium and reading the console."

---

## 4. Task 2 — the CMS (8 min)

### 4.1 Show the outcome first

🗣 "Same component, running in WordPress." → **http://localhost:8280**. Scroll one chapter.
🗣 "This is `render.php` output. `style.css` is the Task 1 stylesheet byte-for-byte and
`view.js` is the Task 1 engine — the only change is a DOM-ready boot, because WordPress decides
where the script tag goes."

### 4.2 Then the editing experience — the part that matters

wp-admin → Pages → *Tiger Range Countries*.

1. 🗣 "The editor gets the real map with every chapter's region drawn on it, numbered."
2. **Click a numbered badge** → the chapter selects, the card preview below updates.
3. **Drag the box** to move it. **Drag a corner** to resize it. 🗣 "Nobody types coordinates.
   The X/Y/W/H fields exist in the sidebar for fine-tuning, and they and the mouse share one
   `clampBox` function, so a region can never leave the artwork — and the server re-applies the
   same rule, because stored data is never trusted."
4. Toggle **layout guide**. 🗣 "This is the rule from earlier, visible at edit time: dashed box
   = where the region will fly to, green box = where the card will sit. Flip *Card side* and
   they swap. An editor can see the promise, not just take my word for it."
5. Scroll to the **card preview**. Type in the heading. 🗣 "Press Enter for a line break —
   each line animates in separately, so typography stays an editorial decision."
6. Sidebar tour: **Map** (image, section title, framing sliders), **Motion** (paw trail, pins,
   rail — all switchable), **Colours** (brand palette + dim/opacity).
7. **Chapters** panel: ↑ ↓ to reorder, ⧉ duplicate, 🗑 remove, **+ Map chapter** /
   **+ Text chapter**. Then **Ctrl+Z**. 🗣 "Undo is free — every change goes through
   `setAttributes`, so it's in the editor's undo stack and in post revisions."
8. **Validation beat:** delete the section title → Publish locks and the sidebar lists exactly
   why; empty a chapter → its row turns red. 🗣 "Hard rules block publishing. Alt-text gaps
   only warn — an accessibility nudge should never stop someone doing their job."
9. **Preview → Mobile**, then **Preview in new tab**. 🗣 "Real front end, from the draft."

### 4.3 The plan (slides / `02-CMS-INTEGRATION-PLAN.md`)

🗣 "Everything hard-coded in Task 1 is a block attribute: the map plus a focal point, three
motion switches, four colours and two opacities, and an ordered array of chapters — each with
a side, a label, a number, a heading, a status chip, rich body, a photo, a caption, a zoom
strength and an optional region in percentage coordinates.

Attributes, not a custom post type — so the block is copy-pasteable between pages, works in
synced patterns, and versions with post revisions.

Rendering is server-side: PHP prints the same semantic markup as my standalone file, images go
through the media library so `srcset` and alt come free, and card HTML goes through a `wp_kses`
whitelist that's mirrored exactly by the editor's `allowedFormats` — so what an editor can type
and what the server will print can't drift apart.

And GSAP is vendored into the plugin and registered as a normal WordPress script handle, not a
CDN tag — no third-party runtime dependency, works behind a firewall, and WordPress
deduplicates it if another plugin wants GSAP too."

Close on the portability table — 🗣 "'Web part' is SharePoint language. The same JSON becomes
an SPFx property pane; on Drupal it's a paragraph type; headless, it's a component. The engine
never changes, which is why Task 1 was shaped like CMS output in the first place."

---

## 5. Q&A prep

**Why GSAP and not vanilla?** → §3.1. Finish with: 🗣 "And I know what it cost: 115KB, loaded
with `defer`, vendored so it's one request from our own origin."

**Why not just embed Shorthand?** 🗣 "It's a hosted authoring tool with per-story publishing.
Great for campaigns, but you can't drop it into an existing CMS page, brand-govern it, or let
editors reuse it as a component. Rebuilding it as a first-class block gives WWF the pattern
without the licence or the iframe."

**This doesn't look like the original.** 🗣 "Correct, and deliberately. I built the faithful
version first — it's in the git history and I can show it in about thirty seconds. Then I
asked what I'd actually propose. The structure, the content, the measured coordinates and the
map framing are all from the original; the treatment is my proposal. If WWF wants the original
look, it's a stylesheet and two config values away — the engine doesn't change."

**Performance?** 🗣 "One ~1MB map is the real cost, and in the CMS it goes through the media
library so AVIF/WebP renditions and `srcset` are automatic. GSAP is 115KB deferred. Animation
is transform and opacity only — compositor work, no layout. The photos lazy-load. The map gets
`fetchpriority=high` and explicit dimensions against CLS."

**Accessibility?** 🗣 "Reduced motion is a first-class branch, not an afterthought. There's a
hidden data table for the values baked into the artwork, because the original ships `alt=""`.
Semantic `article`/`figure`/`figcaption`, real buttons in the chapter rail, and the interaction
is native scroll so keyboard users get it free. The editor nags about missing alt text."

**What if JavaScript fails?** 🗣 "The section renders as a static map with readable cards
stacked under it — `.tgr:not(.is-ready)` undoes the sticky overlay. Content first."

**Browser support?** 🗣 "Sticky, `dvh`, `clip-path`, `backdrop-filter` and ScrollTrigger are all
fine in current Chrome, Firefox, Safari and Edge. `backdrop-filter` degrades to a solid card."

**How did you verify any of this?** 🗣 "Playwright. Every chapter screenshotted at 1600×900 and
390×844, on the standalone and on the WordPress page, console watched for errors. The drag,
move and resize interactions in the editor are driven by real mouse events in a test — that's
how I found that overlapping regions made boxes unclickable, which is why the selected box now
lifts above the others."

**What would you do with more time?** 🗣 "Split the map artwork into a clean base map plus
data-driven pins, so the tiger counts become editable and translatable — my hotspot model
already supports it. Then drag-handle reordering, deep links to individual chapters, and
Playwright visual-regression tests in CI instead of me looking at screenshots."
