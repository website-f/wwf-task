# Task 1, explained from scratch

Assumes nothing. Read top to bottom once, and you will be able to open any file and say what
every class and every line is for.

**Files:** `src/standalone/index.html` (the markup) · `src/core/scrollmap.css` (550 lines,
the look) · `src/core/scrollmap.js` (668 lines, the movement).

---

# Part 0 · The mental model

Forget code for a second. Picture a **film crew**:

| In the film | In the code | Class |
|---|---|---|
| A big printed map lying on the floor | the map image | `.tgr__map` |
| A camera on a crane above it, which can slide and zoom | a `<div>` we move with CSS `transform` | `.tgr__camera` |
| The window you watch the footage through | a box stuck to the screen | `.tgr__stage` |
| A spotlight on the bit being talked about | a box with a huge shadow | `.tgr__frame` |
| A caption card held up beside the shot | the text panel | `.card` |
| The script that says "now fly to India" | GSAP + ScrollTrigger | `scrollmap.js` |

**The map never moves on its own.** The *camera* moves, and because the map is inside the
camera, the map appears to fly and zoom. That one idea explains most of the code.

Scrolling the page is the crane operator's hand. Scroll down a bit, the camera moves a bit.
Scroll back, it moves back. That is what "scrubbed" means, and you'll see the word a lot.

---

# Part 1 · How class names are built

Every class follows one convention, **BEM**, so you can read a name and know where it sits:

```
.tgr              ← the BLOCK: the whole webpart ("tgr" = tiger)
.tgr__stage       ← an ELEMENT inside it   (two underscores)
.tgr__corner--tl  ← a MODIFIER of that     (two hyphens: "top-left")
```

There are only two blocks in this webpart: **`tgr`** (everything visual) and **`card`** (the
text panel). If you see `tgr__something` it lives in the map area; if you see `card__something`
it lives in the text panel. That's the whole naming system.

---

# Part 2 · The HTML, tag by tag

Here is the real skeleton from `index.html`, with the content stripped out:

```html
<section class="tgr" data-tgr data-focal="0 50"                    ← 1
         data-paws="on" data-markers="on" data-rail="on">

  <div class="tgr__stage">                                          ← 2
    <div class="tgr__camera">                                       ← 3
      <img class="tgr__map" src="assets/map.jpg">                    ← 4
    </div>
    <div class="tgr__grade"></div>                                   ← 5
    <div class="tgr__frame"></div>                                   ← 6
    <div class="tgr__chip"><svg>…</svg><span class="tgr__chip-t"></span></div>   ← 7
    <div class="tgr__bar"></div>                                     ← 8
  </div>

  <div class="tgr__steps">                                           ← 9
    <article class="step" data-side="right" data-zoom="1"            ← 10
             data-label="India &amp; Nepal"
             data-hotspot='{"x":48.5,"y":43,"w":17.1,"h":39.3}'>
      <div class="step__pin">                                        ← 11
        <div class="card"> … </div>                                  ← 12
      </div>
    </article>
    …8 of these…
  </div>
</section>
```

### 1 · `<section class="tgr">` — the whole thing

`class="tgr"` is what the CSS hooks onto. `data-tgr` is what the **JavaScript** hooks onto:

```js
document.querySelectorAll('[data-tgr]').forEach(init);   // scrollmap.js line 83
```

> **Why two different hooks?** So a designer can restyle `.tgr` without breaking the
> JavaScript, and a developer can rename a class without the JavaScript stopping working.
> Classes are for looks; `data-` attributes are for behaviour.

The other `data-` attributes are **settings** the JS reads (`scrollmap.js` lines 106–112):

| Attribute | Means |
|---|---|
| `data-focal="0 50"` | when the wide map is cropped to fit the screen, keep the **left** edge (0%) and the vertical middle (50%) |
| `data-paws="on"` | show the animal-track trail |
| `data-markers="on"` | show the numbered pins |
| `data-rail="on"` | show the jump bar at the bottom |

**CSS — `scrollmap.css` line 25.** `.tgr` is also where every colour is *defined*:

```css
.tgr {
  --ink: #f2efe6;        /* cream text        */
  --forest: #04140d;     /* near-black green  */
  --accent: #8fd14f;     /* WWF green         */
  --dim: 0.62;           /* how dark outside the spotlight */
  --card-bg: rgba(7, 26, 17, 0.84);
  …
}
```

