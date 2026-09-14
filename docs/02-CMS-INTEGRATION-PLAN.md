# Task 2 — CMS Integration Plan

**Goal:** non-technical editors can add the "Scroll-Map" webpart to any page, fill in all
content, manage hotspots (add / edit / reorder / remove), and preview before publishing.

**Demo CMS: WordPress + custom Gutenberg block** (plugin `wwf-scrollmap`).
The data model below is deliberately CMS-agnostic — closing slide shows the same schema as a
SharePoint SPFx web part / Drupal paragraph / headless component.

---

## 1. Data model

One block = one webpart instance. Stored as **block attributes (JSON) inside post content**
(WordPress-native, versioned with post revisions — free undo/rollback). Images stored as
Media Library attachment IDs (not URLs) so renditions/alt come from the library.

```jsonc
{
  "sectionTitle": "Tiger range countries",        // admin label + aria-label
  "theme": "light",                               // light | dark
  "backgroundImage": { "id": 123, "alt": "…" },   // REQUIRED — desktop map
  "mobileImage":     { "id": 124, "alt": "…" },   // optional portrait crop; fallback: crop desktop
  "dimColor": "#000000",
  "dimOpacity": 0.5,
  "highlight": { "borderColor": "#2a6788", "borderWidth": 4, "transitionMs": 800 },
  "cardOpacity": 0.85,
  "points": [                                     // ordered — order == scroll order
    {
      "id": "uuid-1",                             // stable key for React + anchors
      "align": "center",                          // left | center | right
      "heading": "",                              // optional (intro has none)
      "body": "<p>We talk a lot about…</p>",      // RichText (limited: p/em/strong/a)
      "image": { "id": 201, "alt": "…", "caption": "Sambar foal… © Martin Harvey / WWF" },
      "hotspot": {                                // null → no spotlight (full-bright)
        "x": 48.5, "y": 43.0, "w": 17.1, "h": 39.3,   // % of image, 0–100
        "dot": null                               // optional {x, y} marker
      }
    }
    // …more points
  ]
}
```

Design decisions to defend:
- **% coordinates, not pixels** → resolution-independent; the same data renders on any
  rendition of the image and any viewport.
- **Attributes vs custom post type**: attributes keep the webpart portable (copy/paste
  between pages, works in patterns); a CPT would be right only if the same map were reused
  across many pages — mention as a variation ("Reusable block / pattern" already covers it).
- **IDs on points** → stable reordering, no key collisions.

## 2. Editor experience (what the editor sees)

### Inserting
`+` in the page editor → search "Scroll Map" → block inserted with placeholder state:
"Upload or select a background map image to begin." Block preview icon + description +
keywords (`map`, `scrollytelling`, `hotspot`) registered in `block.json`.

### Editing canvas (center)
- Shows the real map with the **card of the currently selected point** overlaid —
  true WYSIWYG since editor styles == front-end styles (same stylesheet enqueued
  via `editorStyle`).
- **Hotspot drawing mode:** with a point selected, the editor drags a rectangle
  directly on the map (a draggable/resizable box, like a crop tool). x/y/w/h update
  live; numeric inputs in the sidebar stay in sync for fine-tuning. This is the killer
  feature for non-technical users — nobody types coordinates.

### Sidebar (InspectorControls)
```
▸ Map
   [Background image]  [Mobile image]  (MediaUpload buttons + previews)
   Dim opacity  ── slider 0–1 (default .5)
   Highlight color / border / speed
▸ Points (8)                       ← repeater list
   ┌──────────────────────────────┐
   │ ⠿ 1  Intro          ⬆ ⬇ 🗑  │   ⠿ drag-handle reorder (or ⬆⬇ buttons)
   │ ⠿ 2  Sambar deer    ⬆ ⬇ 🗑  │   click row → selects point, canvas
   │ …                            │   scrolls to its card + shows its box
   └──────────────────────────────┘
   [+ Add point]
▸ Selected point
   Heading [___________]
   Body    [RichText]
   Image   [MediaUpload]  Caption [____]
   Align   (◉ left  ○ center  ○ right)
   Hotspot [x] enabled → x/y/w/h numeric inputs + "Draw on map" button
```

### Edit / Reorder / Remove hotspots — explicitly required by the brief
- **Add**: `+ Add point` appends with sensible defaults (center, no hotspot).
- **Edit**: select row → edit fields / redraw box on canvas.
- **Reorder**: drag handle (or up/down buttons — implemented with simple array
  splice on the attributes; both shown in demo).
- **Remove**: trash icon with confirm; deletion only affects the array, media stays
  in the library.

