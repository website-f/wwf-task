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
  // ---- the map --------------------------------------------------------
  "sectionTitle": "Tiger range countries",      // REQUIRED, screen-reader <h2> + aria-label
  "backgroundImage": { "id": 4, "url": "…", "alt": "…" },  // REQUIRED, media-library ID
  "focalX": 0, "focalY": 50,                    // % — which part survives the cover crop

  // ---- motion (editor switches) ---------------------------------------
  "showPaws": true, "showMarkers": true, "showRail": true,

  // ---- design tokens --------------------------------------------------
  "accentColor": "#8fd14f", "inkColor": "#f2efe6",
  "backdropColor": "#04140d", "cardColor": "#071a11",
  "dimOpacity": 0.62, "cardOpacity": 0.84,

  // ---- the story: ordered, order == scroll order -----------------------
  "points": [
    {
      "id": "pt-sambar",          // stable key: survives reordering
      "wide": false,              // true = wide establishing shot, no region
      "side": "right",            // which half the CARD occupies; region flies to the other
      "label": "India & Nepal",   // region badge + chapter rail
      "number": "01",
      "heading": "Sambar\ndeer",  // newlines = masked reveal lines
      "status": "IUCN · Vulnerable",
      "statusLevel": "vulnerable",// '' | least | vulnerable | endangered → chip colour
      "body": "<p>…</p>",         // RichText, kses-limited to p/br/em/strong/u/a
      "image": { "id": 5, "url": "…", "alt": "…" },
      "caption": "… © Martin Harvey / WWF",
      "zoom": 1,                  // how hard the camera pushes in
      "hotspot": { "x": 48.5, "y": 43, "w": 17.1, "h": 39.3 }   // % of the image, or null
    }
    // …more chapters
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

### 1a. What is built vs what is planned

Everything in the model above is implemented and running at `localhost:8280`. Two things in
this plan are deliberately *not* built, and I would rather name them than let them be found:

| Plan item | Status |
|---|---|
| Every attribute above, incl. focal point, the three motion switches and four colours | ✅ built (`block.json`) |
| Draw / move / resize a region on the map; numeric fields in sync; clamped on both sides | ✅ built (`editor.js`, verified with scripted mouse events) |
| Chapters: add (map or text), reorder, duplicate, remove | ✅ built — **↑ ↓ buttons**, not a drag handle |
| Validation: hard rules lock Publish with reasons; soft a11y warnings never block | ✅ built |
| Live card preview with inline heading / status / rich body | ✅ built |
| Layout guide showing where region and card will land | ✅ built |
| Preview before publish | ✅ native WordPress draft preview + device toggles |
| Server render sharing the Task 1 markup, stylesheet and engine | ✅ built |
| Separate portrait `mobileImage` | ⛔ not built — the phone layout flies the one map inside a 45vh window instead, so editors enter content once. A `mobileImage` field is the refinement if art direction ever demands it |
| Drag-handle reordering | ⛔ not built — ↑↓ is keyboard- and screen-reader-accessible with no extra work; drag-and-drop is not |

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
▸ Fix before publishing            ← only appears when something is blocking
▸ Accessibility                    ← soft warnings (missing alt text)
▸ Map
   [map thumbnail]  [Replace map image]
   Section title  [__________________]   (required)
   Framing — horizontal  ──●────  0      (0 = keep the left edge)
   Framing — vertical    ────●──  50
▸ Motion
   [x] Paw-print trail between chapters
   [x] Numbered pins on the map
   [x] Chapter rail along the bottom
▸ Colours
   Accent / Text / Backdrop / Card  (brand palette + custom)
   Dim outside the region  ─────●──
   Card opacity            ──────●─
▸ Chapters (8)
   ┌────────────────────────────────────┐
   │ ① What do tigers eat?  TEXT ↑↓⧉🗑 │  click a row → selects it
   │ ② Sambar deer          MAP  ↑↓⧉🗑 │  red outline = missing text
   │ …                                  │
   └────────────────────────────────────┘
   [+ Map chapter] [+ Text chapter]
▸ Chapter 2
   Chapter type  (Map chapter ▾)
   Card side     (Card right · map left ▾)
   Region label  [India & Nepal]     Number [01]
   Status chip colour (Vulnerable ▾)
   [Add photo]  Caption [__________]
   ── [Draw the region on the map] ──
   Zoom strength ────●──
   X 48.5   Y 43     W 17.1   H 39.3
```

### Edit / Reorder / Remove hotspots — explicitly required by the brief
- **Add**: `+ Add point` appends with sensible defaults (center, no hotspot).
- **Edit**: select row → edit fields / redraw box on canvas.
- **Reorder**: up/down buttons (immutable array swap on the attribute). A drag handle is
  the obvious next step; ↑↓ was chosen because it is keyboard- and screen-reader-accessible
  out of the box, which drag-and-drop is not without extra work.
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
- Front-end assets: one stylesheet and one engine, enqueued **once** per page however many
  instances (`viewScript` handles that), plus GSAP + ScrollTrigger **vendored in the plugin**
  and registered as ordinary WordPress script handles — no CDN in the runtime path, version
  pinned by the deploy, and deduplicated if another plugin also wants GSAP. The engine boots
  every `[data-tgr]` section independently, so several blocks per page work.
- Data reaches JS via `data-*` attributes (`data-focal`, `data-paws/markers/rail`, and per
  chapter `data-side`, `data-zoom`, `data-label`, `data-hotspot='{"x":…,"y":…,"w":…,"h":…}'`)
  — no REST round-trip, and the identical contract the standalone Task 1 file uses.
- Design tokens go out as inline CSS custom properties on the section, so per-instance
  theming needs no extra stylesheet.
- Images: `wp_get_attachment_image()` → automatic `srcset`/`sizes`, lazy-loading,
  alt text from the media library.
- If JS fails or GSAP doesn't load, `.tgr:not(.is-ready)` undoes the sticky overlay: the map
  renders statically with readable cards stacked beneath it. Content first.

## 4. Validation (enforced in editor + on save)

| Rule | Where | Behavior |
|---|---|---|
| Background image required | editor | placeholder state until set; publish blocked with notice |
| Section title required | editor | publish blocked; inline warning under the field |
| ≥ 1 point required | editor | publish blocked; "Add at least one point" inline notice |
| Point needs heading OR body | editor | publish blocked; the offending row is flagged red in the repeater with "— needs text" |
| Hotspot bounds 0 ≤ x,y ≤ 100, x+w ≤ 100, y+h ≤ 100 | input + `useEffect` clamp | values clamped live; can't draw outside image |
| Alt text present on map + card images | editor | soft warning list in the sidebar — never blocks publish (an a11y nudge, mirroring WP core's behaviour) |
| Rich text sanitization | save + server | allowed tags only (`p em strong a u`), `esc_url` on links, `wp_kses` on render — no script injection via content |
| Colors valid hex, opacity 0–1 | control types enforce | n/a |

Hard rules (`required`) block publish via `useEntityProp` lock + editor notice;
soft rules only warn.

## 5. Responsiveness

- Same breakpoints as the rebuild: <620 / 620 / 900 / 1100.
- ≥900px: pinned map + traveling spotlight (desktop behavior).
- **<900px the layout changes shape, not just size.** The stage becomes a **45vh map window
  stuck to the top** of the screen, and the cards are **pinned** in the 55vh beneath it,
  sliding in sideways like a carousel — in from the right, out to the left. 45 + 55 = 100: the
  map and the cards are two separate boxes that add up to the screen, so the card cannot reach
  the map. The camera still flies and zooms inside that window, driven by the same hotspot
  data. One component, one content entry, **not** the original's duplicated hand-cropped
  portrait section.
- The breakpoint is a `gsap.matchMedia()` context: crossing 900px reverts one set of
  ScrollTriggers and builds the other, with no stale state left behind.
- Editor preview toggles (desktop/tablet/mobile) show both modes before publish.

## 6. Reusability

- Distributed as a **plugin**, not theme code → survives theme switches, installable
  on any WP site.
- All colors/spacings are CSS custom properties scoped to the `.scrollmap` section →
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