`--ink` is a **CSS custom property** — a variable. Defined once here, used everywhere below as
`var(--ink)`. This is why the CMS can recolour the whole webpart by writing six values into
this one element's `style` attribute: everything inside inherits them.

### 2 · `.tgr__stage` — the window you watch through

```css
.tgr__stage {            /* line 64 */
  position: sticky;
  top: 0;
  height: 100dvh;        /* exactly one screen tall */
  overflow: hidden;      /* anything sticking out is clipped */
}
```

**`position: sticky` in one sentence:** the element scrolls normally until it would go off the
top of the screen, then it *sticks* there until its parent has finished scrolling past.

That is the entire pinning mechanism — no JavaScript. The map appears to freeze while the text
scrolls over it, because the stage is stuck at `top: 0` while the cards keep moving.

`overflow: hidden` matters: when the camera zooms to 3×, the map becomes far bigger than the
screen. This clips it to the window instead of letting it spill down the page.

### 3 · `.tgr__camera` — the thing that actually moves

```css
.tgr__camera {           /* line 73 */
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  will-change: transform;
  --inv: 1;
}
```

Three things to understand here:

**`position: absolute; inset: 0`** — "pin all four edges to the parent". `inset: 0` is
shorthand for `top:0; right:0; bottom:0; left:0`. (JavaScript later replaces these with exact
pixel values — see Part 5.)

**`transform-origin: 0 0`** — when you scale something, it grows *from* a point. By default
that's the centre. Setting it to `0 0` (top-left corner) makes the maths a single equation
instead of a mess. More in Part 5.

**`will-change: transform`** — a hint: "this element is going to move, put it on the graphics
card". It makes the animation smooth.

**`--inv: 1`** is a variable meaning "1 ÷ the current zoom". When the camera zooms to 3×, JS
sets it to 0.333. The map pins use it to *shrink themselves back*, so a pin stays the same size
on screen no matter how far you zoom in. One variable, no per-pin maths. (`scrollmap.js` 245.)

### 4 · `.tgr__map` — the picture

```css
.tgr__map {              /* line 83 */
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: var(--focal-x, 0%) var(--focal-y, 50%);
}
```

**`object-fit: cover`** — the image fills the box completely and crops whatever doesn't fit
(like CSS `background-size: cover`). The map is wide (2561×1224) and the screen is not, so
something has to be cropped.

**`object-position`** decides *which part* survives the crop. `0% 50%` = keep the left edge.
That matters here because the artwork's own title and legend are on the left; a centred crop
would cut them off. This is one of the fidelity details I measured against the original.

### 5 · `.tgr__grade` — the darkening

```css
.tgr__grade {            /* line 92 */
  position: absolute; inset: 0;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(120% 90% at 50% 40%, transparent 30%, rgba(2,12,7,0.55) 78%, …),
    linear-gradient(to bottom, rgba(2,12,7,0.35), transparent 22%, …);
}
```

A sheet of darkness laid over the map. Two gradients stacked: a **vignette** (darker at the
edges, clear in the middle) and a top-and-bottom fade. It makes the cream text readable over a
bright green map.

`opacity: 0` — invisible by default. GSAP fades it to `1` when the camera zooms in and back to
`0.45` on the wide shots (`scrollmap.js` 448–453).

`pointer-events: none` — clicks pass straight through it, so it can't block anything.

### 6 · `.tgr__frame` — the spotlight (the clever bit)

```css
.tgr__frame {            /* line 105 */
  position: absolute;
  left: 0; top: 0;
  width: 10px; height: 10px;         /* JS overwrites with real pixels */
  opacity: 0;
  box-shadow: 0 0 0 200vmax rgba(2, 12, 7, var(--dim));
  outline: 2px solid var(--frame);
}
```

This one element does the job of two. Read `box-shadow: 0 0 0 200vmax`:

```
box-shadow: offset-x  offset-y  blur  SPREAD  colour
             0         0         0     200vmax  dark
```

**Spread** grows the shadow outward in every direction. `200vmax` is 200× the larger screen
dimension — enormous. With no blur and no offset, the result is a **solid dark rectangle
covering the entire screen, with a perfectly sharp hole where the element is**.

