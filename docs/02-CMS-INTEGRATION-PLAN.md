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
  // ── the fields the brief names, and nothing else at this level ─────────
  "sectionTitle": "What do\ntigers eat?",   // REQUIRED — big heading on the
                                            // opening card + the accessible name.
                                            // Newlines are the reveal's line breaks.
  "leadText":     "We talk a lot about…",    // the introduction. One paragraph per line.
  "closingText":  "These are just a few…",   // optional final card
  "backgroundImage": { "id": 4, "url": "…", "alt": "…" },   // REQUIRED — the map

  "hotspots": [                              // ordered; order == scroll order
    {
      "id": "hs-sambar",        // stable key, survives reordering
      "label": "India & Nepal", // shown on the badge over the map + the jump bar
      "title": "Sambar\ndeer",  // the card's heading
      "text":  "<p>…</p>",      // RichText, kses-limited to p/br/em/strong/u/a
      "image": { "id": 5, "url": "…", "alt": "…" },
      "caption": "… © Martin Harvey / WWF",
      "side": "right",          // which half the TEXT occupies; the map zooms
                                // to the other half — see freeArea()
      "box": { "x": 48.5, "y": 43, "w": 17.1, "h": 39.3 },  // % of the image
      "badge": "IUCN · Vulnerable",   // advanced
      "badgeLevel": "vulnerable",     // advanced — '' | least | vulnerable | endangered
      "zoom": 1                       // advanced
    }
  ],

  // ── advanced: one collapsed panel in the editor, all optional ──────────
  "focalX": 0, "focalY": 50,
  "showPaws": true, "showMarkers": true, "showRail": true,
  "accentColor": "#8fd14f", "inkColor": "#f2efe6",
  "backdropColor": "#04140d", "cardColor": "#071a11",
  "dimOpacity": 0.62, "cardOpacity": 0.84
}
```

**Two deliberate simplifications.** There is no "card type" switch — the opening
and closing cards are just the `sectionTitle`/`leadText`/`closingText` fields, so
an editor never has to understand a mode. And hotspots carry no number field:
numbering is derived from position, so reordering renumbers for free and there
is one less thing to keep in sync.

Design decisions to defend:
- **% coordinates, not pixels** → resolution-independent; the same data renders on any
  rendition of the image and any viewport.
- **Attributes vs custom post type**: attributes keep the webpart portable (copy/paste
  between pages, works in patterns); a CPT would be right only if the same map were reused
  across many pages — mention as a variation ("Reusable block / pattern" already covers it).
- **IDs on points** → stable reordering, no key collisions.

### 1a. The brief's four bullets, mapped to what an editor clicks

| The brief says | Where it is | Verified |
|---|---|---|
| **Add the webpart to any page via the page editor** | `+` inserter → **Scroll Map**. `supports.multiple` allows several per page | two instances on one page render and boot independently, assets enqueued once each |
| **Enter/configure the required data fields** — section title, images, hotspots, lead text | Sidebar **1 · Section** (section title, lead text, closing text) and **2 · Map image**. Each hotspot's title and text are typed straight into the card preview under the map | — |
| **Edit / Reorder / Remove hotspots** | Sidebar **3 · Hotspots**: ↑ ↓ reorder, ⧉ duplicate, 🗑 remove, **+ Add hotspot**. The region is **drawn on the map** — drag to create, drag the middle to move, drag a corner to resize | scripted: reorder swapped rows, add → 7, remove → 6, drag moved a box 56.4%→62.3% |
| **Preview before publishing** | The canvas is live; the **Before you publish** panel turns green and points at WordPress's Preview (desktop / tablet / mobile toggles, and Preview in a new tab renders the draft) | — |

Everything that is *not* on that list — map framing, motion switches, colours,
per-hotspot zoom and numeric coordinates — is in one collapsed **Advanced**
panel, so the default sidebar is four panels and a status box.

Two things in this plan are deliberately **not** built, and I would rather name
them than have them found:

| Not built | Why |
|---|---|
| Separate portrait `mobileImage` | the phone layout flies the one map inside a 45vh window, so editors enter content once |
| Drag-handle reordering | ↑↓ is keyboard- and screen-reader-accessible with no extra work; drag-and-drop is not |

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
▸ Before you publish
    ✔ Ready. Use Preview in the top bar…        ← or a numbered "Still to do" list
▸ 1 · Section
    Section title  [What do / tigers eat?]      (required)
    Lead text      [………]                        one paragraph per line
    Closing text   [………]                        optional
▸ 2 · Map image
    [thumbnail]  [Replace map image]
▸ 3 · Hotspots (6)
   ┌──────────────────────────────────┐
   │ 01  Sambar deer      ↑ ↓ ⧉ 🗑   │   click a row to select it
   │ 02  Wild pig         ↑ ↓ ⧉ 🗑   │   red outline = missing text
   │ …                                │
   └──────────────────────────────────┘
    [ + Add hotspot ]
▸ Hotspot 01
    Location label [India & Nepal]
    Which side is the text on?  (Text right · map left ▾)
    [Add an image]   Caption [………]
    [ Redraw this hotspot on the map ]
▸ Advanced                                       ← collapsed
    badge text/colour · zoom · X/Y/W/H · framing · motion · colours
```

