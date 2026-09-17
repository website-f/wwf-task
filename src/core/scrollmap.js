/* ===========================================================================
   WWF "Tiger Range Countries" — scroll-map engine
   ---------------------------------------------------------------------------
   THE webpart's engine. No CMS anywhere in this file — it is driven entirely
   by data- attributes, and can also render itself from a JSON blob that
   matches scrollmap.schema.json (see hydrate() below). Adapters for WordPress,
   Drupal, SharePoint and headless CMSs all feed it the same thing.

   Dependency: GSAP 3 + ScrollTrigger (vendored in ./vendor, ~115KB).
   Why a library rather than hand-rolled:
     · ScrollTrigger owns scrub, refresh, resize and direction handling.
       Hand-rolling interruptible scrubbed animation is ~250 lines of spring
       maths I then have to defend; this is ~40 lines of declaration.
     · Functional values + invalidateOnRefresh re-aim every flight after a
       resize or orientation change — the classic scrollytelling bug, solved
       by the library rather than by me.
     · gsap.matchMedia() scopes a whole behaviour to a media query and reverts
       it cleanly: desktop, mobile and reduced-motion are three declarations.
   There is no rAF loop and no scroll listener anywhere in this file.

   THE ONE RULE: the card is laid out in one half of the screen, and the camera
   always lands the highlighted region in the middle of the OTHER half — so the
   card can never cover the region you are reading about. See freeArea().
   ======================================================================== */

