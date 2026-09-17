/**
 * wwf/scrollmap — block editor UI.
 *
 * Built with plain wp.element.createElement against WordPress globals, so the
 * plugin runs by dropping the folder into wp-content/plugins — no npm, no build
 * step. In a product codebase this is the same code written as JSX under
 * @wordpress/scripts.
 *
 * The UI is organised around the four things the brief asks an editor to be
 * able to do, in the brief's own words:
 *
 *   1. ADD       — the block is in the + inserter as "Scroll Map".
 *   2. FILL IN   — sidebar panel "1 · Section" (section title, lead text,
 *                  closing text) and "2 · Map image". Each hotspot's title and
 *                  text are typed straight into the card preview under the map.
 *   3. HOTSPOTS  — panel "3 · Hotspots" is the list: add, reorder, duplicate,
 *                  remove. The region itself is drawn on the map with the
 *                  mouse — draw, drag to move, drag a corner to resize.
 *   4. PREVIEW   — the canvas is live, and the status panel points at
 *                  WordPress's own Preview button once the block is valid.
 *
 * Anything not on that list (map framing, motion switches, colours, per-hotspot
 * zoom and numeric coordinates) lives in one collapsed "Advanced" panel, so the
 * default view stays short.
 */
(function (wp) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;

	var registerBlockType = wp.blocks.registerBlockType;

	var be = wp.blockEditor;
	var useBlockProps = be.useBlockProps;
	var InspectorControls = be.InspectorControls;
	var MediaUpload = be.MediaUpload;
	var MediaUploadCheck = be.MediaUploadCheck;
	var MediaPlaceholder = be.MediaPlaceholder;
	var RichText = be.RichText;

	var c = wp.components;
	var PanelBody = c.PanelBody;
	var Button = c.Button;
	var TextControl = c.TextControl;
	var TextareaControl = c.TextareaControl;
	var RangeControl = c.RangeControl;
	var SelectControl = c.SelectControl;
	var ToggleControl = c.ToggleControl;
	var Notice = c.Notice;
	var ColorPalette = c.ColorPalette;
	var BaseControl = c.BaseControl;

	var __ = wp.i18n.__;

	/* ------------------------------------------------------------- helpers */

	function uid() { return 'hs-' + Math.random().toString(36).slice(2, 9); }

	function clamp(n, min, max) {
		n = parseFloat(n);
		if (isNaN(n)) n = min;
		return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
	}

	/* The bounds rule, in ONE place: a hotspot is at least 2% across and can
	   never leave the map. Drawing, dragging, resizing and the number fields all
	   go through it, and render.php applies it again on the server. */
	function clampBox(b) {
		var w = clamp(b.w, 2, 100);
		var h = clamp(b.h, 2, 100);
		return { x: clamp(b.x, 0, 100 - w), y: clamp(b.y, 0, 100 - h), w: w, h: h };
	}

	function newHotspot() {
		return {
			id: uid(),
			label: '',
			title: '',
			text: '',
			image: null,
			caption: '',
			badge: '',
			badgeLevel: '',
			side: 'right',
			zoom: 1,
			box: { x: 40, y: 40, w: 16, h: 20 }
		};
	}

	function media(m) {
		return { id: m.id, url: m.url, alt: m.alt || '', width: m.width, height: m.height };
	}

	function num(i) { return (i + 1 < 10 ? '0' : '') + (i + 1); }

	/* The original story, ready to load in one click — a finished example an
	   editor can pick apart rather than a blank page. */
	var DEMO_TITLE = 'What do\ntigers eat?';
	var DEMO_LEAD =
		'We talk a lot about tiger prey — but what animals do tigers actually eat?\n' +
		'The most important tiger prey are ungulates: mammals with hooves, such as large deer, wild cattle and wild pigs. Scroll on to travel to some of the places where tiger prey are found.';
	var DEMO_CLOSING =
		"These are just a few of the many tiger prey species. Other important ungulates across the tiger's range include gaur, roe deer, sika deer, hog deer, muntjac, barasingha and eld's deer.";
	var DEMO_HOTSPOTS = [
		{ side: 'right', label: 'India & Nepal', title: 'Sambar\ndeer', mediaTitle: 'Sambar deer', badge: 'IUCN · Vulnerable', badgeLevel: 'vulnerable',
			box: { x: 48.5, y: 43, w: 17.1, h: 39.3 },
			text: '<p>Sambar deer are one of the most important tiger prey species. They are often abundant in tiger reserves in India and Nepal. They can also be found across Southeast Asia, but are much rarer there due to hunting.</p>',
			caption: 'Sambar foal and its mother in Ranthambore Tiger Reserve, India © Martin Harvey / WWF' },
		{ side: 'left', label: 'Sumatra, Indonesia', title: 'Wild pig', mediaTitle: 'Wild boar', badge: 'IUCN · Least concern', badgeLevel: 'least',
			box: { x: 66.5, y: 79.4, w: 20, h: 20.6 },
			text: '<p>Wild pigs are the most widely distributed tiger prey species, occurring in every landscape in which tigers are found. On Sumatra they are one of the most important prey species of all.</p>',
			caption: 'Wild boar have brown fur that provides excellent camouflage in the forest © Ola Jennersten / WWF-Sweden' },
		{ side: 'right', label: 'Thailand', title: 'Banteng', mediaTitle: 'Banteng', badge: 'IUCN · Endangered', badgeLevel: 'endangered',
			box: { x: 66.2, y: 55.5, w: 14, h: 18.3 },
			text: '<p>One of the largest tiger prey species: banteng are wild cattle, classified as Endangered. Historic hunting and a current snaring crisis across Southeast Asia have driven their populations down — but in Thailand there are signs of hope.</p>',
			caption: 'A male banteng in Kuiburi National Park, Thailand © Wayuphong Jitvijak / WWF-Greater Mekong' },
		{ side: 'left', label: 'Kazakhstan', title: 'Bukhara\ndeer', mediaTitle: 'Bukhara deer', badge: 'Central Asian red deer',
			box: { x: 52, y: 16, w: 15.5, h: 20 },
			text: '<p>In Central Asia a different set of species matters. Bukhara deer are increasing thanks to conservation work. Restoring healthy numbers is key to a landmark reintroduction: tigers went extinct in Kazakhstan over 70 years ago, and are planned to return within a few years.</p>',
			caption: 'Newly released bukhara deer, Kazakhstan © WWF' },
		{ side: 'right', label: 'India', title: 'Nilgai', mediaTitle: 'Nilgai', badge: 'IUCN · Least concern', badgeLevel: 'least',
			box: { x: 46.2, y: 42, w: 17.7, h: 33.9 },
			text: '<p>Nilgai are the largest antelope in Asia. Thin legs, a large torso, a wide neck and a small head make them unmistakable. Found mostly in India and parts of Nepal, they weigh roughly 100–288 kg depending on sex.</p>',
			caption: 'Nilgai in Ranthambore Tiger Reserve, India © Ola Jennersten / WWF-Sweden' },
		{ side: 'left', label: 'Nepal & India', title: 'Chital', mediaTitle: 'Chital', badge: 'IUCN · Least concern', badgeLevel: 'least',
			box: { x: 56.4, y: 40.7, w: 11.4, h: 14.8 },
			text: '<p>Also known as spotted deer, chital are an important and abundant prey species for tigers in India and Nepal. They are also found in Bangladesh and Bhutan.</p>',
			caption: 'Chital on a camera trap in the Khata Corridor, Nepal © DoFSC / WWF Nepal' }
	];

	var PALETTE = [
		{ name: 'WWF green', color: '#8fd14f' },
		{ name: 'Forest', color: '#04140d' },
		{ name: 'Deep panel', color: '#071a11' },
		{ name: 'Cream', color: '#f2efe6' },
		{ name: 'Gold', color: '#e8b33a' },
		{ name: 'Coral', color: '#ff8f6b' },
		{ name: 'White', color: '#ffffff' },
		{ name: 'Black', color: '#000000' }
	];

	/* ---------------------------------------------------------------- edit */

	function Edit(props) {
		var atts = props.attributes;
		var setAtts = props.setAttributes;
		var spots = atts.hotspots || [];

		var selState = useState(0);
		var selected = Math.min(selState[0], Math.max(0, spots.length - 1));
		var setSelected = selState[1];

		var drawState = useState(false);
		var drawing = drawState[0], setDrawing = drawState[1];

		var guideState = useState(true);
		var showGuide = guideState[0], setShowGuide = guideState[1];

		var liveState = useState(null);
		var live = liveState[0], setLive = liveState[1];

		var drag = useRef(null);
		var canvasRef = useRef(null);

		var hs = spots[selected] || null;

		/* ---------------- validation ------------------------------------
		   Only three things can block a publish, and each says exactly what to
		   do about it. Missing alt text warns but never blocks — refusing
		   someone's publish over that is how you teach people to hate a CMS. */
		function isEmpty(s) {
			var t = String(s.text || '').replace(/<[^>]*>/g, '').trim();
			return !String(s.title || '').trim() && !t;
		}

		var errors = [];
		if (!atts.backgroundImage) errors.push(__('Choose a map image.', 'wwf-scrollmap'));
		if (!String(atts.sectionTitle || '').trim()) errors.push(__('Write a section title.', 'wwf-scrollmap'));
		if (!spots.length) errors.push(__('Add at least one hotspot.', 'wwf-scrollmap'));
		spots.forEach(function (s, i) {
			if (isEmpty(s)) {
				errors.push(__('Hotspot', 'wwf-scrollmap') + ' ' + num(i) + ' — ' + __('give it a title or some text.', 'wwf-scrollmap'));
			}
		});

		var warnings = [];
		if (atts.backgroundImage && !String(atts.backgroundImage.alt || '').trim()) {
			warnings.push(__('The map image has no alt text — add one in the Media Library.', 'wwf-scrollmap'));
		}
		spots.forEach(function (s, i) {
			if (s.image && !String(s.image.alt || '').trim()) {
				warnings.push(__('Hotspot', 'wwf-scrollmap') + ' ' + num(i) + ' — ' + __('the image has no alt text.', 'wwf-scrollmap'));
			}
		});

		var blocked = errors.length > 0;
		useEffect(function () {
			try {
				var ed = wp.data.dispatch('core/editor');
				if (!ed || !ed.lockPostSaving) return;
				if (blocked) ed.lockPostSaving('wwf-scrollmap');
				else ed.unlockPostSaving('wwf-scrollmap');
			} catch (e) { /* site/widget editor: no core/editor store */ }
		}, [blocked]);

		/* ---------------- hotspot list operations -------------------------
		   All immutable and all through setAttributes, which is why undo/redo
		   and post revisions work without a line of code from me. */
		function update(i, patch) {
			setAtts({ hotspots: spots.map(function (s, j) { return j === i ? Object.assign({}, s, patch) : s; }) });
		}
		function add() {
			setAtts({ hotspots: spots.concat([newHotspot()]) });
			setSelected(spots.length);
			setDrawing(true);          /* straight into "draw it on the map" */
		}
		function remove(i) {
			setAtts({ hotspots: spots.filter(function (_, j) { return j !== i; }) });
			setSelected(Math.max(0, i - 1));
		}
		function move(i, dir) {
			var j = i + dir;
			if (j < 0 || j >= spots.length) return;
			var next = spots.slice();
			next[i] = spots[j]; next[j] = spots[i];
			setAtts({ hotspots: next });
			setSelected(j);
		}
		function duplicate(i) {
			var next = spots.slice();
			next.splice(i + 1, 0, Object.assign({}, spots[i], { id: uid() }));
			setAtts({ hotspots: next });
			setSelected(i + 1);
		}
		/* "Or load the tiger example" — fills a blank block with the finished
		   story. It also finds the seven pictures in the Media Library by title
		   and attaches them, so a brand-new page is ONE click away from a
		   complete working map instead of one click plus seven image pickers.
		   If those pictures are not in the library the text still loads and the
		   editor just picks their own — no error, no dead end. */
		function loadDemo() {
			var base = {
				sectionTitle: atts.sectionTitle || DEMO_TITLE,
				leadText: atts.leadText || DEMO_LEAD,
				closingText: atts.closingText || DEMO_CLOSING,
				hotspots: DEMO_HOTSPOTS.map(function (d) {
					var h = Object.assign(newHotspot(), d, { id: uid() });
					delete h.mediaTitle;              /* editor-only hint, never stored */
					return h;
				})
			};
			setSelected(0);

			if (!wp.apiFetch) { setAtts(base); return; }

			wp.apiFetch({ path: '/wp/v2/media?per_page=100&media_type=image&_fields=id,title,alt_text,source_url,media_details' })
				.then(function (items) {
					var byTitle = {};
					items.forEach(function (m) {
						var t = ((m.title && m.title.rendered) || '').trim().toLowerCase();
						if (t && !byTitle[t]) byTitle[t] = m;
					});
					var pick = function (title) {
						var m = byTitle[String(title || '').toLowerCase()];
						if (!m) return null;
						var d = m.media_details || {};
						return { id: m.id, url: m.source_url, alt: m.alt_text || '',
							width: d.width, height: d.height };
					};

					var map = pick('Tiger range countries map');
					if (map && !atts.backgroundImage) base.backgroundImage = map;
					base.hotspots = base.hotspots.map(function (h, i) {
						var img = pick(DEMO_HOTSPOTS[i].mediaTitle);
						return img ? Object.assign({}, h, { image: img }) : h;
					});
					setAtts(base);
				})
				.catch(function () { setAtts(base); });   /* text-only is still useful */
		}

		/* ---------------- drawing on the map ------------------------------
		   One handler set, three gestures: draw a new hotspot, drag its middle
		   to move it, drag a corner to resize. Nobody types coordinates. */
		function pct(evt) {
			var r = canvasRef.current.getBoundingClientRect();
			return { x: (evt.clientX - r.left) / r.width * 100, y: (evt.clientY - r.top) / r.height * 100 };
		}

		function onDown(evt) {
			if (!canvasRef.current || !hs) return;
			var handle = evt.target.dataset ? evt.target.dataset.handle : null;
			var onBox = evt.target.classList && evt.target.classList.contains('wwfsm-box');

			if (drawing) drag.current = { type: 'draw', from: pct(evt) };
			else if (handle) drag.current = { type: 'resize', corner: handle, from: pct(evt), box: hs.box };
			else if (onBox) drag.current = { type: 'move', from: pct(evt), box: hs.box };
			else return;

			evt.preventDefault();
			if (evt.currentTarget.setPointerCapture) evt.currentTarget.setPointerCapture(evt.pointerId);
		}

		function onMove(evt) {
			var d = drag.current;
			if (!d) return;
			var p = pct(evt), box;
			if (d.type === 'draw') {
				box = { x: Math.min(d.from.x, p.x), y: Math.min(d.from.y, p.y),
					w: Math.abs(p.x - d.from.x), h: Math.abs(p.y - d.from.y) };
			} else if (d.type === 'move') {
				box = { x: d.box.x + (p.x - d.from.x), y: d.box.y + (p.y - d.from.y), w: d.box.w, h: d.box.h };
			} else {
				var b = d.box, x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
				if (d.corner.indexOf('l') > -1) x1 = p.x;
				if (d.corner.indexOf('r') > -1) x2 = p.x;
				if (d.corner.indexOf('t') > -1) y1 = p.y;
				if (d.corner.indexOf('b') > -1) y2 = p.y;
				box = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
			}
			setLive(clampBox(box));
		}

		function onUp() {
			var d = drag.current;
			drag.current = null;
			if (!d) return;
			if (live && live.w > 1 && live.h > 1) update(selected, { box: clampBox(live) });
			setLive(null);
			if (d.type === 'draw') setDrawing(false);
		}

		/* ---------------- the canvas -------------------------------------- */
		var canvas;
		if (!atts.backgroundImage) {
			canvas = el(MediaPlaceholder, {
				icon: 'location-alt',
				labels: {
					title: __('Scroll Map', 'wwf-scrollmap'),
					instructions: __('Step 1 — choose the map image. You will draw the hotspots on it next.', 'wwf-scrollmap')
				},
				accept: 'image/*',
				allowedTypes: ['image'],
				onSelect: function (m) { setAtts({ backgroundImage: media(m) }); }
			});
		} else {
			canvas = el('div', { className: 'wwfsm-canvaswrap' },
				el('div', {
						className: 'wwfsm-canvas' + (drawing ? ' is-drawing' : ''),
						ref: canvasRef,
						onPointerDown: onDown,
						onPointerMove: onMove,
						onPointerUp: onUp,
						onPointerCancel: onUp
					},
					el('img', { src: atts.backgroundImage.url, alt: '', draggable: false }),

					/* Where the map will zoom to, and where the text will sit —
					   always opposite halves, so the text can never cover the
					   hotspot. Shown here so it is a visible promise. */
					showGuide && hs && el('div', { className: 'wwfsm-ghost', 'data-side': hs.side },
						el('span', null, __('map zooms here', 'wwf-scrollmap'))),
					showGuide && hs && el('div', { className: 'wwfsm-ghostcard', 'data-side': hs.side },
						el('span', null, __('text here', 'wwf-scrollmap'))),

					spots.map(function (s, i) {
						var b = (i === selected && live) ? live : s.box;
						if (!b) return null;
						var isSel = i === selected;
						return el('div', {
							key: s.id,
							className: 'wwfsm-box' + (isSel ? ' is-selected' : ''),
							style: { left: b.x + '%', top: b.y + '%', width: b.w + '%', height: b.h + '%',
								borderColor: atts.accentColor },
							onClick: function () { if (!drawing) setSelected(i); },
							title: (s.label || s.title || __('Hotspot', 'wwf-scrollmap')).split('\n').join(' ')
						},
							el('span', { className: 'wwfsm-box__n', style: { background: atts.accentColor } }, num(i)),
							isSel ? ['tl', 'tr', 'bl', 'br'].map(function (k) {
								return el('i', { key: k, className: 'wwfsm-handle wwfsm-handle--' + k, 'data-handle': k });
							}) : null
						);
					}),

					drawing && el('div', { className: 'wwfsm-canvas__hint' },
						__('Drag a box over the place you want to highlight', 'wwf-scrollmap'))
				),

				el('div', { className: 'wwfsm-canvasbar' },
					el('span', { className: 'wwfsm-canvasbar__t' }, hs
						? __('Hotspot', 'wwf-scrollmap') + ' ' + num(selected) + ' ' + __('of', 'wwf-scrollmap') + ' ' + spots.length
						: __('No hotspots yet', 'wwf-scrollmap')),
					hs && el(Button, {
						variant: drawing ? 'primary' : 'secondary', size: 'small',
						onClick: function () { setDrawing(!drawing); }
					}, drawing ? __('Drawing…', 'wwf-scrollmap') : __('Redraw on map', 'wwf-scrollmap')),
					el(Button, { variant: 'tertiary', size: 'small', onClick: function () { setShowGuide(!showGuide); } },
						showGuide ? __('Hide guide', 'wwf-scrollmap') : __('Show guide', 'wwf-scrollmap'))
				)
			);
		}

		/* ---------------- the card preview, where text is typed ------------ */
		var preview = hs && el('div', { className: 'wwfsm-previewwrap' },
			el('p', { className: 'wwfsm-previewlabel' },
				__('This hotspot’s text — type straight into it', 'wwf-scrollmap')),
			el('div', { className: 'wwfsm-preview', style: { background: atts.backdropColor } },
				el('div', { className: 'wwfsm-card', style: { background: atts.cardColor, color: atts.inkColor } },
					el('div', { className: 'wwfsm-card__meta', style: { color: atts.accentColor } },
						el('span', { className: 'wwfsm-card__num' }, num(selected)),
						el('span', null, hs.label || __('Location', 'wwf-scrollmap'))),
					el(TextareaControl, {
						className: 'wwfsm-f wwfsm-f--heading',
						label: __('Title', 'wwf-scrollmap'),
						help: __('Press Enter for a line break.', 'wwf-scrollmap'),
						rows: 2,
						value: hs.title,
						onChange: function (v) { update(selected, { title: v }); }
					}),
					el(RichText, {
						tagName: 'div',
						multiline: 'p',
						className: 'wwfsm-card__body',
						placeholder: __('Write about this place…', 'wwf-scrollmap'),
						value: hs.text,
						allowedFormats: ['core/bold', 'core/italic', 'core/link', 'core/underline'],
						onChange: function (v) { update(selected, { text: v }); }
					}),
					hs.image && el('figure', { className: 'wwfsm-card__figure' },
						el('img', { src: hs.image.url, alt: hs.image.alt || '' }),
						hs.caption && el('figcaption', null, hs.caption))
				)
			)
		);

		/* ---------------- sidebar ------------------------------------------ */
		function pair(k, v) { var o = {}; o[k] = v; return o; }
		function colorRow(label, key, fallback) {
			return el(BaseControl, { label: label },
				el(ColorPalette, {
					colors: PALETTE, value: atts[key] || fallback, clearable: false,
					onChange: function (v) { setAtts(pair(key, v || fallback)); }
				}));
		}

		var status = errors.length
			? el(PanelBody, { title: __('Before you publish', 'wwf-scrollmap'), initialOpen: true },
				el(Notice, { status: 'warning', isDismissible: false },
					el('strong', null, __('Still to do:', 'wwf-scrollmap')),
					el('ul', { className: 'wwfsm-todo' },
						errors.map(function (m, i) { return el('li', { key: i }, m); }))))
			: el(PanelBody, { title: __('Before you publish', 'wwf-scrollmap'), initialOpen: true },
				el(Notice, { status: 'success', isDismissible: false },
					__('Ready. Use ', 'wwf-scrollmap'),
					el('strong', null, __('Preview', 'wwf-scrollmap')),
					__(' in the top bar to check it on desktop, tablet and mobile before you publish.', 'wwf-scrollmap')),
				warnings.length > 0 && el(Notice, { status: 'warning', isDismissible: false },
					el('strong', null, __('Worth fixing:', 'wwf-scrollmap')),
					el('ul', { className: 'wwfsm-todo' },
						warnings.map(function (m, i) { return el('li', { key: i }, m); }))));

		var sidebar = el(InspectorControls, null,
			status,

			/* ---- 1 · the section's own fields ---------------------------- */
			el(PanelBody, { title: __('1 · Section', 'wwf-scrollmap'), initialOpen: true },
				el(TextareaControl, {
					label: __('Section title', 'wwf-scrollmap'),
					help: __('Required. Shown as the big heading on the opening card, and read out by screen readers. Press Enter for a line break.', 'wwf-scrollmap'),
					rows: 2,
					value: atts.sectionTitle,
					onChange: function (v) { setAtts({ sectionTitle: v }); }
				}),
				el(TextareaControl, {
					label: __('Lead text', 'wwf-scrollmap'),
					help: __('The introduction, shown before the first hotspot. One paragraph per line.', 'wwf-scrollmap'),
					rows: 5,
					value: atts.leadText,
					onChange: function (v) { setAtts({ leadText: v }); }
				}),
				el(TextareaControl, {
					label: __('Closing text (optional)', 'wwf-scrollmap'),
					help: __('Shown on a final card after the last hotspot.', 'wwf-scrollmap'),
					rows: 3,
					value: atts.closingText,
					onChange: function (v) { setAtts({ closingText: v }); }
				})
			),

			/* ---- 2 · the map image --------------------------------------- */
			el(PanelBody, { title: __('2 · Map image', 'wwf-scrollmap'), initialOpen: true },
				el(MediaUploadCheck, null,
					el(MediaUpload, {
						allowedTypes: ['image'],
						value: atts.backgroundImage ? atts.backgroundImage.id : undefined,
						onSelect: function (m) { setAtts({ backgroundImage: media(m) }); },
						render: function (o) {
							return el('div', null,
								atts.backgroundImage && el('img', {
									src: atts.backgroundImage.url, alt: '',
									style: { width: '100%', borderRadius: '4px', marginBottom: '8px', display: 'block' }
								}),
								el(Button, { variant: 'secondary', onClick: o.open },
									atts.backgroundImage ? __('Replace map image', 'wwf-scrollmap') : __('Choose map image', 'wwf-scrollmap')));
						}
					})),
				el('p', { className: 'wwfsm-hint' },
					__('Hotspots are stored as percentages of this image, so swapping in a new version of the same map keeps them in place.', 'wwf-scrollmap'))
			),

			/* ---- 3 · hotspots: add / reorder / remove -------------------- */
			el(PanelBody, { title: __('3 · Hotspots', 'wwf-scrollmap') + ' (' + spots.length + ')', initialOpen: true },
				spots.length === 0 && el(Notice, { status: 'info', isDismissible: false },
					__('No hotspots yet. Add one, then drag a box on the map.', 'wwf-scrollmap')),

				el('ul', { className: 'wwfsm-list' },
					spots.map(function (s, i) {
						return el('li', {
							key: s.id,
							className: 'wwfsm-list__row' + (i === selected ? ' is-selected' : '') + (isEmpty(s) ? ' is-invalid' : '')
						},
							el('button', {
								type: 'button', className: 'wwfsm-list__label',
								onClick: function () { setSelected(i); }
							},
								el('span', { className: 'wwfsm-list__n' }, num(i)),
								el('span', { className: 'wwfsm-list__t' },
									(s.title || '').split('\n').join(' ') || s.label || __('(untitled)', 'wwf-scrollmap'))),
							el(Button, { icon: 'arrow-up-alt2', label: __('Move up', 'wwf-scrollmap'), size: 'small',
								disabled: i === 0, onClick: function () { move(i, -1); } }),
							el(Button, { icon: 'arrow-down-alt2', label: __('Move down', 'wwf-scrollmap'), size: 'small',
								disabled: i === spots.length - 1, onClick: function () { move(i, 1); } }),
							el(Button, { icon: 'admin-page', label: __('Duplicate', 'wwf-scrollmap'), size: 'small',
								onClick: function () { duplicate(i); } }),
							el(Button, { icon: 'trash', label: __('Remove', 'wwf-scrollmap'), size: 'small', isDestructive: true,
								onClick: function () { if (window.confirm(__('Remove this hotspot?', 'wwf-scrollmap'))) remove(i); } })
						);
					})),

				el(Button, { variant: 'primary', onClick: add, className: 'wwfsm-addbtn' },
					__('+ Add hotspot', 'wwf-scrollmap')),
				el('p', { className: 'wwfsm-hint' },
					__('Order in this list is the order readers see. Numbering follows automatically.', 'wwf-scrollmap')),

				spots.length === 0 && el(Button, { variant: 'link', onClick: loadDemo, className: 'wwfsm-demo' },
					__('Or load the tiger example', 'wwf-scrollmap'))
			),

			/* ---- 4 · the selected hotspot's fields ----------------------- */
			hs && el(PanelBody, { title: __('Hotspot', 'wwf-scrollmap') + ' ' + num(selected), initialOpen: true },
				el(TextControl, {
					label: __('Location label', 'wwf-scrollmap'),
					help: __('Short place name, e.g. “India & Nepal”. Shown on the badge over the map.', 'wwf-scrollmap'),
					value: hs.label,
					onChange: function (v) { update(selected, { label: v }); }
				}),
				el(SelectControl, {
					label: __('Which side is the text on?', 'wwf-scrollmap'),
					help: __('The map always zooms to the opposite half, so the text can never cover the hotspot.', 'wwf-scrollmap'),
					value: hs.side,
					options: [
						{ label: __('Text right · map left', 'wwf-scrollmap'), value: 'right' },
						{ label: __('Text left · map right', 'wwf-scrollmap'), value: 'left' }
					],
					onChange: function (v) { update(selected, { side: v }); }
				}),
				el(MediaUploadCheck, null,
					el(MediaUpload, {
						allowedTypes: ['image'],
						value: hs.image ? hs.image.id : undefined,
						onSelect: function (m) { update(selected, { image: media(m) }); },
						render: function (o) {
							return el('div', { style: { margin: '4px 0 12px' } },
								el(Button, { variant: 'secondary', onClick: o.open },
									hs.image ? __('Replace image', 'wwf-scrollmap') : __('Add an image', 'wwf-scrollmap')),
								hs.image && el(Button, {
									variant: 'link', isDestructive: true, style: { marginLeft: '8px' },
									onClick: function () { update(selected, { image: null, caption: '' }); }
								}, __('Remove', 'wwf-scrollmap')));
						}
					})),
				hs.image && el(TextControl, {
					label: __('Caption / credit', 'wwf-scrollmap'),
					value: hs.caption,
					onChange: function (v) { update(selected, { caption: v }); }
				}),
				el(Button, {
					variant: drawing ? 'primary' : 'secondary',
					onClick: function () { setDrawing(!drawing); },
					className: 'wwfsm-drawbtn'
				}, drawing ? __('Drawing… drag on the map', 'wwf-scrollmap') : __('Redraw this hotspot on the map', 'wwf-scrollmap')),
				el('p', { className: 'wwfsm-hint' },
					__('Or drag the box on the map to move it, and a corner to resize it.', 'wwf-scrollmap'))
			),

			/* ---- 5 · everything optional, folded away -------------------- */
			el(PanelBody, { title: __('Advanced', 'wwf-scrollmap'), initialOpen: false },
				hs && el(Fragment, null,
					el('p', { className: 'wwfsm-subhead' }, __('This hotspot', 'wwf-scrollmap') + ' ' + num(selected)),
					el(TextControl, {
						label: __('Badge text', 'wwf-scrollmap'),
						placeholder: 'IUCN · Vulnerable',
						value: hs.badge,
						onChange: function (v) { update(selected, { badge: v }); }
					}),
					el(SelectControl, {
						label: __('Badge colour', 'wwf-scrollmap'),
						value: hs.badgeLevel || '',
						options: [
							{ label: __('Neutral', 'wwf-scrollmap'), value: '' },
							{ label: __('Green', 'wwf-scrollmap'), value: 'least' },
							{ label: __('Amber', 'wwf-scrollmap'), value: 'vulnerable' },
							{ label: __('Coral', 'wwf-scrollmap'), value: 'endangered' }
						],
						onChange: function (v) { update(selected, { badgeLevel: v }); }
					}),
					el(RangeControl, {
						label: __('Zoom strength', 'wwf-scrollmap'),
						value: hs.zoom || 1, min: 0.4, max: 2.5, step: 0.05,
						onChange: function (v) { update(selected, { zoom: v }); }
					}),
					el('div', { className: 'wwfsm-nums' },
						['x', 'y', 'w', 'h'].map(function (k) {
							return el(TextControl, {
								key: k, label: k.toUpperCase() + ' %', type: 'number', step: 0.1,
								value: hs.box ? hs.box[k] : 0,
								onChange: function (v) {
									var patch = {}; patch[k] = v;
									update(selected, { box: clampBox(Object.assign({}, hs.box, patch)) });
								}
							});
						})),
					el('hr')
				),

				el('p', { className: 'wwfsm-subhead' }, __('Map framing', 'wwf-scrollmap')),
				el(RangeControl, {
					label: __('Horizontal', 'wwf-scrollmap'),
					help: __('Which part of the map survives when it is cropped to the screen: 0 keeps the left edge, 100 the right.', 'wwf-scrollmap'),
					value: atts.focalX, min: 0, max: 100, step: 1,
					onChange: function (v) { setAtts({ focalX: v }); }
				}),
				el(RangeControl, {
					label: __('Vertical', 'wwf-scrollmap'),
					value: atts.focalY, min: 0, max: 100, step: 1,
					onChange: function (v) { setAtts({ focalY: v }); }
				}),

				el('p', { className: 'wwfsm-subhead' }, __('Motion', 'wwf-scrollmap')),
				el(ToggleControl, {
					label: __('Paw-print trail between hotspots', 'wwf-scrollmap'),
					checked: !!atts.showPaws, onChange: function (v) { setAtts({ showPaws: v }); }
				}),
				el(ToggleControl, {
					label: __('Numbered pins on the map', 'wwf-scrollmap'),
					checked: !!atts.showMarkers, onChange: function (v) { setAtts({ showMarkers: v }); }
				}),
				el(ToggleControl, {
					label: __('Jump-to bar along the bottom', 'wwf-scrollmap'),
					checked: !!atts.showRail, onChange: function (v) { setAtts({ showRail: v }); }
				}),
				el('p', { className: 'wwfsm-hint' },
					__('Readers whose device asks for reduced motion get the same content with the movement switched off — automatically.', 'wwf-scrollmap')),

				el('p', { className: 'wwfsm-subhead' }, __('Colours', 'wwf-scrollmap')),
				colorRow(__('Accent', 'wwf-scrollmap'), 'accentColor', '#8fd14f'),
				colorRow(__('Text', 'wwf-scrollmap'), 'inkColor', '#f2efe6'),
				colorRow(__('Backdrop', 'wwf-scrollmap'), 'backdropColor', '#04140d'),
				colorRow(__('Card', 'wwf-scrollmap'), 'cardColor', '#071a11'),
				el(RangeControl, {
					label: __('Map dimming outside the hotspot', 'wwf-scrollmap'),
					value: atts.dimOpacity, min: 0, max: 1, step: 0.02,
					onChange: function (v) { setAtts({ dimOpacity: v }); }
				}),
				el(RangeControl, {
					label: __('Card opacity', 'wwf-scrollmap'),
					value: atts.cardOpacity, min: 0.3, max: 1, step: 0.02,
					onChange: function (v) { setAtts({ cardOpacity: v }); }
				})
			)
		);

		/* The four things the brief asks for, on screen, in order. */
		var steps = [
			{ n: '1', t: __('Map image', 'wwf-scrollmap'), done: !!atts.backgroundImage },
			{ n: '2', t: __('Title & lead text', 'wwf-scrollmap'), done: !!String(atts.sectionTitle || '').trim() },
			{ n: '3', t: __('Hotspots', 'wwf-scrollmap'), done: spots.length > 0 && !spots.some(isEmpty) },
			{ n: '4', t: __('Preview, then publish', 'wwf-scrollmap'), done: false }
		];

		return el(Fragment, null,
			sidebar,
			el('div', useBlockProps({ className: 'wwfsm-editor' }),
				el('div', { className: 'wwfsm-head' },
					el('span', { className: 'wwfsm-badge' }, __('Scroll Map', 'wwf-scrollmap')),
					el('ol', { className: 'wwfsm-steps' },
						steps.map(function (s) {
							return el('li', { key: s.n, className: s.done ? 'is-done' : '' },
								el('i', null, s.done ? '✓' : s.n), s.t);
						}))),
				canvas,
				preview
			)
		);
	}

	registerBlockType('wwf/scrollmap', {
		edit: Edit,
		save: function () { return null; }   // dynamic block — render.php owns the output
	});

})(window.wp);
