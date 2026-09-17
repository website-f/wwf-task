# Task 1 explained for a beginner

This is an interview-friendly walkthrough of the WWF “Tiger Range Countries”
scroll-map webpart. It explains what the user sees, which file controls each
part, and how the scrolling animation is built.

## 1. The three files to know

| Layer | File | Responsibility |
| --- | --- | --- |
| Content and structure | [src/standalone/index.html](../src/standalone/index.html) | Map image, cards, text, hotspots and settings |
| Visual design | [src/core/scrollmap.css](../src/core/scrollmap.css) | Layout, colours, typography, responsive behaviour and fallback styles |
| Behaviour and animation | [src/core/scrollmap.js](../src/core/scrollmap.js) | Reads the HTML data, calculates camera positions and connects scroll to GSAP |

The standalone page is a demo shell. The same core files are reused by the
WordPress version.

## 2. The simple idea

Imagine a camera filming a large map.

* The map is the artwork.
* The camera can move left, right, up, down and zoom in.
* A text card explains the animal or country.
* The scrollbar acts like the camera operator's control.

The map image itself is not swapped for every chapter. It stays inside
.tgr__camera. JavaScript moves and scales that camera, which makes the map
appear to travel.

The main design rule is:

> The card is placed on one side of the screen and the camera aims at the clear
> side. The card cannot cover the region being explained.

## 3. How the demo is loaded

Open [src/standalone/index.html](../src/standalone/index.html). Its scripts are
loaded near the bottom:

~~~html
<script src="../core/vendor/gsap.min.js"></script>
<script src="../core/vendor/ScrollTrigger.min.js"></script>
<script src="../core/scrollmap.js"></script>
~~~

The order matters:

1. GSAP is loaded first.
2. ScrollTrigger is loaded second because it is a GSAP plugin.
3. scrollmap.js is loaded last so it can use both libraries.

The shared stylesheet is loaded in the head:

~~~html
<link rel="stylesheet" href="../core/scrollmap.css">
~~~

The vendor files are local, so the demo can run without downloading the
animation libraries from a CDN.

## 4. Read the HTML from the outside in

The important structure is:

~~~html
<section class="tgr" data-tgr data-focal="0 50"
         data-paws="on" data-markers="on" data-rail="on">
  <div class="tgr__stage">
    <div class="tgr__camera">
      <img class="tgr__map" src="assets/map.jpg" alt="...">
    </div>
    <div class="tgr__grade"></div>
    <div class="tgr__frame"></div>
    <div class="tgr__chip"><span class="tgr__chip-t"></span></div>
    <div class="tgr__bar"></div>
  </div>
  <div class="tgr__steps">
    <article class="step" data-side="right"
             data-label="India &amp; Nepal"
             data-hotspot='{"x":48.5,"y":43,"w":17.1,"h":39.3}'>
      <div class="step__pin">
        <div class="card">...</div>
      </div>
    </article>
  </div>
</section>
~~~

### The component section

class="tgr" is the CSS hook. data-tgr is the JavaScript hook:

~~~js
document.querySelectorAll('[data-tgr]').forEach(init);
~~~

Keeping the hooks separate lets a designer change styling classes without
accidentally changing the JavaScript selector.

The settings mean:

| Attribute | Meaning |
| --- | --- |
| data-focal="0 50" | Keep the image crop focused at 0% horizontally and 50% vertically |
| data-paws="on" | Create the animated paw trail |
| data-markers="on" | Create numbered map pins |
| data-rail="on" | Create the chapter navigation rail |

The CSS uses BEM-style names. .tgr is the block, .tgr__stage is an element
inside the block, and a modifier such as .step[data-side="left"] changes a
variation.

### The stage

src/core/scrollmap.css makes the stage the visible map window:

~~~css
.tgr__stage {
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow: hidden;
}
~~~

position: sticky lets the stage stay attached to the top of the screen while
the cards pass through it. 100dvh means the dynamic viewport height.
overflow: hidden clips a zoomed map to the window.

### The camera and map

~~~css
.tgr__camera {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  will-change: transform;
}
~~~

The camera is the element GSAP moves. inset: 0 initially fills the stage.
transform-origin: 0 0 makes scaling start from the top-left corner, which
keeps the camera maths predictable. will-change hints that this element will
animate.

~~~css
.tgr__map {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: var(--focal-x, 0%) var(--focal-y, 50%);
}
~~~

