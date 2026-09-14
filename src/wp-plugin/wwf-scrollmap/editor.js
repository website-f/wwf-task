/**
 * wwf/scrollmap — block editor UI.
 *
 * Deliberately built WITHOUT a build step (no JSX/webpack): plain
 * wp.element.createElement against WordPress globals, so the plugin runs by
 * dropping the folder into wp-content/plugins. In a long-lived codebase this
 * would be JSX + @wordpress/scripts; the architecture is identical.
 *
 * Editor model:
 *   · canvas  = the real map + numbered hotspot boxes + drag-to-draw layer
 *   · sidebar = map/design settings, points repeater (add/reorder/remove),
 *               selected-point fields (align, image, caption, hotspot numbers)
 *   · card preview under the canvas = inline heading + rich body editing
 *   · publish is locked while the required background image is missing
 */
(function (wp) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;

	var registerBlockType = wp.blocks.registerBlockType;

	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var MediaUpload = wp.blockEditor.MediaUpload;
	var MediaUploadCheck = wp.blockEditor.MediaUploadCheck;
	var MediaPlaceholder = wp.blockEditor.MediaPlaceholder;
	var RichText = wp.blockEditor.RichText;

	var PanelBody = wp.components.PanelBody;
	var Button = wp.components.Button;
	var TextControl = wp.components.TextControl;
	var RangeControl = wp.components.RangeControl;
	var RadioControl = wp.components.RadioControl;
	var ToggleControl = wp.components.ToggleControl;
	var Notice = wp.components.Notice;

	var __ = wp.i18n.__;

	/* ---------------------------------------------------------------- utils */

	function uid() {
		return 'pt-' + Math.random().toString(36).slice(2, 9);
	}

	function clamp(n, min, max) {
		n = parseFloat(n);
		if (isNaN(n)) n = min;
		return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
	}

	/* Bounds rule: 0 ≤ x,y ≤ 100, sizes ≥ 2%, and the box may not leave the
	   image (x+w ≤ 100, y+h ≤ 100). Applied on every write path — numeric
	   inputs, drawing, and again server-side in render.php.                 */
	function clampBox(b) {
		var w = clamp(b.w, 2, 100);
		var h = clamp(b.h, 2, 100);
		var x = clamp(b.x, 0, 100 - w);
		var y = clamp(b.y, 0, 100 - h);
		return { x: x, y: y, w: w, h: h };
	}

	function newPoint() {
		return {
			id: uid(),
			align: 'center',
			heading: '',
			body: '',
			image: null,
			caption: '',
			hotspot: null
		};
	}

	/* Demo seed — the original story's real content and measured hotspots,
	   so a reviewer can see full parity in one click (images attach from
	   the media library afterwards).                                        */
	var DEMO_POINTS = [
		{ align: 'center', heading: '', hotspot: null,
			body: '<p>We talk a lot about <em>tiger prey</em>, but what animals do tigers eat?</p><p>The most important tiger prey are often ungulates, which are mammals with hooves, such as large deer, wild cattle, and wild pigs. Let’s take a look at some of the places where tiger prey are found.</p>' },
		{ align: 'right', heading: 'Sambar deer', hotspot: { x: 48.5, y: 43, w: 17.1, h: 39.3 },
			body: '<p>Sambar deer are one of the most important tiger prey species. They are often abundant in tiger reserves in India and Nepal. They can also be found across Southeast Asia but are much rarer in the region due to hunting. The IUCN lists sambar deer as Vulnerable.</p>',
			caption: 'Sambar foal and its mother in Ranthambore Tiger Reserve, India © Martin Harvey / WWF' },
		{ align: 'left', heading: 'Wild pig', hotspot: { x: 66.5, y: 79.4, w: 20, h: 20.6 },
			body: '<p>Wild pigs are the most widely distributed tiger prey species and can be commonly found across Asia and occur in every landscape in which tigers are found. On the island of Sumatra (Indonesia) they are one of the most important tiger prey species.</p>',
			caption: 'Wild boar have brown fur that provides excellent camouflage in the forest. © Ola Jennersten / WWF-Sweden' },
		{ align: 'right', heading: 'Banteng', hotspot: { x: 66.2, y: 55.5, w: 14, h: 18.3 },
			body: '<p>One of the larger tiger prey species is the banteng, these are large wild cattle and are classified as Endangered by the IUCN. In Thailand, there are signs of hope with populations increasing.</p>',
			caption: 'A male banteng photographed in Kuiburi National Park, Thailand. © Wayuphong Jitvijak / WWF-Greater Mekong' },
		{ align: 'right', heading: 'Bukhara deer', hotspot: { x: 52, y: 16, w: 15.5, h: 20 },
			body: '<p>In Central Asia a different set of species are important for tiger prey including bukhara deer. Restoring healthy bukhara deer numbers will be key to a landmark tiger reintroduction project in Kazakhstan.</p>',
			caption: 'Newly released bukhara deer, Kazakhstan. © WWF' },
		{ align: 'right', heading: 'Nilgai', hotspot: { x: 46.2, y: 42, w: 17.7, h: 33.9 },
			body: '<p>Commonly found in India, Nilgai are the largest antelope found in Asia. This tiger prey weighs in at roughly 100-288 kg depending whether it’s male or female.</p>',
			caption: 'Nilgai spotted in Ranthambore Tiger Reserve, India. © Ola Jennersten / WWF-Sweden' },
		{ align: 'left', heading: 'Chital', hotspot: { x: 56.4, y: 40.7, w: 11.4, h: 14.8 },
			body: '<p>Also known as spotted deer, chital are an important and abundant prey species for tigers in India and Nepal, and are listed as Least Concern by the IUCN.</p>',
			caption: 'Chital recorded on camera traps in the Khata Corridor, Nepal. © DoFSC / WWF Nepal' },
		{ align: 'center', heading: '', hotspot: null,
			body: '<p>These are just a few examples of the many tiger prey species — other important ungulates include gaur, roe deer, sika deer, hog deer, muntjac, barasingha, and eld’s deer.</p>' }
	];

	/* ------------------------------------------------------------------ edit */

	function Edit(props) {
		var atts = props.attributes;
		var setAtts = props.setAttributes;
		var points = atts.points || [];

		var state = useState(0);
		var selected = Math.min(state[0], Math.max(0, points.length - 1));
		var setSelected = state[1];

		var drawState = useState(false);
		var drawing = drawState[0], setDrawing = drawState[1];

		var dragState = useState(null);          // {x,y,w,h} while dragging
		var dragRect = dragState[0], setDragRect = dragState[1];
		var dragStart = useRef(null);
		var canvasRef = useRef(null);

		/* -- validation: block publishing until the required map is set ---- */
		useEffect(function () {
			try {
				var ed = wp.data.dispatch('core/editor');
				if (!ed || !ed.lockPostSaving) return;
				if (!atts.backgroundImage) ed.lockPostSaving('wwf-scrollmap');
				else ed.unlockPostSaving('wwf-scrollmap');
			} catch (e) { /* site/widget editor without core/editor store */ }
		}, [atts.backgroundImage]);

		/* -- immutable helpers -------------------------------------------- */
		function updatePoint(i, patch) {
			setAtts({ points: points.map(function (p, j) {
				return j === i ? Object.assign({}, p, patch) : p;
			}) });
		}
		function addPoint() {
			setAtts({ points: points.concat([newPoint()]) });
			setSelected(points.length);
		}
		function removePoint(i) {
			setAtts({ points: points.filter(function (_, j) { return j !== i; }) });
			setSelected(Math.max(0, i - 1));
		}
		function movePoint(i, dir) {
			var j = i + dir;
			if (j < 0 || j >= points.length) return;
			var next = points.slice();
			var tmp = next[i]; next[i] = next[j]; next[j] = tmp;
			setAtts({ points: next });
			setSelected(j);
		}
		function loadDemo() {
			setAtts({ points: DEMO_POINTS.map(function (p) {
				return Object.assign(newPoint(), p, { id: uid() });
			}) });
			setSelected(0);
		}

		/* -- drag-to-draw a hotspot on the canvas -------------------------- */
		function pctPoint(evt) {
			var r = canvasRef.current.getBoundingClientRect();
			return {
				x: clamp((evt.clientX - r.left) / r.width * 100, 0, 100),
				y: clamp((evt.clientY - r.top) / r.height * 100, 0, 100)
			};
		}
		function onPointerDown(evt) {
			if (!drawing || !canvasRef.current) return;
			evt.preventDefault();
			evt.target.setPointerCapture && evt.target.setPointerCapture(evt.pointerId);
			dragStart.current = pctPoint(evt);
			setDragRect(null);
		}
		function onPointerMove(evt) {
			if (!drawing || !dragStart.current) return;
			var a = dragStart.current, b = pctPoint(evt);
			setDragRect({
				x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
				w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y)
			});
		}
		function onPointerUp() {
			if (!drawing || !dragStart.current) return;
			if (dragRect && dragRect.w > 1 && dragRect.h > 1) {
				updatePoint(selected, { hotspot: clampBox(dragRect) });
			}
			dragStart.current = null;
			setDragRect(null);
			setDrawing(false);
		}

		var pt = points[selected] || null;

		/* -- canvas --------------------------------------------------------- */
		var canvas;
		if (!atts.backgroundImage) {
			canvas = el(MediaPlaceholder, {
				icon: 'location-alt',
				labels: {
					title: __('Scroll Map — background image', 'wwf-scrollmap'),
					instructions: __('Upload or select the map image to begin. This field is required.', 'wwf-scrollmap')
				},
				accept: 'image/*',
				allowedTypes: ['image'],
				onSelect: function (media) {
					setAtts({ backgroundImage: {
						id: media.id, url: media.url, alt: media.alt || '',
						width: media.width, height: media.height
					} });
				}
			});
		} else {
			canvas = el('div', {
					className: 'wwfsm-canvas' + (drawing ? ' is-drawing' : ''),
					ref: canvasRef,
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerUp
				},
				el('img', { src: atts.backgroundImage.url, alt: '', draggable: false }),
				/* numbered hotspot outlines for every point that has one */
				points.map(function (p, i) {
					if (!p.hotspot) return null;
					return el('button', {
						key: p.id,
						type: 'button',
						className: 'wwfsm-box' + (i === selected ? ' is-selected' : ''),
						style: {
							left: p.hotspot.x + '%', top: p.hotspot.y + '%',
							width: p.hotspot.w + '%', height: p.hotspot.h + '%',
							borderColor: atts.highlightColor
						},
						onClick: function () { if (!drawing) setSelected(i); },
						title: (p.heading || __('Point', 'wwf-scrollmap')) + ' #' + (i + 1)
					}, el('span', { className: 'wwfsm-box__n' }, String(i + 1)));
				}),
				/* live rubber-band while drawing */
				dragRect && el('div', {
					className: 'wwfsm-box is-selected is-drafting',
					style: {
						left: dragRect.x + '%', top: dragRect.y + '%',
						width: dragRect.w + '%', height: dragRect.h + '%',
						borderColor: atts.highlightColor
					}
				}),
				drawing && el('div', { className: 'wwfsm-canvas__hint' },
					__('Drag a rectangle over the region to spotlight', 'wwf-scrollmap'))
			);
		}

		/* -- inline card preview (heading + rich body of selected point) ---- */
		var cardPreview = pt && el('div', { className: 'wwfsm-cardwrap', 'data-align': pt.align },
			el('div', { className: 'wwfsm-card', style: { background: 'rgba(255,255,255,' + atts.cardOpacity + ')' } },
				el('input', {
					className: 'wwfsm-card__heading',
					type: 'text',
					placeholder: __('Heading (optional)', 'wwf-scrollmap'),
					value: pt.heading,
					onChange: function (evt) { updatePoint(selected, { heading: evt.target.value }); }
				}),
				el(RichText, {
					tagName: 'div',
					multiline: 'p',
					className: 'wwfsm-card__body',
					placeholder: __('Write the story text for this point…', 'wwf-scrollmap'),
					value: pt.body,
					allowedFormats: ['core/bold', 'core/italic', 'core/link', 'core/underline'],
					onChange: function (val) { updatePoint(selected, { body: val }); }
				}),
				pt.image && el('figure', { className: 'wwfsm-card__figure' },
					el('img', { src: pt.image.url, alt: pt.image.alt || '' }),
					pt.caption && el('figcaption', null, pt.caption)
				)
			)
		);

		/* -- sidebar --------------------------------------------------------- */
		var sidebar = el(InspectorControls, null,

			el(PanelBody, { title: __('Map & design', 'wwf-scrollmap'), initialOpen: true },
				!atts.backgroundImage && el(Notice, { status: 'warning', isDismissible: false },
					__('A background image is required — publishing is locked until one is set.', 'wwf-scrollmap')),
				el(MediaUploadCheck, null,
					el(MediaUpload, {
						allowedTypes: ['image'],
						value: atts.backgroundImage ? atts.backgroundImage.id : undefined,
						onSelect: function (media) {
							setAtts({ backgroundImage: {
								id: media.id, url: media.url, alt: media.alt || '',
								width: media.width, height: media.height
							} });
						},
						render: function (o) {
							return el(Button, { variant: 'secondary', onClick: o.open, style: { marginBottom: '12px' } },
								atts.backgroundImage ? __('Replace map image', 'wwf-scrollmap') : __('Select map image', 'wwf-scrollmap'));
						}
					})
				),
				el(TextControl, {
					label: __('Section label (accessibility)', 'wwf-scrollmap'),
					value: atts.sectionTitle,
					onChange: function (v) { setAtts({ sectionTitle: v }); }
				}),
				el(RadioControl, {
					label: __('Animation style', 'wwf-scrollmap'),
					help: __('Cinematic: camera zooms to each region, glow pulse, progress rail. Faithful: the original Shorthand spotlight only.', 'wwf-scrollmap'),
					selected: atts.mode || 'cinematic',
					options: [
						{ label: __('Cinematic (zoom + spotlight)', 'wwf-scrollmap'), value: 'cinematic' },
						{ label: __('Faithful (spotlight only)', 'wwf-scrollmap'), value: 'faithful' }
					],
					onChange: function (v) { setAtts({ mode: v }); }
				}),
				el(RangeControl, {
					label: __('Dim opacity', 'wwf-scrollmap'),
					value: atts.dimOpacity, min: 0, max: 1, step: 0.05,
					onChange: function (v) { setAtts({ dimOpacity: v }); }
				}),
				el(TextControl, {
					label: __('Highlight colour (hex)', 'wwf-scrollmap'),
					value: atts.highlightColor,
					onChange: function (v) { setAtts({ highlightColor: v }); }
				}),
				el(RangeControl, {
					label: __('Highlight border (px)', 'wwf-scrollmap'),
					value: atts.highlightWidth, min: 0, max: 10,
					onChange: function (v) { setAtts({ highlightWidth: v }); }
				}),
				el(RangeControl, {
					label: __('Spotlight travel (ms)', 'wwf-scrollmap'),
					value: atts.travelMs, min: 0, max: 2000, step: 50,
					onChange: function (v) { setAtts({ travelMs: v }); }
				}),
				el(RangeControl, {
					label: __('Card opacity', 'wwf-scrollmap'),
					value: atts.cardOpacity, min: 0.3, max: 1, step: 0.05,
					onChange: function (v) { setAtts({ cardOpacity: v }); }
				})
			),

			el(PanelBody, { title: __('Points', 'wwf-scrollmap') + ' (' + points.length + ')', initialOpen: true },
				points.length === 0 && el(Notice, { status: 'info', isDismissible: false },
					__('Add at least one point, or load the demo content.', 'wwf-scrollmap')),
				el('ul', { className: 'wwfsm-list' },
					points.map(function (p, i) {
						return el('li', { key: p.id, className: 'wwfsm-list__row' + (i === selected ? ' is-selected' : '') },
							el('button', {
								type: 'button', className: 'wwfsm-list__label',
								onClick: function () { setSelected(i); }
							}, (i + 1) + '. ' + (p.heading || (p.hotspot ? __('(untitled point)', 'wwf-scrollmap') : __('(text card)', 'wwf-scrollmap')))),
							el(Button, { icon: 'arrow-up-alt2',   label: __('Move up', 'wwf-scrollmap'),   isSmall: true, disabled: i === 0, onClick: function () { movePoint(i, -1); } }),
							el(Button, { icon: 'arrow-down-alt2', label: __('Move down', 'wwf-scrollmap'), isSmall: true, disabled: i === points.length - 1, onClick: function () { movePoint(i, 1); } }),
							el(Button, { icon: 'trash', label: __('Remove', 'wwf-scrollmap'), isSmall: true, isDestructive: true,
								onClick: function () {
									if (window.confirm(__('Remove this point?', 'wwf-scrollmap'))) removePoint(i);
								} })
						);
					})
				),
				el(Button, { variant: 'primary', onClick: addPoint }, __('+ Add point', 'wwf-scrollmap')),
				points.length === 0 && el(Button, { variant: 'link', onClick: loadDemo, style: { marginLeft: '10px' } },
					__('Load tiger demo content', 'wwf-scrollmap'))
			),

			pt && el(PanelBody, { title: __('Selected point', 'wwf-scrollmap') + ' — #' + (selected + 1), initialOpen: true },
				el(RadioControl, {
					label: __('Card position', 'wwf-scrollmap'),
					selected: pt.align,
					options: [
						{ label: __('Left', 'wwf-scrollmap'), value: 'left' },
						{ label: __('Center', 'wwf-scrollmap'), value: 'center' },
						{ label: __('Right', 'wwf-scrollmap'), value: 'right' }
					],
					onChange: function (v) { updatePoint(selected, { align: v }); }
				}),
				el(MediaUploadCheck, null,
					el(MediaUpload, {
						allowedTypes: ['image'],
						value: pt.image ? pt.image.id : undefined,
						onSelect: function (media) {
							updatePoint(selected, { image: { id: media.id, url: media.url, alt: media.alt || '' } });
						},
						render: function (o) {
							return el('div', { style: { marginBottom: '12px' } },
								el(Button, { variant: 'secondary', onClick: o.open },
									pt.image ? __('Replace card image', 'wwf-scrollmap') : __('Add card image', 'wwf-scrollmap')),
								pt.image && el(Button, { variant: 'link', isDestructive: true, style: { marginLeft: '8px' },
									onClick: function () { updatePoint(selected, { image: null, caption: '' }); } },
									__('Remove', 'wwf-scrollmap'))
							);
						}
					})
				),
				pt.image && el(TextControl, {
					label: __('Image caption / credit', 'wwf-scrollmap'),
					value: pt.caption,
					onChange: function (v) { updatePoint(selected, { caption: v }); }
				}),
				el(ToggleControl, {
					label: __('Spotlight a region of the map', 'wwf-scrollmap'),
					checked: !!pt.hotspot,
					onChange: function (on) {
						updatePoint(selected, { hotspot: on ? { x: 40, y: 40, w: 20, h: 20 } : null });
						setDrawing(false);
					}
				}),
				pt.hotspot && el(Fragment, null,
					el(Button, {
						variant: drawing ? 'primary' : 'secondary',
						onClick: function () { setDrawing(!drawing); },
						style: { marginBottom: '12px' }
					}, drawing ? __('Drawing… drag on the map', 'wwf-scrollmap') : __('Draw region on map', 'wwf-scrollmap')),
					el(RangeControl, { label: 'X (%)', value: pt.hotspot.x, min: 0, max: 100, step: 0.1,
						onChange: function (v) { updatePoint(selected, { hotspot: clampBox(Object.assign({}, pt.hotspot, { x: v })) }); } }),
					el(RangeControl, { label: 'Y (%)', value: pt.hotspot.y, min: 0, max: 100, step: 0.1,
						onChange: function (v) { updatePoint(selected, { hotspot: clampBox(Object.assign({}, pt.hotspot, { y: v })) }); } }),
					el(RangeControl, { label: __('Width (%)', 'wwf-scrollmap'), value: pt.hotspot.w, min: 2, max: 100, step: 0.1,
						onChange: function (v) { updatePoint(selected, { hotspot: clampBox(Object.assign({}, pt.hotspot, { w: v })) }); } }),
					el(RangeControl, { label: __('Height (%)', 'wwf-scrollmap'), value: pt.hotspot.h, min: 2, max: 100, step: 0.1,
						onChange: function (v) { updatePoint(selected, { hotspot: clampBox(Object.assign({}, pt.hotspot, { h: v })) }); } })
				)
			)
		);

		return el(Fragment, null,
			sidebar,
			el('div', useBlockProps({ className: 'wwfsm-editor' }),
				canvas,
				cardPreview
			)
		);
	}

	registerBlockType('wwf/scrollmap', {
		edit: Edit,
		save: function () { return null; }   // dynamic block — render.php owns output
	});

})(window.wp);