And on the canvas itself, a four-step progress strip that ticks itself off:
`① Map image  ② Title & lead text  ③ Hotspots  ④ Preview, then publish`.

### Edit / Reorder / Remove hotspots — explicitly required by the brief
- **Add**: `+ Add hotspot` appends one and drops straight into draw mode.
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

## 7. Portability — built, not promised

The webpart is **`src/core/`**: a JSON schema, a stylesheet, an engine, and a renderer. There
is no CMS anywhere in it. Everything else in `src/` is an adapter whose only job is to map
that CMS's storage onto [the schema](../src/core/scrollmap.schema.json).

There are exactly two ways to integrate, and the choice is one question — *can your CMS render
a server-side template?*

| | Server-render | JSON-render |
|---|---|---|
| For | WordPress, Drupal, Umbraco, Sitecore, Craft, Rails | headless (Contentful/Strapi/Sanity), SPAs, SharePoint SPFx |
| You write | a template that emits the markup | **nothing** |
| How | your template ↔ `render.php` / `scrollmap.html.twig` | `<div data-tgr-src="#json">` + two script tags |
| Best for | SEO, first paint | speed of integration |

`scrollmap-render.js` is the same file in both cases — it runs in Node (so Eleventy, Astro,
Next or a build step can pre-render) and in the browser (so a headless CMS needs no template).

### What exists today

| Adapter | Renders | State |
|---|---|---|
| WordPress (Gutenberg block) | server, PHP | **built and running** — full visual editor, validation, seeder |
| Headless / any JSON API | browser | **built and running** — `src/adapters/headless/`, open `index.html` |
| Drupal (Paragraphs + Twig) | server, Twig | template + field mapping + preprocess written, parity-checked |
| SharePoint (SPFx web part) | browser | web part class + property pane written |

### The claim is tested, not asserted

`tools/check-parity.js` renders the **same content** three ways — WordPress's PHP, the browser,
and Node — then compares hotspot coordinates, card order, headings, sides and numbering:

```
steps rendered   WordPress 8 · headless 8 · Node 8
MATCH   WordPress vs headless
MATCH   headless vs Node
```

`tools/sync-core.js --check` additionally fails the build if an adapter's copy of the core has
drifted from `src/core/`. Both belong in CI.

### What an adapter actually costs

The two that exist end-to-end are the honest measure:

| | WordPress | Headless |
|---|---|---|
| Rendering | `render.php`, ~200 lines | **0** |
| Editing UI | `editor.js`, ~650 lines | the CMS's own field editor |
| Content model | `block.json` attributes | the CMS's content type |
| Engine / styles | copied, unmodified | copied, unmodified |

🗣 **"The editing experience is the work; the webpart is not."** Any CMS with a repeater field
can store hotspots today. What each one needs building is the part that makes it *pleasant* —
drawing the box on the map instead of typing four numbers — and that canvas is ~120 lines of
plain DOM code with no WordPress in it, so it ports too.

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
