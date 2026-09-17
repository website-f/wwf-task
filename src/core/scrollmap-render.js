/* ===========================================================================
   Scroll Map — JSON → HTML renderer.  CMS-agnostic, dependency-free.
   ---------------------------------------------------------------------------
   Takes one object matching scrollmap.schema.json and returns the webpart's
   markup as a string. It is the reference implementation of the contract: the
   PHP renderer in the WordPress plugin and the Twig template for Drupal both
   produce the same output, and tools/check-parity.js asserts that they do.

   Runs in three places, unchanged (UMD):
     · Node      — server-side render for Eleventy / Astro / Next / Nunjucks,
                   or a build step that turns CMS JSON into static HTML
     · a browser — client-side render for headless CMSs and SPAs
     · a CDN     — <script src="scrollmap-render.js"> then ScrollMapRender()

   Usage
     const html = ScrollMapRender(content);            // → string
     document.querySelector('#slot').innerHTML = html; // then boot the engine

   The engine (scrollmap.js) will also call this for you: give it
   <div data-tgr-json='…'> or <div data-tgr-src="#some-json-script"> and it
   renders itself before booting. That path means a CMS needs NO templating at
   all — emit JSON, drop in two script tags, done.
   ======================================================================== */

(function (root, factory) {
	if (typeof module === 'object' && module.exports) module.exports = factory();
	else root.ScrollMapRender = factory();
}(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	/* ---- escaping ------------------------------------------------------- */

	var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

	/* Only these protocols may appear in an href. Everything else — javascript:,
	   data:, vbscript: — is dropped. */
	function safeUrl(u) {
		var s = String(u == null ? '' : u).trim();
		if (/^(https?:|mailto:|tel:|#|\/|\.{0,2}\/)/i.test(s)) return s;
		return '';
	}

	/* ---- the rich-text whitelist ----------------------------------------
	   A hotspot's `text` is the one field that carries markup. This mirrors the
	   WordPress renderer's wp_kses list exactly, so the two cannot drift.

	   NOTE ON TRUST: this is defence in depth, not the security boundary. The
	   authoritative sanitisation belongs in the CMS, on save, server-side —
	   every adapter's README says so. This pass exists so that a careless
	   headless setup still cannot inject a <script>.                        */
	var ALLOWED = { p: 1, br: 1, em: 1, strong: 1, u: 1, a: 1 };

	function sanitize(html) {
		var out = '';
		var re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<!--[\s\S]*?-->|<[^>]*>/g;
		var last = 0, m;
		while ((m = re.exec(html)) !== null) {
			out += esc(html.slice(last, m.index));      // text between tags
			last = re.lastIndex;
			var tag = (m[1] || '').toLowerCase();
			if (!tag || !ALLOWED[tag]) continue;        // drop comments + any other tag
			if (m[0].charAt(1) === '/') { out += '</' + tag + '>'; continue; }
			if (tag === 'a') {
				var href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[2] || '');
				var url = href ? safeUrl(href[2] || href[3] || href[4]) : '';
				out += url
					? '<a href="' + esc(url) + '" target="_blank" rel="noopener">'
					: '<a>';
			} else {
				out += '<' + tag + '>';                 // every attribute dropped
			}
		}
		return out + esc(html.slice(last));
	}

	/* ---- small helpers --------------------------------------------------- */

	function clampNum(v, lo, hi, dflt) {
		v = parseFloat(v);
		if (isNaN(v)) v = dflt;
		return Math.min(hi, Math.max(lo, v));
	}

	/* The bounds rule, identical to the editor's clampBox() and render.php's
	   wwf_scrollmap_clamp_box(): at least 2% across, never leaves the image. */
	function clampBox(b) {
		if (!b) return null;
		var w = clampNum(b.w, 2, 100, 10);
		var h = clampNum(b.h, 2, 100, 10);
		return {
			x: +clampNum(b.x, 0, 100 - w, 0).toFixed(2),
			y: +clampNum(b.y, 0, 100 - h, 0).toFixed(2),
			w: +w.toFixed(2),
			h: +h.toFixed(2)
		};
	}

	/* Each line becomes a masked line the engine slides up from underneath. */
	function titleLines(t) {
		return String(t == null ? '' : t).trim().split(/\r?\n+/)
			.map(function (l) { return l.trim(); })
			.filter(Boolean)
			.map(function (l) { return '<span class="w"><span>' + esc(l) + '</span></span>'; })
			.join('');
	}

	function paragraphs(t, cls) {
		var c = cls ? ' class="' + esc(cls) + '"' : '';
		return String(t == null ? '' : t).trim().split(/\r?\n+/)
			.map(function (l) { return l.trim(); })
			.filter(Boolean)
			.map(function (l) { return '<p' + c + '>' + esc(l) + '</p>'; })
			.join('');
	}

	function img(o, cls, eager) {
		if (!o || !o.src) return '';
		return '<img' + (cls ? ' class="' + esc(cls) + '"' : '') +
			' src="' + esc(safeUrl(o.src)) + '"' +
			' alt="' + esc(o.alt || '') + '"' +
			(o.srcset ? ' srcset="' + esc(o.srcset) + '"' : '') +
			(o.sizes ? ' sizes="' + esc(o.sizes) + '"' : '') +
			(o.width ? ' width="' + esc(o.width) + '"' : '') +
			(o.height ? ' height="' + esc(o.height) + '"' : '') +
			(eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"') +
			'>';
	}

	function hex(v, dflt) {
		return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || '')) ? v : dflt;
	}

	function rgb(h) {
		h = String(h).replace('#', '');
		if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
		return parseInt(h.slice(0, 2), 16) + ', ' + parseInt(h.slice(2, 4), 16) + ', ' + parseInt(h.slice(4, 6), 16);
	}

	function step(cls, side, label, inner, zoom, box) {
		return '<article class="' + esc(cls) + '" data-side="' + esc(side) + '"' +
			' data-zoom="' + esc(zoom == null ? 1 : zoom) + '"' +
			(label ? ' data-label="' + esc(label) + '"' : '') +
			(box ? " data-hotspot='" + JSON.stringify(box) + "'" : '') +
			'><div class="step__pin"><div class="card">' + inner + '</div></div></article>';
	}

	function pad(n) { return (n < 10 ? '0' : '') + n; }

	/* ---- the renderer ----------------------------------------------------- */

	function render(content, opts) {
		content = content || {};
		opts = opts || {};

		var map = content.map || {};
		if (!map.src) {
			throw new Error('ScrollMapRender: content.map.src is required (see scrollmap.schema.json).');
		}

		var o = content.options || {};
		var t = o.theme || {};
		var focal = o.focal || {};
		var fx = clampNum(focal.x, 0, 100, 50);
		var fy = clampNum(focal.y, 0, 100, 50);

		var accent = hex(t.accent, '#8fd14f');
		var ink = hex(t.ink, '#f2efe6');
		var backdrop = hex(t.backdrop, '#04140d');
		var card = hex(t.card, '#071a11');
		var dim = clampNum(t.dim, 0, 1, 0.62);
		var cardOp = clampNum(t.cardOpacity, 0, 1, 0.84);

		var style = '--accent:' + accent + '; --ink:' + ink +
			'; --ink-dim:rgba(' + rgb(ink) + ',0.66); --forest:' + backdrop +
			'; --dim:' + dim + '; --card-bg:rgba(' + rgb(card) + ',' + cardOp + ')' +
			'; --card-border:rgba(' + rgb(ink) + ',0.16);';

		var title = String(content.sectionTitle || '');
		var flatTitle = title.replace(/\r?\n+/g, ' ').trim();

		var html = '<section class="tgr' + (opts.className ? ' ' + esc(opts.className) : '') + '"' +
			(opts.id ? ' id="' + esc(opts.id) + '"' : '') +
			' style="' + esc(style) + '" data-tgr' +
			' data-focal="' + fx + ' ' + fy + '"' +
			' data-paws="' + (o.paws === false ? 'off' : 'on') + '"' +
			' data-markers="' + (o.markers === false ? 'off' : 'on') + '"' +
			' data-rail="' + (o.rail === false ? 'off' : 'on') + '"' +
			(flatTitle ? ' aria-label="' + esc(flatTitle) + '"' : '') + '>';

		/* the pinned stage */
		html += '<div class="tgr__stage"><div class="tgr__camera">' +
			img(map, 'tgr__map', true) +
			'</div>' +
			'<div class="tgr__grade" aria-hidden="true"></div>' +
			'<div class="tgr__frame" aria-hidden="true"></div>' +
			'<div class="tgr__chip" aria-hidden="true">' +
			'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>' +
			'<span class="tgr__chip-t"></span></div>' +
			'<div class="tgr__bar" aria-hidden="true"></div></div>';

		html += '<div class="tgr__steps">';

		/* opening card: section title + lead text */
		if (title || content.leadText) {
			var lead = '';
			if (title) lead += '<h2 class="h2 title">' + titleLines(title) + '</h2>';
			lead += paragraphs(content.leadText, 'lede');
			html += step('step step--wide', 'right', flatTitle, lead);
		}

		/* one card per hotspot */
		(content.hotspots || []).forEach(function (hs, i) {
			var box = clampBox(hs.box);
			if (!box) return;                      /* no region, nothing to fly to */

			var label = String(hs.label || '').trim();
			var side = hs.side === 'left' ? 'left' : 'right';
			var zoom = clampNum(hs.zoom, 0.4, 2.5, 1);
			var level = ['least', 'vulnerable', 'endangered'].indexOf(hs.badgeLevel) > -1 ? hs.badgeLevel : '';

			var inner = '<div class="card__meta"><span class="card__num">' + pad(i + 1) + '</span>';
			if (label) inner += '<span class="card__region">' + esc(label) + '</span>';
			inner += '</div>';

			if (String(hs.title || '').trim()) inner += '<p class="h2">' + titleLines(hs.title) + '</p>';
			if (String(hs.badge || '').trim()) {
				inner += '<span class="card__status"' + (level ? ' data-level="' + level + '"' : '') +
					'>' + esc(hs.badge) + '</span>';
			}
			if (hs.text) inner += sanitize(hs.text);
			if (hs.image && hs.image.src) {
				inner += '<figure><div class="card__shot">' + img(hs.image) + '</div>';
				if (hs.caption) inner += '<figcaption>' + esc(hs.caption) + '</figcaption>';
				inner += '</figure>';
			}

			html += step('step', side, label, inner, zoom, box);
		});

		/* optional closing card */
		if (content.closingText) {
			html += step('step step--wide', 'left', opts.closingLabel || 'In closing',
				paragraphs(content.closingText, 'lede'));
		}

		return html + '</div></section>';
	}

	/* ---- validation, shared by every adapter ------------------------------
	   Returns { errors, warnings }. Errors should block a publish; warnings
	   should never. Keeping this next to the renderer means a CMS integration
	   gets the same rules as the WordPress editor without reimplementing them. */
	render.validate = function (content) {
		content = content || {};
		var errors = [], warnings = [];
		var spots = content.hotspots || [];

		if (!content.map || !content.map.src) errors.push('Choose a map image.');
		if (!String(content.sectionTitle || '').trim()) errors.push('Write a section title.');
		if (!spots.length) errors.push('Add at least one hotspot.');

		spots.forEach(function (hs, i) {
			var n = pad(i + 1);
			var plain = String(hs.text || '').replace(/<[^>]*>/g, '').trim();
			if (!String(hs.title || '').trim() && !plain) {
				errors.push('Hotspot ' + n + ' — give it a title or some text.');
			}
			if (!hs.box) errors.push('Hotspot ' + n + ' — draw its region on the map.');
			if (hs.image && hs.image.src && !String(hs.image.alt || '').trim()) {
				warnings.push('Hotspot ' + n + ' — the image has no alt text.');
			}
		});

		if (content.map && content.map.src && !String(content.map.alt || '').trim()) {
			warnings.push('The map image has no alt text.');
		}
		return { errors: errors, warnings: warnings, ok: errors.length === 0 };
	};

	render.clampBox = clampBox;
	render.sanitize = sanitize;
	render.version = '1.0.0';

	return render;
}));