So the shadow *is* the dimming, and the element itself is *the hole*. The bright region and the
dim can never drift apart, because they're the same object. The original page used two stacked
layers with a second copy of the map inside the hole, and had to recompute their alignment on
every resize. This needs none of that.

`outline` rather than `border`: an outline is drawn *outside* the box and doesn't change its
size, so the maths stays clean.

Inside it, four `.tgr__corner` divs (`--tl`, `--tr`, `--bl`, `--br`) draw little viewfinder
ticks. They're created by JavaScript, not written in the HTML (`scrollmap.js` 600–605).

### 7 · `.tgr__chip` — the green place badge

The pill that says "INDIA & NEPAL". `.tgr__chip-t` is the empty `<span>` the JS writes the
place name into (`scrollmap.js` 431, inside the camera flight, so the badge can never name a region the spotlight is not on). It's positioned by JS to sit just above the spotlight.

### 8 · `.tgr__bar` — the progress bar

```css
.tgr__bar {              /* line 213 */
  height: 3px; width: 100%;
  transform: scaleX(0);
  transform-origin: 0 50%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
}
```

A full-width bar squashed to zero width. GSAP stretches it from `scaleX(0)` to `scaleX(1)` as
you scroll the section. `transform-origin: 0 50%` makes it grow from the left edge rather than
the middle.

### 9–11 · `.tgr__steps`, `.step`, `.step__pin` — the scrolling part

```css
.tgr__steps {            /* line 269 */
  position: relative;
  z-index: 3;
  margin-top: -100dvh;   /* ← the trick */
}
```

**The negative margin.** The stage is one screen tall and comes first in the HTML, so normally
the cards would begin *below* it. `margin-top: -100dvh` drags the whole card column back up by
exactly one screen, so the cards sit **on top of** the map. `z-index: 3` keeps them in front.

```css
.step {                  /* line 279 */
  min-height: 140vh;     /* taller than the screen, on purpose */
}

.step__pin {             /* line 288 */
  position: sticky;
  top: 0;
  height: 100dvh;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  align-items: center;
  pointer-events: none;
}
```

Each step is **140vh** — 1.4 screens tall. The pin inside it is 1 screen tall and sticky, so:

```
step top reaches 0        → the pin sticks, the card holds still
…40vh of scrolling later  → the step runs out, the pin releases and slides away
```

That 40vh is the **HOLD** — the window where the card sits motionless and you read it. The
other 100vh is the **TRANSITION** — the hand-over to the next chapter.

**The 12-column grid.** `grid-template-columns: repeat(12, 1fr)` divides the width into 12
equal columns, like a newspaper. Then:

```css
.step .card                   { grid-column: 8 / span 5; }   /* columns 8–12 = right side */
.step[data-side="left"] .card { grid-column: 1 / span 5; }   /* columns 1–5  = left side  */
```

`data-side` on the `<article>` flips the card between halves. **This is the rule that makes the
whole thing work:** the JavaScript always aims the map's zoom at the *opposite* half, so the
card can never cover the place you're reading about.

`pointer-events: none` on the pin, `auto` on the card: the empty half of the screen isn't
clickable, so the jump bar underneath stays usable.

### 12 · `.card` and its parts

```html
<div class="card">
  <div class="card__meta">
    <span class="card__num">01</span>
    <span class="card__region">India &amp; Nepal</span>
  </div>
  <p class="h2"><span class="w"><span>Sambar</span></span><span class="w"><span>deer</span></span></p>
  <span class="card__status" data-level="vulnerable">IUCN · Vulnerable</span>
  <p>Sambar deer are one of the most important…</p>
  <figure>
    <div class="card__shot"><img src="assets/sambar.jpg"></div>
    <figcaption>Sambar foal and its mother… © Martin Harvey / WWF</figcaption>
  </figure>
</div>
```

| Class | What it is | CSS line |
|---|---|---|
| `.card` | the glass panel itself | 308 |
| `.card__meta` | the `01 · INDIA & NEPAL` row | 332 |
| `.card__num` | the little circled number | 339 |
| `.h2` | the big display heading | 349 |
| `.w` | **one masked line** of that heading — explained below | 359 |
| `.card__status` | the coloured pill | 362 |
| `.card__shot` | the box the photo lives in | 391 |
| `figcaption` | the credit line | 404 |

**`.card` itself:**

