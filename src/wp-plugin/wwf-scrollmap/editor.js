/**
 * wwf/scrollmap — block editor UI.
 *
 * Built with plain wp.element.createElement against WordPress globals, so the
 * plugin runs by dropping the folder into wp-content/plugins — no npm, no
 * build step, no compiled bundle to explain. In a product codebase this file
 * is the same code written as JSX under @wordpress/scripts.
 *
 * The editing model, and why it is shaped this way:
 *   CANVAS  — the real map with numbered region boxes on it. Editors DRAW a
 *             region by dragging, MOVE it by dragging its middle, and RESIZE
 *             it from its corners. Nobody types coordinates.
 *   SIDEBAR — global map/motion/colour settings, a chapter repeater (add /
 *             reorder / duplicate / remove), and the selected chapter's fields.
 *   PREVIEW — a live card preview under the canvas, plus a ghost of the area
 *             the camera will fly the region into, so "card left, map right"
 *             is something you can see rather than imagine.
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
	var ButtonGroup = c.ButtonGroup;
	var ColorPalette = c.ColorPalette;
	var BaseControl = c.BaseControl;

	var __ = wp.i18n.__;

	/* ------------------------------------------------------------- helpers */

	function uid() { return 'pt-' + Math.random().toString(36).slice(2, 9); }

	function clamp(n, min, max) {
		n = parseFloat(n);
		if (isNaN(n)) n = min;
		return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
	}

	/* The bounds rule, in ONE place: sizes at least 2%, and a box may never
	   leave the artwork. Every write path goes through it — drawing, moving,
	   resizing, the number fields — and render.php applies it again on the
	   server, because stored data is never trusted. */
	function clampBox(b) {
		var w = clamp(b.w, 2, 100);
		var h = clamp(b.h, 2, 100);
		return { x: clamp(b.x, 0, 100 - w), y: clamp(b.y, 0, 100 - h), w: w, h: h };
	}

	function newPoint(wide) {
		return {
			id: uid(),
			wide: !!wide,
			side: 'right',
			label: '',
			number: '',
			heading: '',
			status: '',
			statusLevel: '',
			body: '',
			image: null,
			caption: '',
			zoom: 1,
			hotspot: wide ? null : { x: 40, y: 40, w: 16, h: 20 }
		};
	}

	function media(m) {
		return { id: m.id, url: m.url, alt: m.alt || '', width: m.width, height: m.height };
	}

	/* The original story, ready to seed in one click — full parity for a demo. */
	var DEMO = [
		{ wide: true, side: 'right', label: 'Tiger range countries', heading: 'What do\ntigers eat?',
			body: '<p>We talk a lot about <em>tiger prey</em> — but what animals do tigers actually eat?</p><p>The most important tiger prey are ungulates: mammals with hooves, such as large deer, wild cattle and wild pigs. Scroll on to travel to some of the places where tiger prey are found.</p>' },
		{ side: 'right', number: '01', label: 'India & Nepal', heading: 'Sambar\ndeer',
			status: 'IUCN · Vulnerable', statusLevel: 'vulnerable', hotspot: { x: 48.5, y: 43, w: 17.1, h: 39.3 },
			body: '<p>Sambar deer are one of the most important tiger prey species. They are often abundant in tiger reserves in India and Nepal. They can also be found across Southeast Asia, but are much rarer there due to hunting.</p>',
			caption: 'Sambar foal and its mother in Ranthambore Tiger Reserve, India © Martin Harvey / WWF' },
		{ side: 'left', number: '02', label: 'Sumatra, Indonesia', heading: 'Wild pig',
			status: 'IUCN · Least concern', statusLevel: 'least', hotspot: { x: 66.5, y: 79.4, w: 20, h: 20.6 },
			body: '<p>Wild pigs are the most widely distributed tiger prey species, occurring in every landscape in which tigers are found. On Sumatra they are one of the most important prey species of all.</p>',
			caption: 'Wild boar have brown fur that provides excellent camouflage in the forest © Ola Jennersten / WWF-Sweden' },
		{ side: 'right', number: '03', label: 'Thailand', heading: 'Banteng',
			status: 'IUCN · Endangered', statusLevel: 'endangered', hotspot: { x: 66.2, y: 55.5, w: 14, h: 18.3 },
			body: '<p>One of the largest tiger prey species: banteng are wild cattle, classified as Endangered. Historic hunting and a current snaring crisis across Southeast Asia have driven their populations down — but in Thailand there are signs of hope.</p>',
			caption: 'A male banteng in Kuiburi National Park, Thailand © Wayuphong Jitvijak / WWF-Greater Mekong' },
		{ side: 'left', number: '04', label: 'Kazakhstan', heading: 'Bukhara\ndeer',
			status: 'Central Asian red deer', hotspot: { x: 52, y: 16, w: 15.5, h: 20 },
			body: '<p>In Central Asia a different set of species matters. Bukhara deer are increasing thanks to conservation work. Restoring healthy numbers is key to a landmark reintroduction: tigers went extinct in Kazakhstan over 70 years ago, and are planned to return within a few years.</p>',
			caption: 'Newly released bukhara deer, Kazakhstan © WWF' },
		{ side: 'right', number: '05', label: 'India', heading: 'Nilgai',
			status: 'IUCN · Least concern', statusLevel: 'least', hotspot: { x: 46.2, y: 42, w: 17.7, h: 33.9 },
			body: '<p>Nilgai are the largest antelope in Asia. Thin legs, a large torso, a wide neck and a small head make them unmistakable. Found mostly in India and parts of Nepal, they weigh roughly 100–288 kg depending on sex.</p>',
			caption: 'Nilgai in Ranthambore Tiger Reserve, India © Ola Jennersten / WWF-Sweden' },
		{ side: 'left', number: '06', label: 'Nepal & India', heading: 'Chital',
			status: 'IUCN · Least concern', statusLevel: 'least', hotspot: { x: 56.4, y: 40.7, w: 11.4, h: 14.8 },
			body: '<p>Also known as spotted deer, chital are an important and abundant prey species for tigers in India and Nepal. They are also found in Bangladesh and Bhutan.</p>',
			caption: 'Chital on a camera trap in the Khata Corridor, Nepal © DoFSC / WWF Nepal' },
		{ wide: true, side: 'left', label: 'And many more', heading: 'Six of many',
			body: "<p>These are just a few of the many tiger prey species. Other important ungulates across the tiger's range include gaur, roe deer, sika deer, hog deer, muntjac, barasingha and eld's deer.</p>" }
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
		var points = atts.points || [];

		var selState = useState(0);
		var selected = Math.min(selState[0], Math.max(0, points.length - 1));
		var setSelected = selState[1];

		var drawState = useState(false);
		var drawing = drawState[0], setDrawing = drawState[1];

		var ghostState = useState(true);
		var showGhost = ghostState[0], setShowGhost = ghostState[1];

		var liveState = useState(null);           // box being dragged, painted live
		var live = liveState[0], setLive = liveState[1];

		var drag = useRef(null);
		var canvasRef = useRef(null);

		var pt = points[selected] || null;

		/* ---------------- validation -------------------------------------
		   Hard rules disable Publish and are listed with their reason. Soft
		   rules only warn — an accessibility nudge must never block a save. */
		function isEmpty(p) {
			var body = String(p.body || '').replace(/<[^>]*>/g, '').trim();
			return !String(p.heading || '').trim() && !body;
		}

		var errors = [];
		if (!atts.backgroundImage) errors.push(__('A background map image is required.', 'wwf-scrollmap'));
		if (!String(atts.sectionTitle || '').trim()) errors.push(__('A section title is required.', 'wwf-scrollmap'));
		if (!points.length) errors.push(__('Add at least one chapter.', 'wwf-scrollmap'));
		points.forEach(function (p, i) {
			if (isEmpty(p)) errors.push(__('Chapter', 'wwf-scrollmap') + ' ' + (i + 1) + ': ' + __('needs a heading or body text.', 'wwf-scrollmap'));
			if (!p.wide && !p.hotspot) errors.push(__('Chapter', 'wwf-scrollmap') + ' ' + (i + 1) + ': ' + __('map chapters need a region — draw one, or switch it to a text chapter.', 'wwf-scrollmap'));
		});

		var warnings = [];
		if (atts.backgroundImage && !String(atts.backgroundImage.alt || '').trim()) {
			warnings.push(__('The map image has no alt text — add one in the Media Library.', 'wwf-scrollmap'));
		}
		points.forEach(function (p, i) {
			if (p.image && !String(p.image.alt || '').trim()) {
				warnings.push(__('Chapter', 'wwf-scrollmap') + ' ' + (i + 1) + ': ' + __('photo has no alt text.', 'wwf-scrollmap'));
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

		/* ---------------- immutable array ops -----------------------------
		   Everything flows through setAttributes, which is why undo/redo and
		   post revisions work without a line of code from me. */
		function update(i, patch) {
			setAtts({ points: points.map(function (p, j) { return j === i ? Object.assign({}, p, patch) : p; }) });
		}
		function add(wide) {
			setAtts({ points: points.concat([newPoint(wide)]) });
			setSelected(points.length);
		}
		function remove(i) {
			setAtts({ points: points.filter(function (_, j) { return j !== i; }) });
			setSelected(Math.max(0, i - 1));
		}
		function move(i, dir) {
			var j = i + dir;
			if (j < 0 || j >= points.length) return;
			var next = points.slice();
			next[i] = points[j]; next[j] = points[i];
			setAtts({ points: next });
			setSelected(j);
		}
		function duplicate(i) {
			var next = points.slice();
			next.splice(i + 1, 0, Object.assign({}, points[i], { id: uid() }));
			setAtts({ points: next });
			setSelected(i + 1);
		}
		function loadDemo() {
			setAtts({
				points: DEMO.map(function (p) { return Object.assign(newPoint(p.wide), p, { id: uid() }); }),
				sectionTitle: atts.sectionTitle || 'Tiger range countries'
			});
			setSelected(0);
		}

		/* ---------------- canvas pointer handling -------------------------
		   One handler set covers three gestures — draw a new region, move an
		   existing one, resize from a corner — and all three write through
		   clampBox, so a region can never end up outside the artwork. */
		function pct(evt) {
			var r = canvasRef.current.getBoundingClientRect();
			return {
				x: (evt.clientX - r.left) / r.width * 100,
				y: (evt.clientY - r.top) / r.height * 100
			};
		}

		function onDown(evt) {
			if (!canvasRef.current || !pt) return;
			var handle = evt.target.dataset ? evt.target.dataset.handle : null;
			var onBox = evt.target.classList && evt.target.classList.contains('wwfsm-box');

			if (drawing) {
				drag.current = { type: 'draw', from: pct(evt) };
			} else if (handle && pt.hotspot) {
				drag.current = { type: 'resize', corner: handle, from: pct(evt), box: pt.hotspot };
			} else if (onBox && pt.hotspot) {
				drag.current = { type: 'move', from: pct(evt), box: pt.hotspot };
			} else {
				return;
			}
			evt.preventDefault();
			if (evt.currentTarget.setPointerCapture) evt.currentTarget.setPointerCapture(evt.pointerId);
		}

		function onMove(evt) {
			var d = drag.current;
			if (!d) return;
			var p = pct(evt);
			var box;
			if (d.type === 'draw') {
				box = {
					x: Math.min(d.from.x, p.x), y: Math.min(d.from.y, p.y),
					w: Math.abs(p.x - d.from.x), h: Math.abs(p.y - d.from.y)
				};
			} else if (d.type === 'move') {
				box = { x: d.box.x + (p.x - d.from.x), y: d.box.y + (p.y - d.from.y), w: d.box.w, h: d.box.h };
			} else {
				var b = d.box;
				var x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
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
			if (live && live.w > 1 && live.h > 1) update(selected, { hotspot: clampBox(live) });
			setLive(null);
			if (d.type === 'draw') setDrawing(false);
		}

		/* ---------------- canvas ------------------------------------------ */
		var canvas;
		if (!atts.backgroundImage) {
			canvas = el(MediaPlaceholder, {
				icon: 'location-alt',
				labels: {
					title: __('Scroll Map', 'wwf-scrollmap'),
					instructions: __('Choose the map image to begin — everything else is built on top of it.', 'wwf-scrollmap')
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

					/* Where the camera will put the region, and where the card
					   will sit — the "nothing covers the text" rule, visible
					   while editing instead of only at preview time. */
					showGhost && pt && !pt.wide && el('div', { className: 'wwfsm-ghost', 'data-side': pt.side },
						el('span', null, __('region flies here', 'wwf-scrollmap'))),
					showGhost && pt && el('div', { className: 'wwfsm-ghostcard', 'data-side': pt.side },
						el('span', null, __('card', 'wwf-scrollmap'))),

					points.map(function (p, i) {
						var b = (i === selected && live) ? live : p.hotspot;
						if (!b) return null;
						var isSel = i === selected;
						return el('div', {
							key: p.id,
							className: 'wwfsm-box' + (isSel ? ' is-selected' : ''),
							style: {
								left: b.x + '%', top: b.y + '%', width: b.w + '%', height: b.h + '%',
								borderColor: atts.accentColor
							},
							onClick: function () { if (!drawing) setSelected(i); },
							title: (p.heading || __('Chapter', 'wwf-scrollmap')).split('\n').join(' ')
						},
							el('span', { className: 'wwfsm-box__n', style: { background: atts.accentColor } }, String(i + 1)),
							isSel ? ['tl', 'tr', 'bl', 'br'].map(function (k) {
								return el('i', { key: k, className: 'wwfsm-handle wwfsm-handle--' + k, 'data-handle': k });
							}) : null
						);
					}),

					drawing && el('div', { className: 'wwfsm-canvas__hint' },
						__('Drag a rectangle over the region you want to highlight', 'wwf-scrollmap'))
				),

				el('div', { className: 'wwfsm-canvasbar' },
					el('span', { className: 'wwfsm-canvasbar__t' }, pt
						? (__('Chapter', 'wwf-scrollmap') + ' ' + (selected + 1) + ' of ' + points.length)
						: __('No chapters yet', 'wwf-scrollmap')),
					pt && !pt.wide && el(Button, {
						variant: drawing ? 'primary' : 'secondary', size: 'small',
						onClick: function () { setDrawing(!drawing); }
					}, drawing ? __('Drawing…', 'wwf-scrollmap') : __('Draw region', 'wwf-scrollmap')),
					el(Button, {
						variant: 'tertiary', size: 'small',
						onClick: function () { setShowGhost(!showGhost); }
					}, showGhost ? __('Hide layout guide', 'wwf-scrollmap') : __('Show layout guide', 'wwf-scrollmap'))
				)
			);
		}

		/* ---------------- live card preview ------------------------------- */
		var preview = pt && el('div', { className: 'wwfsm-previewwrap' },
			el('p', { className: 'wwfsm-previewlabel' },
				__('Card preview — the heading and body are edited right here', 'wwf-scrollmap')),
			el('div', { className: 'wwfsm-preview', style: { background: atts.backdropColor } },
				el('div', {
						className: 'wwfsm-card' + (pt.wide ? ' is-wide' : ''),
						style: { background: atts.cardColor, color: atts.inkColor }
					},
					!pt.wide && el('div', { className: 'wwfsm-card__meta', style: { color: atts.accentColor } },
						el('span', { className: 'wwfsm-card__num' }, pt.number || '—'),
						el('span', null, pt.label || __('Region', 'wwf-scrollmap'))),
					pt.wide && pt.label && el('div', { className: 'wwfsm-card__eyebrow', style: { color: atts.accentColor } }, pt.label),
					el(TextareaControl, {
						className: 'wwfsm-f wwfsm-f--heading',
						label: __('Heading', 'wwf-scrollmap'),
						help: __('Press Enter for a line break — each line animates in separately.', 'wwf-scrollmap'),
						rows: 2,
						value: pt.heading,
						onChange: function (v) { update(selected, { heading: v }); }
					}),
					!pt.wide && el(TextControl, {
						className: 'wwfsm-f',
						label: __('Status chip (optional)', 'wwf-scrollmap'),
						placeholder: 'IUCN · Vulnerable',
						value: pt.status,
						onChange: function (v) { update(selected, { status: v }); }
					}),
					el(RichText, {
						tagName: 'div',
						multiline: 'p',
						className: 'wwfsm-card__body',
						placeholder: __('Write this chapter…', 'wwf-scrollmap'),
						value: pt.body,
						allowedFormats: ['core/bold', 'core/italic', 'core/link', 'core/underline'],
						onChange: function (v) { update(selected, { body: v }); }
					}),
					pt.image && el('figure', { className: 'wwfsm-card__figure' },
						el('img', { src: pt.image.url, alt: pt.image.alt || '' }),
						pt.caption && el('figcaption', null, pt.caption))
				)
			)
		);

		/* ---------------- sidebar ----------------------------------------- */
		function pair(k, v) { var o = {}; o[k] = v; return o; }
		function colorRow(label, key, fallback) {
			return el(BaseControl, { label: label },
				el(ColorPalette, {
					colors: PALETTE,
					value: atts[key] || fallback,
					clearable: false,
					onChange: function (v) { setAtts(pair(key, v || fallback)); }
				}));
		}

		var sidebar = el(InspectorControls, null,

			errors.length > 0 && el(PanelBody, { title: __('Fix before publishing', 'wwf-scrollmap'), initialOpen: true },
				el(Notice, { status: 'error', isDismissible: false },
					el('ul', { style: { margin: 0, paddingLeft: '18px' } },
						errors.map(function (m, i) { return el('li', { key: i }, m); })))),

			warnings.length > 0 && el(PanelBody, { title: __('Accessibility', 'wwf-scrollmap'), initialOpen: false },
				el(Notice, { status: 'warning', isDismissible: false },
					el('ul', { style: { margin: 0, paddingLeft: '18px' } },
						warnings.map(function (m, i) { return el('li', { key: i }, m); })))),

			el(PanelBody, { title: __('Map', 'wwf-scrollmap'), initialOpen: true },
				el(MediaUploadCheck, null,
					el(MediaUpload, {
						allowedTypes: ['image'],
						value: atts.backgroundImage ? atts.backgroundImage.id : undefined,
						onSelect: function (m) { setAtts({ backgroundImage: media(m) }); },
						render: function (o) {
							return el('div', { style: { marginBottom: '14px' } },
								atts.backgroundImage && el('img', {
									src: atts.backgroundImage.url, alt: '',
									style: { width: '100%', borderRadius: '4px', marginBottom: '8px', display: 'block' }
								}),
								el(Button, { variant: 'secondary', onClick: o.open },
									atts.backgroundImage ? __('Replace map image', 'wwf-scrollmap') : __('Choose map image', 'wwf-scrollmap')));
						}
					})),
				el(TextControl, {
					label: __('Section title', 'wwf-scrollmap'),
					help: __('Required. Names the section for screen readers and search engines — the visible title is usually part of the map artwork.', 'wwf-scrollmap'),
					value: atts.sectionTitle,
					onChange: function (v) { setAtts({ sectionTitle: v }); }
				}),
				el(RangeControl, {
					label: __('Framing — horizontal', 'wwf-scrollmap'),
					help: __('Which part of the map survives when it is cropped to the screen: 0 keeps the left edge, 100 the right.', 'wwf-scrollmap'),
					value: atts.focalX, min: 0, max: 100, step: 1,
					onChange: function (v) { setAtts({ focalX: v }); }
				}),
				el(RangeControl, {
					label: __('Framing — vertical', 'wwf-scrollmap'),
					value: atts.focalY, min: 0, max: 100, step: 1,
					onChange: function (v) { setAtts({ focalY: v }); }
				})
			),

			el(PanelBody, { title: __('Motion', 'wwf-scrollmap'), initialOpen: false },
				el(ToggleControl, {
					label: __('Paw-print trail between chapters', 'wwf-scrollmap'),
					checked: !!atts.showPaws,
					onChange: function (v) { setAtts({ showPaws: v }); }
				}),
				el(ToggleControl, {
					label: __('Numbered pins on the map', 'wwf-scrollmap'),
					checked: !!atts.showMarkers,
					onChange: function (v) { setAtts({ showMarkers: v }); }
				}),
				el(ToggleControl, {
					label: __('Chapter rail along the bottom', 'wwf-scrollmap'),
					checked: !!atts.showRail,
					onChange: function (v) { setAtts({ showRail: v }); }
				}),
				el('p', { className: 'wwfsm-hint' },
					__('Visitors whose device asks for reduced motion get the same content with the flights turned off — automatically.', 'wwf-scrollmap'))
			),

			el(PanelBody, { title: __('Colours', 'wwf-scrollmap'), initialOpen: false },
				colorRow(__('Accent', 'wwf-scrollmap'), 'accentColor', '#8fd14f'),
				colorRow(__('Text', 'wwf-scrollmap'), 'inkColor', '#f2efe6'),
				colorRow(__('Backdrop', 'wwf-scrollmap'), 'backdropColor', '#04140d'),
				colorRow(__('Card', 'wwf-scrollmap'), 'cardColor', '#071a11'),
				el(RangeControl, {
					label: __('How much the map dims outside the region', 'wwf-scrollmap'),
					value: atts.dimOpacity, min: 0, max: 1, step: 0.02,
					onChange: function (v) { setAtts({ dimOpacity: v }); }
				}),
				el(RangeControl, {
					label: __('Card opacity', 'wwf-scrollmap'),
					value: atts.cardOpacity, min: 0.3, max: 1, step: 0.02,
					onChange: function (v) { setAtts({ cardOpacity: v }); }
				})
			),

			el(PanelBody, { title: __('Chapters', 'wwf-scrollmap') + ' (' + points.length + ')', initialOpen: true },
				points.length === 0 && el(Notice, { status: 'info', isDismissible: false },
					__('Add a chapter, or load the tiger demo content to see a finished example.', 'wwf-scrollmap')),
				el('ul', { className: 'wwfsm-list' },
					points.map(function (p, i) {
						return el('li', {
							key: p.id,
							className: 'wwfsm-list__row' + (i === selected ? ' is-selected' : '') + (isEmpty(p) ? ' is-invalid' : '')
						},
							el('button', {
								type: 'button', className: 'wwfsm-list__label',
								onClick: function () { setSelected(i); }
							},
								el('span', { className: 'wwfsm-list__n' }, i + 1),
								el('span', { className: 'wwfsm-list__t' },
									(p.heading || '').split('\n').join(' ') ||
									(p.wide ? __('(text chapter)', 'wwf-scrollmap') : __('(untitled)', 'wwf-scrollmap'))),
								el('span', { className: 'wwfsm-list__k' }, p.wide ? 'TEXT' : 'MAP')),
							el(Button, { icon: 'arrow-up-alt2', label: __('Move up', 'wwf-scrollmap'), size: 'small', disabled: i === 0, onClick: function () { move(i, -1); } }),
							el(Button, { icon: 'arrow-down-alt2', label: __('Move down', 'wwf-scrollmap'), size: 'small', disabled: i === points.length - 1, onClick: function () { move(i, 1); } }),
							el(Button, { icon: 'admin-page', label: __('Duplicate', 'wwf-scrollmap'), size: 'small', onClick: function () { duplicate(i); } }),
							el(Button, {
								icon: 'trash', label: __('Remove', 'wwf-scrollmap'), size: 'small', isDestructive: true,
								onClick: function () { if (window.confirm(__('Remove this chapter?', 'wwf-scrollmap'))) remove(i); }
							})
						);
					})),
				el(ButtonGroup, { className: 'wwfsm-addrow' },
					el(Button, { variant: 'primary', onClick: function () { add(false); } }, __('+ Map chapter', 'wwf-scrollmap')),
					el(Button, { variant: 'secondary', onClick: function () { add(true); } }, __('+ Text chapter', 'wwf-scrollmap'))),
				points.length === 0 && el(Button, { variant: 'link', onClick: loadDemo, className: 'wwfsm-demo' },
					__('Load the tiger demo content', 'wwf-scrollmap'))
			),

			pt && el(PanelBody, { title: __('Chapter', 'wwf-scrollmap') + ' ' + (selected + 1), initialOpen: true },
				el(SelectControl, {
					label: __('Chapter type', 'wwf-scrollmap'),
					value: pt.wide ? 'wide' : 'map',
					options: [
						{ label: __('Map chapter — flies to a region', 'wwf-scrollmap'), value: 'map' },
						{ label: __('Text chapter — wide shot, no region', 'wwf-scrollmap'), value: 'wide' }
					],
					onChange: function (v) {
						update(selected, v === 'wide'
							? { wide: true, hotspot: null }
							: { wide: false, hotspot: pt.hotspot || { x: 40, y: 40, w: 16, h: 20 } });
					}
				}),
				el(SelectControl, {
					label: __('Card side', 'wwf-scrollmap'),
					help: __('The map region always flies to the opposite half, so the card can never cover it.', 'wwf-scrollmap'),
					value: pt.side,
					options: [
						{ label: __('Card right · map left', 'wwf-scrollmap'), value: 'right' },
						{ label: __('Card left · map right', 'wwf-scrollmap'), value: 'left' }
					],
					onChange: function (v) { update(selected, { side: v }); }
				}),
				el(TextControl, {
					label: __('Region label', 'wwf-scrollmap'),
					help: __('Shown on the badge over the map and in the chapter rail.', 'wwf-scrollmap'),
					value: pt.label,
					onChange: function (v) { update(selected, { label: v }); }
				}),
				!pt.wide && el(TextControl, {
					label: __('Number', 'wwf-scrollmap'),
					placeholder: '01',
					value: pt.number,
					onChange: function (v) { update(selected, { number: v }); }
				}),
				!pt.wide && el(SelectControl, {
					label: __('Status chip colour', 'wwf-scrollmap'),
					value: pt.statusLevel || '',
					options: [
						{ label: __('Neutral', 'wwf-scrollmap'), value: '' },
						{ label: __('Least concern (green)', 'wwf-scrollmap'), value: 'least' },
						{ label: __('Vulnerable (amber)', 'wwf-scrollmap'), value: 'vulnerable' },
						{ label: __('Endangered (coral)', 'wwf-scrollmap'), value: 'endangered' }
					],
					onChange: function (v) { update(selected, { statusLevel: v }); }
				}),

				el(MediaUploadCheck, null,
					el(MediaUpload, {
						allowedTypes: ['image'],
						value: pt.image ? pt.image.id : undefined,
						onSelect: function (m) { update(selected, { image: media(m) }); },
						render: function (o) {
							return el('div', { style: { margin: '12px 0' } },
								el(Button, { variant: 'secondary', onClick: o.open },
									pt.image ? __('Replace photo', 'wwf-scrollmap') : __('Add photo', 'wwf-scrollmap')),
								pt.image && el(Button, {
									variant: 'link', isDestructive: true, style: { marginLeft: '8px' },
									onClick: function () { update(selected, { image: null, caption: '' }); }
								}, __('Remove', 'wwf-scrollmap')));
						}
					})),
				pt.image && el(TextControl, {
					label: __('Photo caption / credit', 'wwf-scrollmap'),
					value: pt.caption,
					onChange: function (v) { update(selected, { caption: v }); }
				}),

				!pt.wide && el(Fragment, null,
					el('hr'),
					el(Button, {
						variant: drawing ? 'primary' : 'secondary',
						onClick: function () { setDrawing(!drawing); },
						style: { marginBottom: '10px' }
					}, drawing ? __('Drawing… drag on the map', 'wwf-scrollmap') : __('Draw the region on the map', 'wwf-scrollmap')),
					el('p', { className: 'wwfsm-hint' },
						__('Or drag the box on the map to move it, and its corners to resize. The numbers below stay in sync.', 'wwf-scrollmap')),
					el(RangeControl, {
						label: __('Zoom strength', 'wwf-scrollmap'),
						help: __('How hard the camera pushes in on this region.', 'wwf-scrollmap'),
						value: pt.zoom || 1, min: 0.4, max: 2.5, step: 0.05,
						onChange: function (v) { update(selected, { zoom: v }); }
					}),
					pt.hotspot && el('div', { className: 'wwfsm-nums' },
						['x', 'y', 'w', 'h'].map(function (k) {
							return el(TextControl, {
								key: k, label: k.toUpperCase() + ' %', type: 'number', step: 0.1,
								value: pt.hotspot[k],
								onChange: function (v) {
									var patch = {}; patch[k] = v;
									update(selected, { hotspot: clampBox(Object.assign({}, pt.hotspot, patch)) });
								}
							});
						}))
				)
			)
		);

		return el(Fragment, null,
			sidebar,
			el('div', useBlockProps({ className: 'wwfsm-editor' }),
				el('div', { className: 'wwfsm-head' },
					el('span', { className: 'wwfsm-badge' }, __('Scroll Map', 'wwf-scrollmap')),
					el('span', { className: 'wwfsm-headnote' },
						__('Click a numbered box to select a chapter · drag it to move · drag a corner to resize', 'wwf-scrollmap'))),
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