object-fit: cover fills the stage and crops excess edges. The focal point
controls which part of the wide artwork survives that crop.

### The colour grade

.tgr__grade is a transparent layer containing radial and linear gradients. It
darkens the edges and helps cream text stay readable over bright artwork. It
has pointer-events: none, so it cannot block clicks. JavaScript changes its
opacity between wide shots and close-ups.

### The spotlight

.tgr__frame is the spotlight window. Its important CSS is:

~~~css
box-shadow: 0 0 0 200vmax rgba(2, 12, 7, var(--dim));
~~~

The huge hard shadow darkens almost the entire screen. The frame itself is the
bright hole. Because the dimming and the hole belong to one element, they
cannot drift apart. JavaScript changes the frame's pixel width, height, x and
y.

The four corner ticks are generated in buildFurniture() instead of being
repeated in the HTML. They are decoration, not content.

### The chip and progress bar

.tgr__chip is the location pill, such as “India & Nepal”. JavaScript writes the
name into .tgr__chip-t and places it above the spotlight.

.tgr__bar starts at transform: scaleX(0). GSAP changes it to scaleX(1) across
the full section, creating a reading-progress bar.

## 5. Chapters, cards and hotspots

Each chapter is an article.step. The order of the articles is the scroll order:

~~~html
<article class="step" data-side="right"
         data-label="India &amp; Nepal"
         data-zoom="1"
         data-hotspot='{"x":48.5,"y":43,"w":17.1,"h":39.3}'>
~~~

| Attribute | Beginner explanation |
| --- | --- |
| data-side | Which half contains the card: left or right |
| data-label | Location name used by the chip and chapter rail |
| data-zoom | Optional multiplier for camera closeness |
| data-hotspot | JSON rectangle describing a region inside the map image |

The hotspot uses percentages rather than pixels:

~~~json
{"x":48.5,"y":43,"w":17.1,"h":39.3}
~~~

This means “start 48.5% from the left and 43% from the top; the region is
17.1% wide and 39.3% high.” Percentage coordinates continue to work when the
image is displayed at a different size.

### The pinned card

The card is inside .step__pin. On desktop the pin uses a 12-column grid:

~~~css
.step .card                   { grid-column: 8 / span 5; }
.step[data-side="left"] .card { grid-column: 1 / span 5; }
~~~

The card therefore occupies the right or left half. The JavaScript aims the
map at the opposite half.

Each desktop step is 140vh tall. The card stays in place while the user reads,
then the extra height provides room for the hand-over to the next chapter. The
negative margin on .tgr__steps pulls the cards over the sticky map stage.

### The card surface

~~~css
.card {
  background: var(--card-bg);
  backdrop-filter: blur(14px) saturate(1.1);
  display: flex;
  flex-direction: column;
  max-height: 86vh;
  overflow: hidden;
}
~~~

This gives a dark frosted-glass panel. The flex layout lets the photo shrink
before the text is clipped if an editor adds more copy.

Important child classes:

| Markup | Purpose |
| --- | --- |
| .card__meta | Number and region |
| .card__num | Circular chapter number |
| .h2 or h2 | Large WWF display heading |
| .card__status | Conservation-status pill |
| .card__shot | Cropped photo area |
| figcaption | Photo credit |

The status colour is chosen from data-level:

~~~css
.card__status[data-level="endangered"] { ... }
.card__status[data-level="vulnerable"] { ... }
.card__status[data-level="least"]      { ... }
~~~

### Why headings use two spans

~~~html
<span class="w"><span>Sambar</span></span>
~~~

The outer .w is a clipped window. The inner span is the word that moves. GSAP
starts the inner span below the window and moves it upward, creating the word
rise effect without revealing anything outside the line.

### Intro and closing chapters

.step--wide gives the opening and closing cards a wider grid area and larger
type. They do not have hotspots, so they are establishing or summary shots.

## 6. What scrollmap.js does on startup

The main file is [src/core/scrollmap.js](../src/core/scrollmap.js).

### Check libraries and boot

The top of the file checks for GSAP and ScrollTrigger. If either is missing, it
logs a warning and leaves the static HTML in place. Otherwise it registers the
ScrollTrigger plugin.

boot() finds every [data-tgr] component and calls init(). The data-tgr-ready
flag prevents a component from being initialized twice.