```css
.card {
  background: var(--card-bg);                  /* dark translucent green */
  backdrop-filter: blur(14px) saturate(1.1);   /* frosts whatever is behind it */
  display: flex; flex-direction: column;
  max-height: 86vh;
  overflow: hidden;
}
```

`backdrop-filter: blur()` is what makes it look like frosted glass — it blurs the *map behind
it*, not itself.

The flex column plus `max-height` is a safety net: if an editor writes a lot of text, the card
can't grow past 86% of the screen. The photo (`.card__shot`, which has `flex: 1 1 auto`) gives
up its height first, so the *text* is never the thing that gets cut.

**The `.w` trick — how headings slide up.** This markup looks redundant:

```html
<span class="w"><span>Sambar</span></span>
```

```css
.card .w       { display: block; overflow: hidden; }   /* the window */
.card .w > span { display: block; }                    /* the thing that moves */
```

The outer span is a **window with its overflow hidden**. The inner span is the word. GSAP
starts the inner span pushed 115% *below* its window — so it's invisible, because the window
clips it — then slides it up to 0. The word appears to rise out of nowhere. One `.w` per line,
so lines arrive one after another.

`data-level` on `.card__status` picks the colour, using an **attribute selector**:

```css
.card__status[data-level="endangered"] { color: #ff8f6b; }   /* coral */
.card__status[data-level="vulnerable"] { color: var(--accent-2); }   /* amber */
.card__status[data-level="least"]      { color: var(--accent); }     /* green */
```

### The elements that aren't in the HTML at all

`.tgr__marker` (pins), `.tgr__paw` (tracks), `.tgr__rail` (jump bar) and `.tgr__corner` are all
**built by JavaScript** in `buildFurniture()` (`scrollmap.js` 600–665). They're decoration
derived from the content, so keeping them out of the template means the CMS only ever has to
output actual content.

---

# Part 3 · GSAP in ten minutes

GSAP is an animation library. We use exactly five things.

**1 · `gsap.set(target, {…})`** — change something *right now*, no animation.

```js
gsap.set(frame, { width: 300, height: 200, x: 50, y: 80 });
```

**2 · `gsap.to(target, {…})`** — animate *to* these values.
**`gsap.fromTo(target, {from}, {to})`** — animate from A to B, stating both.

```js
gsap.to(bar, { scaleX: 1, ease: 'none' });
```

**3 · `gsap.timeline()`** — a sequence. You add tweens and say *when* each starts:

```js
const tl = gsap.timeline();
tl.to(a, { x: 100, duration: 1 }, 0);     // starts at time 0
tl.to(b, { x: 100, duration: 1 }, 0.5);   // starts at time 0.5 — overlapping
```

That third argument is the **position**, and it's how the whole choreography is written.

**4 · `ScrollTrigger`** — connects an animation to the scrollbar.

```js
scrollTrigger: {
  trigger: step.el,      // watch this element
  start: 'top 100%',     // begin when its TOP hits 100% down the screen (the bottom edge)
  end:   'top 8%',       // finish when its TOP reaches 8% down the screen (near the top)
  scrub: 0.5             // tie progress to scroll position, catching up over 0.5s
}
```

`start`/`end` read as **"element edge, screen position"**. `top 100%` = the element's top edge
at the bottom of the screen.

**`scrub` is the important word.** Without it, an animation *plays* when triggered. With it,
the animation's playhead **is** your scroll position — scroll back and it runs backwards.

**5 · `gsap.matchMedia()`** — build different animations at different screen sizes, and tear
them down cleanly when the size changes.

```js
mm.add('(prefers-reduced-motion: reduce)',       function () { /* no flying */ });
mm.add('(prefers-reduced-motion: no-preference)', function () { /* the real thing */ });
```

That's the whole accessibility story for motion: one declaration, and GSAP removes the other
branch entirely.

---

# Part 4 · What happens when you scroll one step

This is the core of the whole build (`scrollmap.js` 359–457). Reading the incoming step's top
edge as **T** (100 = bottom of screen, 0 = top):

```
T 134 → 103    the OLD card slides out and fades
T  92 →  25    the CAMERA flies and zooms to the new region
T  22 →   6    the NEW card slides in and fades up
```

Three windows that **never overlap**. In the middle there is a deliberate beat where no card is
on screen and you just watch the map travel — that's what makes it obvious which card belongs
to which place.

### A · the card (lines 361–396)