(function () {
  'use strict';

  if (!window.gsap || !window.ScrollTrigger) {
    console.warn('[scrollmap] GSAP/ScrollTrigger missing — static fallback left in place.');
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  var PAW_PATH =
    'M12 14.5c2.9 0 5.3 2 5.3 4.1 0 1.6-1.4 2.6-3.1 2.6-1 0-1.6-.3-2.2-.3s-1.2.3-2.2.3c-1.7 0-3.1-1-3.1-2.6 0-2.1 2.4-4.1 5.3-4.1zM6.6 8.6c1.2-.3 2.5.7 2.9 2.2.4 1.5-.3 3-1.5 3.3-1.2.3-2.5-.7-2.9-2.2-.4-1.5.3-3 1.5-3.3zm10.8 0c1.2.3 1.9 1.8 1.5 3.3-.4 1.5-1.7 2.5-2.9 2.2-1.2-.3-1.9-1.8-1.5-3.3.4-1.5 1.7-2.5 2.9-2.2zM10.4 3.4c1.2 0 2.2 1.3 2.2 2.9s-1 2.9-2.2 2.9S8.2 7.9 8.2 6.3s1-2.9 2.2-2.9zm3.2 0c1.2 0 2.2 1.3 2.2 2.9s-1 2.9-2.2 2.9-2.2-1.3-2.2-2.9 1-2.9 2.2-2.9z';

  /* ----------------------------------------------------------------------
     SELF-RENDERING, for CMSs that emit JSON rather than markup.

       <div data-tgr-json='{ …scrollmap.schema.json… }'></div>

       <script type="application/json" id="map1">{ … }</script>
       <div data-tgr-src="#map1"></div>

     Either form is turned into the real markup by scrollmap-render.js and then
     booted like any other instance. This is what lets a headless CMS, a SPA or
     a SharePoint web part use the webpart with no server-side templating: emit
     the JSON, include two scripts, done. A CMS that CAN template (WordPress,
     Drupal) renders server-side instead and never touches this path.
     -------------------------------------------------------------------- */
  function hydrate() {
    var slots = document.querySelectorAll('[data-tgr-json], [data-tgr-src]');
    if (!slots.length) return;
    if (!window.ScrollMapRender) {
      console.error('[scrollmap] data-tgr-json needs scrollmap-render.js loaded first.');
      return;
    }
    slots.forEach(function (slot) {
      if (slot.dataset.tgrHydrated) return;
      slot.dataset.tgrHydrated = '1';
      try {
        var raw = slot.dataset.tgrJson;
        if (!raw && slot.dataset.tgrSrc) {
          var src = document.querySelector(slot.dataset.tgrSrc);
          raw = src && src.textContent;
        }
        var content = typeof raw === 'string' ? JSON.parse(raw) : raw;
        var check = window.ScrollMapRender.validate(content);
        if (!check.ok) console.warn('[scrollmap] content problems:', check.errors);
        slot.outerHTML = window.ScrollMapRender(content);
      } catch (e) {
        console.error('[scrollmap] could not render from JSON:', e);
      }
    });
  }

  function boot() {
    hydrate();
    document.querySelectorAll('[data-tgr]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ====================================================================== */

  function init(root) {
    if (root.dataset.tgrReady) return;
    root.dataset.tgrReady = '1';

    var stage  = root.querySelector('.tgr__stage');
    var camera = root.querySelector('.tgr__camera');
    var map    = root.querySelector('.tgr__map');
    var frame  = root.querySelector('.tgr__frame');
    var chip   = root.querySelector('.tgr__chip');
    var chipT  = chip && chip.querySelector('.tgr__chip-t');
    var grade  = root.querySelector('.tgr__grade');
    var bar    = root.querySelector('.tgr__bar');
    var stepEls = gsap.utils.toArray(root.querySelectorAll('.step'));
    if (!stage || !camera || !map || !frame || !stepEls.length) return;

    /* ---- config from data attributes (the CMS writes these) ------------ */
    var focal = parsePair(root.dataset.focal, 0, 50);
    root.style.setProperty('--focal-x', focal.x + '%');
    root.style.setProperty('--focal-y', focal.y + '%');

    var showPaws    = root.dataset.paws    !== 'off';
    var showMarkers = root.dataset.markers !== 'off';
    var showRail    = root.dataset.rail    !== 'off';

    var steps = stepEls.map(function (el, i) {
      return {
        el: el,
        i: i,
        side: el.dataset.side === 'left' ? 'left' : 'right',
        label: el.dataset.label || '',
        zoom: clamp(parseFloat(el.dataset.zoom) || 1, 0.4, 2.5),
        spot: parseJSON(el.dataset.hotspot),
        card: el.querySelector('.card')
      };
    });

    buildFurniture(root, stage, camera, frame, steps,
      { markers: showMarkers, paws: showPaws, rail: showRail });

    var markers  = gsap.utils.toArray(root.querySelectorAll('.tgr__marker'));
    var markerIn = gsap.utils.toArray(root.querySelectorAll('.tgr__marker-in'));
    var paws     = gsap.utils.toArray(root.querySelectorAll('.tgr__paw'));
    var railBtns = gsap.utils.toArray(root.querySelectorAll('.tgr__rail button'));

    root.classList.add('is-ready');

    /* ==================================================================
       GEOMETRY — recomputed on every ScrollTrigger refresh (resize,
       orientation change, mobile URL-bar collapse). Tweens read it through
       functions, so `invalidateOnRefresh` picks up the new numbers.
       ================================================================== */
    var geo = null;
    var shots = [];

    function measure() {
      var vw = stage.clientWidth, vh = stage.clientHeight;
      var iw = map.naturalWidth || 2561, ih = map.naturalHeight || 1224;
      var s  = Math.max(vw / iw, vh / ih);          // object-fit: cover, by hand
      var w  = iw * s, h = ih * s;
      var x  = (vw - w) * (focal.x / 100);          // focal-anchored crop
      var y  = (vh - h) * (focal.y / 100);
      gsap.set(camera, { width: w, height: h, left: x, top: y });
      return { vw: vw, vh: vh, w: w, h: h, x: x, y: y };
    }

    /* THE ONE RULE — the on-screen box the highlight is aimed into. */
    function freeArea(side) {
      var vw = geo.vw, vh = geo.vh;
      if (isMobile()) {
        /* On phones the stage IS the clear band: a 42vh map window stuck to
           the top, with the cards flowing underneath it (see the max-width
           899px block in the stylesheet). geo.vh is that window's height, so
           aiming at its centre is all that's needed — the card physically
           cannot reach it. */
        return { cx: vw * 0.5, cy: vh * 0.5, w: vw * 0.82, h: vh * 0.7 };
      }
      return {
        cx: side === 'left' ? vw * 0.72 : vw * 0.30,   // the half the card is NOT in
        cy: vh * 0.52,
        w:  vw * 0.40,
        h:  vh * 0.60
      };
    }

    function shotFor(step) {
      /* No hotspot = the wide establishing shot. Still grade it lightly so
         cream text on bright artwork stays readable. */
      if (!step.spot || !geo) return { x: 0, y: 0, k: 1, rect: null, grade: 0.45 };

      var L = geo, sp = step.spot;
      var bw = sp.w / 100 * L.w, bh = sp.h / 100 * L.h;
      var cx = (sp.x + sp.w / 2) / 100 * L.w;
      var cy = (sp.y + sp.h / 2) / 100 * L.h;

      var area = freeArea(step.side);
      var k = clamp(Math.min(area.w / bw, area.h / bh) * step.zoom, 1.05, isMobile() ? 5 : 3.4);

      /* transform-origin is 0 0, so a layer point p renders at  pos + t + k·p.
         Solve t so the hotspot centre lands on the free area's centre …      */
      var tx = area.cx - k * cx - L.x;
      var ty = area.cy - k * cy - L.y;
      /* … then clamp, so the map never slides far enough to uncover a
         viewport edge. A small bleed is allowed (the stage behind is the same
         forest colour as the vignette) so that regions at the very edge of
         the artwork — Indonesia, Kazakhstan — still get close to the target
         instead of being pinned into a corner. */
      var padX = L.vw * 0.08, padY = L.vh * 0.09;
      tx = clamp(tx, L.vw - L.x - k * L.w - padX, -L.x + padX);
      ty = clamp(ty, L.vh - L.y - k * L.h - padY, -L.y + padY);

      return { x: tx, y: ty, k: k, grade: 1, rect: true };
    }

    var WIDE = { x: 0, y: 0, k: 1, rect: null, grade: 0.45 };
    function shotAt(i) { return shots[i] || WIDE; }

    function recompute() {
      geo = measure();
      shots = steps.map(shotFor);
      markers.forEach(function (m) {
        var sp = parseJSON(m.dataset.hotspot);
        if (sp) gsap.set(m, {
          left: (sp.x + sp.w / 2) / 100 * geo.w,
          top:  (sp.y + sp.h / 2) / 100 * geo.h
        });
      });
      projectFrame(steps[currentIndex]);
    }

    ScrollTrigger.addEventListener('refreshInit', recompute);

    /* ==================================================================
       FRAME PROJECTION
       The spotlight is NOT tweened separately. Every frame, we read the
       camera's live transform and project the active hotspot into screen
       space — so the bright window can never drift out of register with
       the map, whatever the scrub is doing.
       ================================================================== */
    function projectFrame(step) {
      if (!geo) return;
      if (!step || !step.spot) { gsap.set(frame, { autoAlpha: 0 }); return; }
      var k  = gsap.getProperty(camera, 'scale') || 1;
      var tx = gsap.getProperty(camera, 'x') || 0;
      var ty = gsap.getProperty(camera, 'y') || 0;
      var sp = step.spot;
      var w  = sp.w / 100 * geo.w * k;
      var h  = sp.h / 100 * geo.h * k;
      var cx = geo.x + tx + k * ((sp.x + sp.w / 2) / 100 * geo.w);
      var cy = geo.y + ty + k * ((sp.y + sp.h / 2) / 100 * geo.h);
      gsap.set(frame, { width: w, height: h, x: cx - w / 2, y: cy - h / 2 });
      if (chip) gsap.set(chip, { x: cx - w / 2, y: cy - h / 2, yPercent: -150 });
      return { cx: cx, cy: cy, w: w, h: h };
    }

    function syncCameraVars(step) {
      camera.style.setProperty('--inv', 1 / (gsap.getProperty(camera, 'scale') || 1));
      projectFrame(step);
    }

    /* ==================================================================
       MOTION
       ================================================================== */
    var currentIndex = 0;

    /* Measure once before any tween is built, so the functional values below
       always have real numbers to read. Re-measured on every refresh. */
    recompute();

    var mm = gsap.matchMedia();

    /* ---- reduced motion: states, no flights --------------------------- */
    mm.add('(prefers-reduced-motion: reduce)', function () {
      /* Same content, same one-card-at-a-time pairing — just no travel. */
      var cards = steps.map(function (st) { return st.card; }).filter(Boolean);
      gsap.set(cards, { clearProps: 'transform', autoAlpha: 0 });
      if (steps[0] && steps[0].card) gsap.set(steps[0].card, { autoAlpha: 1 });

      steps.forEach(function (step, i) {
        ScrollTrigger.create({
          trigger: step.el, start: 'top 60%', end: 'bottom 40%',
          onToggle: function (self) {
            if (!self.isActive) return;
            var s = shotAt(i);
            gsap.set(camera, { x: s.x, y: s.y, scale: s.k });
            gsap.set(grade, { opacity: s.grade || 0 });
            gsap.set(frame, { autoAlpha: step.spot ? 1 : 0 });
            if (chipT) chipT.textContent = step.label || '';
            gsap.set(chip,  { autoAlpha: step.label && step.spot ? 1 : 0 });
            gsap.set(cards, { autoAlpha: 0 });
            if (step.card) gsap.set(step.card, { autoAlpha: 1 });
            syncCameraVars(step);
            setActive(i);
          }
        });
      });
      gsap.set(markerIn, { autoAlpha: 1, y: 0 });
    });

    /* ---- full motion ---------------------------------------------------

       TWO RULES, and between them they fix the desync bug.

       RULE 1 — ONE OWNER PER PROPERTY.
       The first version had step N's timeline fade card N *in* and step N+1's
       timeline fade card N *out*. Two scrubbed timelines owning one property:
       whichever rendered last won, and a finished tween re-asserts its end
       value, so card N could sit at opacity 1 long after it should have gone.
       Now each card has exactly ONE timeline, which fades it in, holds it, and
       fades it out. Nothing else ever touches a card's opacity or x.

       RULE 2 — THE CARD IS PINNED, NOT SCROLLED.
       .step__pin is sticky, so a card holds still at a fixed spot on screen
       while its region is on the map. Cards cross-fade in place instead of
       sliding past each other, which is what made it ambiguous which card went
       with which highlight.

       The resulting order, guaranteed at every scroll position and in both
       directions:

           card N fades and slides out   →   the camera flies and zooms
                                         →   card N+1 slides in

       with a deliberate beat in the middle where no card is up and you are
       just watching the map travel. That beat is what makes the pairing read.
       ------------------------------------------------------------------ */
    mm.add('(prefers-reduced-motion: no-preference)', function () {

      /* progress bar: one scrubbed tween across the whole section */
      if (bar) {
        gsap.to(bar, {
          scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: true }
        });
      }

      /* How tall a step is, in viewport units — set in CSS (140vh desktop,
         135vh phones) and measured here against the VIEWPORT so the two can
         never drift apart. Everything below is derived from it. */
      var stepVh = 140;
      if (steps[0] && window.innerHeight) {
        var measured = steps[0].el.getBoundingClientRect().height / window.innerHeight * 100;
        if (measured > 105 && measured < 400) stepVh = measured;
      }

      /* The card is pinned by .step__pin, and on BOTH breakpoints the pin's
         top offset plus its height comes to 100vh (desktop 0 + 100, phones
         50 + 50). So a card is held still while its step's top travels from
         0 to -(stepVh - 100), and after that the pin is bottom-constrained by
         its step and starts sliding. HOLD is that window, and the card must be
         gone before it ends — otherwise the card slides up over the map, which
         is exactly what it used to do on phones. */
      var HOLD = stepVh - 100;

      /* A card timeline runs from "step top enters the screen" (top = 100%) to
         "step bottom reaches 8%". frac() turns a step-top position into a
         position on that timeline. */
      var span = 100 - (8 - stepVh);
      function frac(topPct) { return (100 - topPct) / span; }

      /* The choreography, written once, in step-top percentages. Reading the
         NEXT step's top as T, the whole hand-over is:
              T 134 → 103   the outgoing card slides out   (its own timeline)
              T  92 →  25   the camera flies and zooms
              T  22 →   6   the incoming card slides in
         Three windows, no overlap, so the order holds at every scroll
         position and in both directions. */
      var IN_FROM = 22, IN_TO = 6;
      var OUT_FROM = -HOLD * 0.15, OUT_TO = -HOLD * 0.92;

      steps.forEach(function (step, i) {

        /* ---------- A. the card: in, hold, out — ONE owner --------------- */
        if (step.card) {
          var last = i === steps.length - 1;
          var ctl = gsap.timeline({
            scrollTrigger: {
              trigger: step.el,
              start: 'top 100%',
              end: 'bottom 8%',
              scrub: 0.5,
              invalidateOnRefresh: true
            }
          });

          ctl.to({}, { duration: 1 }, 0);

          ctl.fromTo(step.card,
            { autoAlpha: 0, x: function () { return slideIn(step); } },
            { autoAlpha: 1, x: 0, ease: 'power3.out', immediateRender: false,
              duration: frac(IN_TO) - frac(IN_FROM) },
            frac(IN_FROM));

          if (!last) {
            ctl.to(step.card,
              { autoAlpha: 0, x: function () { return slideOut(step); }, ease: 'power2.in',
                duration: frac(OUT_TO) - frac(OUT_FROM) },
              frac(OUT_FROM));
          }
        }

        /* ---------- B. the camera flight -------------------------------- */
        if (i === 0) return;
        var prev = steps[i - 1];

        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: step.el,
            start: 'top 92%',      /* the outgoing card has already gone */
            end: 'top 25%',        /* lands before the incoming card arrives */
            scrub: 0.6,
            invalidateOnRefresh: true
          }
        });

        tl.fromTo(camera,
          {
            x:     function () { return shotAt(i - 1).x; },
            y:     function () { return shotAt(i - 1).y; },
            scale: function () { return shotAt(i - 1).k; }
          },
          {
            x:     function () { return shotAt(i).x; },
            y:     function () { return shotAt(i).y; },
            scale: function () { return shotAt(i).k; },
            duration: 1, ease: 'power2.inOut', immediateRender: false,
           
            onUpdate: function () {
              var ref = this.progress() >= 0.5 ? step : prev;
              if (!ref.spot) ref = step.spot ? step : prev;
              syncCameraVars(ref);
              if (chipT) chipT.textContent = ref.label || '';
            }
          }, 0);

        tl.fromTo([frame, chip].filter(Boolean),
          { autoAlpha: prev.spot ? 1 : 0 },
          { autoAlpha: step.spot ? 1 : 0, duration: 0.3, ease: 'none', immediateRender: false },
          step.spot ? 0.62 : 0.06);

        if (grade) {
          tl.fromTo(grade,
            { opacity: function () { return shotAt(i - 1).grade; } },
            { opacity: function () { return shotAt(i).grade; }, duration: 0.6,
              ease: 'none', immediateRender: false },
            0.1);
        }
      });

     
      gsap.set(steps.map(function (st) { return st.card; }).filter(Boolean), { autoAlpha: 0 });
      gsap.set([frame, chip].filter(Boolean), { autoAlpha: 0 });
      if (grade) gsap.set(grade, { opacity: shotAt(0).grade });

      steps.forEach(function (step) {
        if (!step.card) return;
        var words   = step.card.querySelectorAll('.w > span');
        var lines   = step.card.querySelectorAll('.card__meta, .card__status, .eyebrow, .lede, p, figcaption');
        var shotBox = step.card.querySelector('.card__shot');
        var shotImg = step.card.querySelector('.card__shot img');

        var ftl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          scrollTrigger: {
            trigger: step.el,
            start: 'top 22%',
            toggleActions: 'play none none reverse'
          }
        });
        if (words.length) ftl.from(words, { yPercent: 115, duration: 0.7, stagger: 0.07, ease: 'power4.out' });
        if (lines.length) ftl.from(lines, { y: 16, autoAlpha: 0, duration: 0.45, stagger: 0.05 }, '-=0.45');
        if (shotBox) {
          ftl.fromTo(shotBox, { clipPath: 'inset(0% 100% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'power3.inOut' }, '-=0.35');
          if (shotImg) ftl.from(shotImg, { scale: 1.18, duration: 1.5, ease: 'power2.out' }, '<');
        }
      });

      /* ---- chapter state: rail, paw trail, pin pulse --------------------
         Fires mid-flight, while the map is travelling and no card is up, so
         the paw trail reads as the journey between the two regions. */
      steps.forEach(function (step, i) {
        ScrollTrigger.create({
          trigger: step.el, start: 'top 84%', end: 'bottom 30%',
          onToggle: function (self) {
            if (!self.isActive) return;
            var from = currentIndex;
            setActive(i);
            if (showPaws && paws.length && i !== from) trail(from, i);
            pulseMarker(i);
          }
        });
      });

      /* markers drop in when their region is first approached */
      markers.forEach(function (m) {
        gsap.fromTo(m.firstChild, { autoAlpha: 0, y: -26 },
          {
            autoAlpha: 1, y: 0, duration: 0.7, ease: 'back.out(2.2)',
            scrollTrigger: {
              trigger: steps[+m.dataset.step].el,
              start: 'top 80%',
              toggleActions: 'play none none reverse'
            }
          });
      });
    });

    /* How far a card travels as it hands over. On phones the cards read as a
       carousel — in from the right, out to the left. On desktop each card
       enters and leaves through its own outer edge, which reinforces which
       half of the screen it belongs to. */
    function slideIn(step)  { return isMobile() ? 70 : (step.side === 'left' ? -72 : 72); }
    function slideOut(step) { return isMobile() ? -70 : (step.side === 'left' ? -72 : 72); }

    /* ---- paw trail between two steps, in screen space ------------------ */
    function trail(fromIdx, toIdx) {
      var a = centreOf(fromIdx), b = centreOf(toIdx);
      if (!a || !b) { gsap.set(paws, { autoAlpha: 0 }); return; }
      var ang = Math.atan2(b.y - a.y, b.x - a.x);
      var nx = -Math.sin(ang), ny = Math.cos(ang);
      paws.forEach(function (p, j) {
        var t = (j + 1) / (paws.length + 1);
        var off = (j % 2 ? 12 : -12);
        gsap.set(p, {
          x: a.x + (b.x - a.x) * t + nx * off,
          y: a.y + (b.y - a.y) * t + ny * off,
          rotation: ang * 180 / Math.PI + 90,
          transformOrigin: '50% 50%'
        });
      });
      gsap.timeline()
        .fromTo(paws, { autoAlpha: 0, scale: 0.4 },
          { autoAlpha: 0.8, scale: 1, duration: 0.3, stagger: 0.055, ease: 'back.out(2)' })
        .to(paws, { autoAlpha: 0, duration: 0.45, stagger: 0.05 }, '+=0.3');
    }

    /* screen-space centre of a step's region, using its resting camera shot */
    function centreOf(i) {
      var st = steps[i], s = shotAt(i);
      if (!st || !st.spot || !s || !geo) return { x: geo ? geo.vw / 2 : 0, y: geo ? geo.vh / 2 : 0 };
      return {
        x: geo.x + s.x + s.k * ((st.spot.x + st.spot.w / 2) / 100 * geo.w),
        y: geo.y + s.y + s.k * ((st.spot.y + st.spot.h / 2) / 100 * geo.h)
      };
    }

    function pulseMarker(i) {
      var ring = root.querySelector('.tgr__marker[data-step="' + i + '"] .tgr__marker-ring');
      if (!ring) return;
      gsap.fromTo(ring, { autoAlpha: 0.9, scale: 1 },
        { autoAlpha: 0, scale: 3.6, duration: 1.2, ease: 'power2.out', repeat: 1 });
    }

    function setActive(i) {
      currentIndex = i;
      railBtns.forEach(function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
      /* The badge text is owned by the camera flight (see its onUpdate), so
         that it can never name a region the spotlight is not on. Only set it
         here when nothing is flying — first paint and reduced motion. */
      if (chipT && !chipT.textContent) chipT.textContent = steps[i].label || '';
    }

    railBtns.forEach(function (b, i) {
      b.addEventListener('click', function () {
        var top = steps[i].el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.2;
        window.scrollTo({
          top: top,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
      });
    });

    function isMobile() { return window.matchMedia('(max-width: 899px)').matches; }

    /* The map's intrinsic size may arrive after init; a refresh re-measures
       and re-invalidates every flight. */
    if (!(map.complete && map.naturalWidth)) {
      map.addEventListener('load', function () { ScrollTrigger.refresh(); });
    }
  }

  /* ======================================================================
     DOM the engine owns — markers, paws, rail, frame corners. Kept out of
     the template so the CMS only ever emits content.
     ==================================================================== */
  function buildFurniture(root, stage, camera, frame, steps, opts) {
    ['tl', 'tr', 'bl', 'br'].forEach(function (c) {
      var d = document.createElement('i');
      d.className = 'tgr__corner tgr__corner--' + c;
      frame.appendChild(d);
    });

    if (opts.markers) {
      steps.forEach(function (s, i) {
        if (!s.spot) return;
        var m = document.createElement('div');
        m.className = 'tgr__marker';
        m.dataset.step = i;
        m.dataset.hotspot = JSON.stringify(s.spot);
        /* The outer .tgr__marker keeps a CSS transform (centring + the
           1/scale counter-scale). GSAP animates the INNER element, so its
           transform writes can never clobber that. */
        m.innerHTML = '<div class="tgr__marker-in">' +
                      '<div class="tgr__marker-ring"></div>' +
                      '<div class="tgr__marker-dot"><span>' + i + '</span></div>' +
                      '</div>';
        camera.appendChild(m);
      });
    }

    if (opts.paws) {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'tgr__paws');
      svg.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 7; i++) {
        var g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'tgr__paw');
        var path = document.createElementNS(ns, 'path');
        path.setAttribute('d', PAW_PATH);
        path.setAttribute('transform', 'translate(-12,-12) scale(1.2)');
        g.appendChild(path);
        svg.appendChild(g);
      }
      stage.appendChild(svg);
    }

    if (opts.rail) {
      var nav = document.createElement('nav');
      nav.className = 'tgr__rail';
      nav.setAttribute('aria-label', 'Chapters');
      steps.forEach(function (s, i) {
        var h = s.card && s.card.querySelector('.h2, h2');
        var name = s.label || (h ? h.textContent.trim() : 'Step ' + (i + 1));
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-current', i === 0 ? 'true' : 'false');
        b.innerHTML = '<span class="t"></span><span class="d"></span>';
        b.querySelector('.t').textContent = name;
        nav.appendChild(b);
      });
      stage.appendChild(nav);
    }
  }

  /* ---- helpers --------------------------------------------------------- */
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function parseJSON(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function parsePair(s, dx, dy) {
    var p = String(s || '').trim().split(/[\s,]+/);
    var x = parseFloat(p[0]), y = parseFloat(p[1]);
    return { x: isNaN(x) ? dx : clamp(x, 0, 100), y: isNaN(y) ? dy : clamp(y, 0, 100) };
  }
})();