### Read the HTML into data

Inside init(), the code stores references to the stage, camera, map, frame,
chip, progress bar and cards. Each step becomes a JavaScript object similar to:

~~~js
{
  el: stepElement,
  side: 'left',
  label: 'India & Nepal',
  zoom: 1,
  spot: { x: 48.5, y: 43, w: 17.1, h: 39.3 },
  card: cardElement
}
~~~

This is easier to animate than repeatedly reading raw attributes.

### Generate furniture

buildFurniture() creates the repeated pieces derived from the content:

* four spotlight corner ticks;
* numbered markers for steps with hotspots;
* seven SVG paw shapes;
* chapter rail buttons.

Keeping generated decoration out of the template means each CMS adapter only
needs to provide real content.

## 7. How the camera maths works

This is the most technical part, but it follows a clear sequence.

### Measure the image

measure() reads the stage size and the map's natural size. It calculates the
size and crop of an object-fit: cover image and stores the result in geo:
viewport width/height, rendered image width/height and crop offsets.

### Find the clear area

freeArea(side) decides where the hotspot should land:

* card on the right: aim around 30% across the screen;
* card on the left: aim around 72% across the screen;
* phone: aim at the centre of the separate map window.

This is the JavaScript half of the “card and highlight use opposite areas” rule.

### Calculate a shot

shotFor(step) converts the percentage hotspot into a camera translation and
zoom. It chooses the smaller scale that fits the hotspot into the clear area,
applies the chapter's zoom preference, then limits the result with clamp().

With transform-origin: 0 0, the basic relationship is:

~~~text
screen position = image crop position + camera translation + zoom * point
~~~

The code solves for the translation needed to put the hotspot centre at the
target centre. It then clamps x and y so the camera cannot reveal empty space
outside the artwork.

### Recalculate after resize

recompute() runs during ScrollTrigger's refreshInit event. It measures again,
recalculates every shot and repositions the markers.

Camera values are written as functions, for example:

~~~js
x: function () { return shotAt(i).x; }
~~~

With invalidateOnRefresh: true, GSAP asks for these values again after a resize,
orientation change or mobile browser-toolbar change. This avoids hard-coded
desktop pixel positions.

## 8. How the spotlight stays aligned

projectFrame(step) reads the camera's live x, y and scale. It converts the
active hotspot rectangle into screen pixels and sets the frame there.

The spotlight is therefore derived from the camera's current transform. It is
not an independent animation that can drift during a partial scroll.

syncCameraVars() also updates --inv, the inverse of the camera scale. Markers
use it to counter-scale themselves, so they remain close to the same size on
screen while the map zooms.

## 9. What happens during one scroll transition

The full-motion branch is the prefers-reduced-motion: no-preference block in
scrollmap.js.

~~~text
1. The old card fades and slides away.
2. There is a short beat with no card.
3. The camera travels and zooms to the next hotspot.
4. The spotlight and location label update.
5. The new card slides in.
6. The new card holds while the user reads.
~~~

### Card timeline

Each card has one GSAP timeline that owns its visibility and horizontal
position. One property should have one animation owner. Otherwise two scrubbed
timelines could both write opacity and leave a card visible at the wrong time.

The card timeline uses:

* autoAlpha: opacity plus visibility;
* x: horizontal movement;
* scrub: scroll controls the playhead;
* invalidateOnRefresh: values are recalculated after resize.

The empty one-second tween at the start is deliberate. It makes the total
timeline duration exactly one unit, so the calculated fractions match the
intended scroll windows.

### Camera timeline

The camera timeline animates x, y and scale from the previous shot to the new
shot. Its onUpdate callback keeps the frame, chip and inverse scale in sync
with the live camera.

power2.inOut makes the camera start gently, move through the middle and slow
down at the destination.

### What “scrub” means

Normally an animation plays once after a trigger. With scrub, the animation
playhead follows scroll position. Scroll down and it moves forward; scroll up
and it reverses. A value such as scrub: 0.6 gives the playhead a small
catch-up time, making the movement feel less abrupt.

### Card entrance flourish

The card children have a separate enter timeline. It does not control the
card's main opacity or x position, which prevents animation conflicts.

The flourish:

1. raises heading words behind their masks;
2. fades paragraphs and metadata upward;
3. wipes the photo in with clipPath: inset(...);
4. eases the photo from a slightly enlarged scale to normal.