Each card has **exactly one timeline** that fades it in, holds it, and fades it out:

```js
var ctl = gsap.timeline({
  scrollTrigger: { trigger: step.el, start: 'top 100%', end: 'bottom 8%',
                   scrub: 0.5, invalidateOnRefresh: true }
});

ctl.to({}, { duration: 1 }, 0);                      // ← a spacer; see below

ctl.fromTo(step.card,
  { autoAlpha: 0, x: function () { return slideIn(step); } },
  { autoAlpha: 1, x: 0, ease: 'power3.out', duration: … },
  frac(IN_FROM));                                    // ← when it starts

ctl.to(step.card,
  { autoAlpha: 0, x: function () { return slideOut(step); }, … },
  frac(OUT_FROM));
```

- `autoAlpha` is `opacity` **plus** `visibility` — at 0 the element is truly gone, not just
  invisible, so it can't catch clicks.
- `x` is a horizontal slide in pixels. On desktop the card leaves through its own outer edge;
  on a phone it's a carousel — in from the right, out to the left (`slideIn`/`slideOut`,
  lines 526–527).
- `frac()` (line 347) converts "step top at 22%" into a position on the timeline.

> **The one-line spacer, `ctl.to({}, { duration: 1 }, 0)`, is not filler.** A GSAP timeline's
> duration is wherever its last child ends — here about 0.59. ScrollTrigger then scrubbed
> 0→0.59 across the whole scroll range, stretching every position by 1/0.59, and the card's
> exit finished a whole screen late. That was the bug where a card was still on screen while
> the next region was already highlighted. The spacer pins the timeline's length at exactly 1
> so the fractions mean what they say.

### B · the camera (lines 400–446)

```js
var tl = gsap.timeline({
  scrollTrigger: { trigger: step.el, start: 'top 92%', end: 'top 25%',
                   scrub: 0.6, invalidateOnRefresh: true }
});

tl.fromTo(camera,
  { x:     function () { return shotAt(i - 1).x; },      // where we are
    y:     function () { return shotAt(i - 1).y; },
    scale: function () { return shotAt(i - 1).k; } },
  { x:     function () { return shotAt(i).x; },          // where we're going
    y:     function () { return shotAt(i).y; },
    scale: function () { return shotAt(i).k; },
    duration: 1, ease: 'power2.inOut',
    onUpdate: function () { … } },
  0);
```

**Why are the values written as functions?** Because the right answer depends on the window
size. Writing `x: 640` bakes in a number that's wrong the moment someone resizes. Writing
`x: function () { return shotAt(i).x; }` means GSAP asks *again* whenever
`invalidateOnRefresh` fires — which ScrollTrigger does on every resize, orientation change and
mobile toolbar collapse. This is the single biggest reason a library earned its place here.

`ease: 'power2.inOut'` = start slow, speed up, end slow. A camera move that started and stopped
abruptly would feel mechanical.

### C · the spotlight — derived, never animated (`projectFrame`, line 228)

```js
var k  = gsap.getProperty(camera, 'scale');   // read the camera's live zoom
var tx = gsap.getProperty(camera, 'x');       // and its live position
var w  = sp.w / 100 * geo.w * k;              // how big the region is, on screen, right now
var cx = geo.x + tx + k * ((sp.x + sp.w / 2) / 100 * geo.w);
gsap.set(frame, { width: w, height: h, x: cx - w / 2, y: cy - h / 2 });
```

The spotlight has **no animation of its own**. Every frame it asks the camera where it is and
puts itself exactly on top of the right region. It therefore cannot drift out of alignment,
whatever the scroll does.

### D · the content flourish (lines 475–491)

A separate, **not scrubbed** timeline that plays at its own pace when the card arrives:

```js
ftl.from(words,  { yPercent: 115, stagger: 0.07, ease: 'power4.out' });   // headline lines rise
ftl.from(lines,  { y: 16, autoAlpha: 0, stagger: 0.05 }, '-=0.45');       // body staggers in
ftl.fromTo(shotBox, { clipPath: 'inset(0% 100% 0% 0%)' },                 // photo wipes open
                    { clipPath: 'inset(0% 0% 0% 0%)' }, '-=0.35');
ftl.from(shotImg, { scale: 1.18, duration: 1.5 }, '<');                   // and un-zooms
```