### Preview before publishing
Native WordPress flow — no custom work needed, but demo it explicitly:
1. In-editor: the canvas itself is a live preview (shared CSS).
2. **Preview → Open in new tab**: full front-end render of the draft, desktop/tablet/
   mobile toggles in the preview toolbar.
3. Publish gate: validation (below) blocks publish with inline errors.

## 3. Rendering pipeline

- **Server-side render** (`render.php` registered in `block.json`): PHP receives the
  attributes and outputs the exact same semantic markup as the standalone Task 1 file.
  SEO-friendly, no client-side hydration needed, works with caching/CDN.
- Front-end assets: one small CSS + one small JS (IntersectionObserver engine),
  enqueued **once** per page regardless of how many instances (`viewScript` handles
  this automatically); the JS boots every `.wwf-scrollmap` on the page independently
  → multiple instances per page supported.
- Data reaches JS via `data-*` attributes / an inline `<script type="application/json">`
  per instance — no REST round-trip on the front end.
- Images: `wp_get_attachment_image()` → automatic `srcset`/`sizes`, lazy-loading,
  alt text from the media library.
- Renders correctly (static, first point visible, no spotlight) if JS fails —
  progressive enhancement.

## 4. Validation (enforced in editor + on save)

| Rule | Where | Behavior |
|---|---|---|
| Background image required | editor | placeholder state until set; publish blocked with notice |
| ≥ 1 point required | editor | "Add at least one point" inline warning |
| Point needs heading OR body | editor | row flagged red in the repeater |
| Hotspot bounds 0 ≤ x,y ≤ 100, x+w ≤ 100, y+h ≤ 100 | input + `useEffect` clamp | values clamped live; can't draw outside image |
| Alt text present on images | editor | warning (soft — a11y nudge, mirrors WP core) |
| Rich text sanitization | save + server | allowed tags only (`p em strong a u`), `esc_url` on links, `wp_kses` on render — no script injection via content |
| Colors valid hex, opacity 0–1 | control types enforce | n/a |

Hard rules (`required`) block publish via `useEntityProp` lock + editor notice;
soft rules only warn.

## 5. Responsiveness

- Same breakpoints as the rebuild: <620 / 620 / 900 / 1100.
- ≥900px: pinned map + traveling spotlight (desktop behavior).
- <900px: `mobileImage` (portrait) if provided, else the desktop map `object-fit:cover`
  center-crop; cards full-width (12 col), spotlight replaced by full-bright map — matching
  the original's mobile variant. One component, CSS switch — **not** two content entries
  (editors enter content once; the original's duplicated desktop/mobile sections are a
  Shorthand artifact we improve on).
- Editor preview toggles (desktop/tablet/mobile) show both modes before publish.

## 6. Reusability

- Distributed as a **plugin**, not theme code → survives theme switches, installable
  on any WP site.
- All colors/spacings are CSS custom properties scoped to `.wwf-scrollmap` →
  themable per instance from block settings without touching CSS.
- Multiple instances per page; works inside patterns and reusable blocks
  (synced patterns) for org-wide reuse.
- Content is plain JSON → exportable/migratable (WXR export carries it; a small
  script can transform it to any other CMS schema).

## 7. Portability slide (if asked "but we use X")

| CMS | Same architecture maps to |
|---|---|
| SharePoint | SPFx web part; property pane = sidebar; web part properties = attributes JSON; React canvas identical |
| Drupal | Paragraph type "Scroll map" + nested "Point" paragraphs; Twig template = render.php |
| Umbraco | Block List editor + content models; Razor partial renders |
| Headless (Contentful/Strapi/Sanity) | Component + repeatable "Point" entries; front end consumes JSON — our standalone JS engine is already framework-free |

## 8. Technical steps to implement (WP demo)

1. Scaffold: `npx @wordpress/create-block wwf-scrollmap` (block.json, build tooling).
2. Define attributes schema (above) in `block.json`; `supports: { multiple: true }`.
3. Build `edit.js`: MediaUpload controls, points repeater (`useState` selection +
   attribute array ops), hotspot draw layer (pointer events → % math), RichText for body.
4. `render.php`: markup identical to standalone `index.html` structure; `wp_kses` output.
5. `view.js` + `style.css`: copy the standalone engine verbatim (it was written
   dependency-free precisely so it drops into any CMS).
6. Local run: `docker compose up` (wordpress + mysql), map plugin folder as volume.
7. Seed a demo page with the tiger data; rehearse add → edit → reorder → remove →
   preview → publish.