Useful GSAP position syntax:

* stagger: 0.07 starts each item slightly after the previous item;
* -=0.45 overlaps a tween with the previous tween;
* < starts at the same time as the previous tween.

### Markers, paws and active chapter

When a step becomes active, setActive() updates aria-current on the chapter
rail. trail() places seven paws along the path between two hotspot centres.
pulseMarker() enlarges and fades the active marker ring.

Clicking a rail button calculates the selected step's document position and
calls window.scrollTo(). It reaches the same state as manual scrolling.

## 10. Reduced motion and fallback behaviour

gsap.matchMedia() selects the animation branch.

### Reduced motion

For users who prefer reduced motion, the content remains the same but camera
flights are removed. ScrollTrigger detects the active step and immediately sets
the correct camera, spotlight, label and card.

This keeps the information and pairing while avoiding large moving animations.

### No JavaScript

Before JavaScript adds .is-ready, CSS hides generated decorations and removes
the sticky layout. Cards become normal readable content. If scripts fail, the
page still has a basic reading order.

## 11. Responsive behaviour

Desktop uses a two-sided 12-column grid. Below 899px, the layout changes
instead of merely shrinking:

* the map stage is about 45dvh high;
* the card area uses the remaining 55dvh;
* the card uses one column and behaves like a bottom sheet;
* cards slide in from the right and out to the left;
* the desktop chapter rail is hidden;
* padding, type and image dimensions are reduced;
* on very short screens, captions and then photos may be hidden so the text
  remains readable.

The map and card areas are separate boxes on mobile, so the card cannot cover
the map window.

## 12. Where to make changes

### Styling: src/core/scrollmap.css

| Desired change | Location |
| --- | --- |
| Main colours | .tgr variables near the top |
| Darkening strength | --dim and .tgr__grade |
| Map crop | --focal-x, --focal-y and .tgr__map |
| Spotlight border | .tgr__frame |
| Marker appearance | .tgr__marker, .tgr__marker-dot, .tgr__marker-ring |
| Card position | .step .card and .step[data-side="left"] .card |
| Card surface | .card |
| Heading type | .card h2, .card .h2, .step--wide .title |
| Status colours | .card__status[data-level="..."] |
| Phone layout | @media (max-width: 899px) |
| Static fallback | .tgr:not(.is-ready) near the end |

CSS variables make theming easy. Changing --accent changes the green used by
headings, markers, borders and the progress bar for that component.

### Content: src/standalone/index.html

| Desired change | Location |
| --- | --- |
| Change chapter text | The relevant .card |
| Move a card left/right | The step's data-side |
| Change the location label | The step's data-label |
| Move the highlighted region | The step's data-hotspot |
| Change zoom preference | The step's data-zoom |
| Change the map | .tgr__map src and dimensions |

### Behaviour: src/core/scrollmap.js

| Desired change | Function or section |
| --- | --- |
| Read component settings | init() |
| Calculate image geometry | measure() |
| Choose the clear half | freeArea() |
| Calculate camera shots | shotFor() |
| Keep spotlight aligned | projectFrame() |
| Card/camera hand-over | Full-motion mm.add() block |
| Card entrance effects | Flourish timeline |
| Card movement direction | slideIn() and slideOut() |
| Paw trail | trail() |
| Marker pulse | pulseMarker() |
| Generated UI | buildFurniture() |

## 13. A short interview walkthrough

You can explain the project in this order:

1. “The standalone HTML provides content. The shared CSS provides layout. The
   JavaScript turns scroll position into camera and card animation.”
2. “The map stays inside a sticky stage. The camera element is translated and
   scaled, so the map appears to fly between percentage-based hotspots.”
3. “Each card is placed on one side of a 12-column grid. freeArea() aims the
   hotspot at the opposite side.”
4. “The spotlight is positioned from the camera's live transform, so it cannot
   drift out of alignment.”
5. “ScrollTrigger scrubs GSAP timelines, so scrolling backward reverses the
   animation naturally.”
6. “The code recalculates geometry on refresh, supports mobile, handles reduced
   motion and leaves a readable no-JavaScript fallback.”

## 14. Three things to remember

* The map does not move by itself; the camera around it moves.
* The spotlight is calculated from the camera's current transform.
* Card placement and camera targeting deliberately use opposite halves of the
  screen.