- `stagger: 0.07` — start each item 0.07s after the previous one.
- `clipPath: inset(0% 100% 0% 0%)` — reveal nothing (100% cut from the right); animating to
  `inset(0 0 0 0)` wipes it open left-to-right.
- `'-=0.45'` — start 0.45s *before* the previous tween ends (overlap).
- `'<'` — start at the same moment as the previous tween.

It only ever touches the card's **children**, never the card itself. That separation is
deliberate: the card's own opacity has exactly one owner (the timeline in A), and two
animations fighting over one property is precisely the bug I had.

### E · paw trail and pins (`trail()` 530, `pulseMarker()` 561)

When a chapter becomes active, `trail()` lays 7 paw glyphs along the straight line between the
old region and the new one, rotates them to face the direction of travel, and staggers them in
and out. `pulseMarker()` fires an expanding ring on the pin.

---

# Part 5 · The zoom maths, slowly

The only real arithmetic in the project. `shotFor()`, `scrollmap.js` 174.

Because `transform-origin: 0 0`, a point **p** inside the camera ends up on screen at:

```
screen position  =  camera's own position  +  translate  +  zoom × p
        i.e.              pos               +      t      +    k · p
```

We want a region's centre `c` to land on a target point `target`. So solve for `t`:

```js
var tx = area.cx - k * cx - L.x;      // one line of algebra, per axis
```

**How is the zoom `k` chosen?** "How big may this region appear?" — the smaller of the two fits:

```js
var k = clamp(Math.min(area.w / bw, area.h / bh) * step.zoom, 1.05, isMobile() ? 5 : 3.4);
```

**What is `area`?** The answer to "where is the card *not*" — `freeArea()`, line 156:

```js
function freeArea(side) {
  if (isMobile()) return { cx: vw*0.5, cy: vh*0.5, w: vw*0.82, h: vh*0.7 };
  return { cx: side === 'left' ? vw*0.72 : vw*0.30, cy: vh*0.52, w: vw*0.40, h: vh*0.60 };
}
```

Card on the right → aim at 30% across. Card on the left → aim at 72%. **That is the guarantee,
in four lines.**

Finally, clamp so the map can never slide far enough to show empty background:

```js
tx = clamp(tx, L.vw - L.x - k * L.w - padX, -L.x + padX);
```

with a small allowance (`padX` ≈ 8%) so regions at the very edge of the artwork — Indonesia at
the bottom, Kazakhstan at the top — still get close to their mark instead of being jammed into
a corner.

---

# Part 6 · Phones are a different shape, not a smaller one

```css
@media (max-width: 899px) {
  .tgr__stage  { height: 45vh; }      /* the map gets its own window at the top */
  .tgr__steps  { margin-top: -45vh; }
  .step__pin   { top: 45vh; height: 55vh; }   /* cards live in the 55vh below */
}
```

45 + 55 = 100. The map and the cards are **two separate boxes that add up to the screen**, so a
card physically cannot reach the map. The "text never covers the highlight" promise isn't
judgement on a phone — it's addition.

---

# Part 7 · Where to look when…

| You want to change | Open | Around |
|---|---|---|
| a colour | `scrollmap.css` | line 25, the `--` variables |
| how dark the map goes | `scrollmap.css` | `--dim`, line 36 |
| the spotlight's border | `scrollmap.css` | `.tgr__frame`, 105 |
| the card's look | `scrollmap.css` | `.card`, 308 |
| which side the card is on | `index.html` | `data-side` on the `.step` |
| the phone layout | `scrollmap.css` | the `max-width: 899px` block, 469 |
| how far the camera zooms | `scrollmap.js` | `shotFor()`, 174 |
| the guarantee about card vs map | `scrollmap.js` | `freeArea()`, 156 |
| when cards appear/disappear | `scrollmap.js` | `IN_FROM` / `OUT_FROM`, 356–357 |
| the headline reveal | `scrollmap.js` | the flourish timeline, 475 |
| the paw trail | `scrollmap.js` | `trail()`, 530 |

---

# Part 8 · Three sentences if you only remember three

1. **The map doesn't move — the camera does**, and the map is inside it.
2. **The spotlight is one element with a giant hard shadow**: the shadow is the dimming, the
   element is the hole, so they can never come apart.
3. **The card sits in one half and the camera aims at the other**, which is why the text can
   never cover the place it's describing.
