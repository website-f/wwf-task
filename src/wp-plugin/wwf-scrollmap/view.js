/**
 * wwf/scrollmap — front-end scroll engine v2 (same engine as the standalone
 * Task 1 build). Enqueued once per page by block.json viewScript; boots every
 * block instance independently.
 *
 * Modes per instance (data-mode attribute, set from the block's "Animation
 * style" control; ?mode= query param overrides for live comparison):
 *   cinematic — spring-driven camera (desktop push-in + mobile fly-to),
 *               spring-driven spotlight, arrival pulse, progress rail.
 *   faithful  — the original Shorthand behaviour: CSS 0.8s spotlight travel,
 *               no desktop zoom.
 *
 * Spring: v += (target − v)·(1 − e^(−rate·dt)) — frame-rate independent,
 * interruptible (new targets bend the curve, nothing restarts), and the rAF
 * loop suspends itself when settled. A watchdog snaps to target if rAF is
 * starved (hidden/prerendered pages).
 */
(function () {
	'use strict';
	document.documentElement.classList.add('js');

	var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
	var MOBILE  = window.matchMedia('(max-width: 899px)');
	var URL_MODE = null;
	try { URL_MODE = new URLSearchParams(location.search).get('mode'); } catch (e) {}

	function boot() {
		document.querySelectorAll('[data-scrollmap]').forEach(initScrollmap);
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}

	function initScrollmap(root) {
		if (root.dataset.scrollmapReady) return;
		root.dataset.scrollmapReady = '1';

		var viewport = root.querySelector('.scrollmap__viewport');
		var stage    = root.querySelector('.scrollmap__stage');
		var mapImg   = root.querySelector('.scrollmap__map');
		var frame    = root.querySelector('.scrollmap__frame');
		var points   = Array.prototype.slice.call(root.querySelectorAll('.scrollmap__point'));
		if (!viewport || !stage || !mapImg || !frame || !points.length) return;

		var mode = URL_MODE || root.dataset.mode || 'cinematic';
		var cinematic = mode !== 'faithful' && !REDUCED.matches;
		root.classList.toggle('scrollmap--cinematic', cinematic);

		var layout = null;
		var active = -1;

		/* ---- geometry: stage = the map's object-fit:cover box ------------- */
		function layoutStage() {
			var vw = viewport.clientWidth, vh = viewport.clientHeight;
			var iw = mapImg.naturalWidth  || 1920;
			var ih = mapImg.naturalHeight || 1080;
			var s  = Math.max(vw / iw, vh / ih);
			var w  = iw * s, h = ih * s;
			var x  = (vw - w) / 2, y = (vh - h) / 2;
			layout = { vw: vw, vh: vh, w: w, h: h, x: x, y: y };
			stage.style.width  = w + 'px';
			stage.style.height = h + 'px';
			stage.style.left   = x + 'px';
			stage.style.top    = y + 'px';
			retarget();
		}

		function hotspotOf(point) {
			if (!point || !point.dataset.hotspot) return null;
			try { return JSON.parse(point.dataset.hotspot); } catch (e) { return null; }
		}
		function alignOf(point) { return (point && point.dataset.align) || 'center'; }

		/* ---- camera target ------------------------------------------------ */
		function cameraFor(spot, align) {
			if (!layout || !spot) return { x: 0, y: 0, k: 1 };
			var L = layout;
			var bw = spot.w / 100 * L.w, bh = spot.h / 100 * L.h;
			var cx = (spot.x + spot.w / 2) / 100 * L.w;
			var cy = (spot.y + spot.h / 2) / 100 * L.h;
			var k, fx, fy;
			if (MOBILE.matches) {
				k  = Math.min(0.9 * L.vw / bw, 0.55 * L.vh / bh);
				k  = Math.max(1, Math.min(k, 2.6));
				fx = L.vw * 0.5;
				fy = L.vh * 0.38;
			} else {
				k  = Math.min(0.55 * L.vw / bw, 0.6 * L.vh / bh);
				k  = Math.max(1.06, Math.min(k, 1.45));
				fx = L.vw * (align === 'right' ? 0.36 : align === 'left' ? 0.64 : 0.5);
				fy = L.vh * 0.5;
			}
			var tx = fx - k * cx - L.x;
			var ty = fy - k * cy - L.y;
			tx = Math.min(Math.max(tx, L.vw - L.x - k * L.w), -L.x);
			ty = Math.min(Math.max(ty, L.vh - L.y - k * L.h), -L.y);
			return { x: tx, y: ty, k: k };
		}

		/* ---- spring system (cinematic) ------------------------------------ */
		var cur = { cx: 0, cy: 0, ck: 1, fx: 40, fy: 40, fw: 20, fh: 20, fo: 0 };
		var tgt = { cx: 0, cy: 0, ck: 1, fx: 40, fy: 40, fw: 20, fh: 20, fo: 0 };
		var RATE = { c: 3.4, f: 5.2, o: 6 };
		var rafId = 0, lastT = 0, stepCount = 0, watchdog = 0;

		function springStart() {
			if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(springStep); }
			clearTimeout(watchdog);
			var seen = stepCount;
			watchdog = setTimeout(function () {
				if (stepCount === seen) {
					for (var k in tgt) cur[k] = tgt[k];
					render();
				}
			}, 250);
		}
		function springStep(now) {
			stepCount++;
			var dt = (now - lastT) / 1000;
			lastT = now;
			if (!(dt > 0)) dt = 1 / 60;
			dt = Math.min(dt, 0.05);
			var settled = true;
			for (var key in tgt) {
				var rate = key === 'fo' ? RATE.o : key[0] === 'c' ? RATE.c : RATE.f;
				var next = cur[key] + (tgt[key] - cur[key]) * (1 - Math.exp(-rate * dt));
				if (Math.abs(tgt[key] - next) > (key === 'ck' || key === 'fo' ? 0.001 : 0.05)) settled = false;
				else next = tgt[key];
				cur[key] = next;
			}
			render();
			rafId = settled ? 0 : requestAnimationFrame(springStep);
		}
		function render() {
			stage.style.transform = (cur.ck === 1 && cur.cx === 0 && cur.cy === 0)
				? '' : 'translate(' + cur.cx + 'px,' + cur.cy + 'px) scale(' + cur.ck + ')';
			frame.style.left    = cur.fx + '%';
			frame.style.top     = cur.fy + '%';
			frame.style.width   = cur.fw + '%';
			frame.style.height  = cur.fh + '%';
			frame.style.opacity = cur.fo;
		}
		function pulse() {
			frame.classList.remove('is-arrive');
			void frame.offsetWidth;
			frame.classList.add('is-arrive');
		}
		function setCinematicTargets(spot, align) {
			var cam = cameraFor(spot, align);
			tgt.cx = cam.x; tgt.cy = cam.y; tgt.ck = cam.k;
			if (spot) {
				if (cur.fo < 0.02) {
					cur.fx = spot.x; cur.fy = spot.y; cur.fw = spot.w; cur.fh = spot.h;
				}
				tgt.fx = spot.x; tgt.fy = spot.y; tgt.fw = spot.w; tgt.fh = spot.h;
				tgt.fo = 1;
				pulse();
			} else {
				tgt.fo = 0;
			}
			springStart();
		}

		/* ---- faithful mode: CSS-transition behaviour ----------------------- */
		function moveFrameFaithful(spot) {
			if (!spot) { frame.classList.remove('is-active'); return; }
			var wasHidden = !frame.classList.contains('is-active');
			if (wasHidden) {
				frame.style.transition = 'none';
				setFrameBox(spot);
				void frame.offsetWidth;
				frame.style.transition = '';
			} else {
				setFrameBox(spot);
			}
			frame.classList.add('is-active');
		}
		function setFrameBox(spot) {
			frame.style.left   = spot.x + '%';
			frame.style.top    = spot.y + '%';
			frame.style.width  = spot.w + '%';
			frame.style.height = spot.h + '%';
		}
		function applyCameraFaithful(spot) {
			if (!layout) return;
			if (!MOBILE.matches || !spot) { stage.style.transform = ''; return; }
			var cam = cameraFor(spot, 'center');
			stage.style.transform = 'translate(' + cam.x + 'px,' + cam.y + 'px) scale(' + cam.k + ')';
		}

		function retarget() {
			var point = points[active];
			var spot  = hotspotOf(point);
			if (cinematic) {
				setCinematicTargets(spot, alignOf(point));
			} else {
				moveFrameFaithful(spot);
				applyCameraFaithful(spot);
			}
		}

		/* ---- activation band ------------------------------------------------ */
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) activate(points.indexOf(entry.target));
			});
		}, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
		points.forEach(function (p) { io.observe(p); });

		function activate(i) {
			if (i === active) return;
			active = i;
			points.forEach(function (p, j) { p.classList.toggle('is-active', j === i); });
			railDots.forEach(function (d, j) { d.setAttribute('aria-current', j === i ? 'true' : 'false'); });
			retarget();
		}

		/* ---- progress rail (cinematic desktop) ------------------------------ */
		var railDots = [];
		if (cinematic) {
			var rail = document.createElement('nav');
			rail.className = 'scrollmap__rail';
			rail.setAttribute('aria-label', 'Map story progress');
			points.forEach(function (p, i) {
				var h2 = p.querySelector('h2');
				var label = p.dataset.label || (h2 ? h2.textContent : 'Point ' + (i + 1));
				var b = document.createElement('button');
				b.type = 'button';
				b.setAttribute('aria-current', 'false');
				b.innerHTML = '<span class="lbl"></span><span class="scrollmap-visually-hidden"></span>';
				b.querySelector('.lbl').textContent = label;
				b.querySelector('.scrollmap-visually-hidden').textContent = 'Go to: ' + label;
				b.addEventListener('click', function () {
					var card = p.querySelector('.card') || p;
					card.scrollIntoView({ behavior: REDUCED.matches ? 'auto' : 'smooth', block: 'center' });
				});
				rail.appendChild(b);
				railDots.push(b);
			});
			viewport.appendChild(rail);
		}

		/* ---- card reveal ------------------------------------------------------ */
		var reveal = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				entry.target.classList.toggle('is-revealed', entry.isIntersecting);
			});
		}, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
		points.forEach(function (p) {
			var card = p.querySelector('.card');
			if (card) reveal.observe(card);
		});

		/* ---- resize / orientation / URL-bar / breakpoint --------------------- */
		if (mapImg.complete && mapImg.naturalWidth) layoutStage();
		else mapImg.addEventListener('load', layoutStage);
		new ResizeObserver(layoutStage).observe(viewport);
		MOBILE.addEventListener('change', function () { layoutStage(); });
	}
})();
