# Adapters

The webpart itself is [`../core/`](../core/). An adapter's only job is to get a CMS's content
into [the contract](../core/scrollmap.schema.json) and the core's files onto the page.

| Adapter | Renders | What's in it | Status |
|---|---|---|---|
| [`../wp-plugin/`](../wp-plugin/) | server (PHP) | full Gutenberg block: visual hotspot editor, validation, seeder | **built and running** — `localhost:8280` |
| [`headless/`](headless/) | browser | one HTML page + `content.json`. Works with Contentful, Strapi, Sanity, Directus, headless WP, any REST API | **built and running** — open `index.html` |
| [`drupal-twig/`](drupal-twig/) | server (Twig) | the template, the Paragraph field mapping, the preprocess hook | template written and parity-checked; not installed in a live Drupal |
| [`sharepoint-spfx/`](sharepoint-spfx/) | browser | web part class, property pane, content mapping | code written; not deployed to a tenant |

## How much work is an adapter, really

The two that exist end-to-end are the honest measure:

| | WordPress | Headless |
|---|---|---|
| Rendering | `render.php`, ~200 lines | **0** — `scrollmap-render.js` does it |
| Editing UI | `editor.js`, ~650 lines (this is the real cost) | your CMS's own field editor |
| Content model | `block.json` attributes | your CMS's content type |
| Engine / styles | copied, unmodified | copied, unmodified |

**The editing experience is the work; the webpart is not.** Any CMS with a repeater field can
store hotspots today. What each one needs building is the bit that makes it pleasant — drawing
the box on the map instead of typing four numbers. That canvas is ~120 lines of plain DOM code
in [`../wp-plugin/wwf-scrollmap/editor.js`](../wp-plugin/wwf-scrollmap/editor.js)
(`onDown` / `onMove` / `onUp` / `clampBox`) with no WordPress in it, so it ports.

## Proving an adapter is correct

```
node tools/check-parity.js
```

Renders the same content through WordPress's PHP, through the browser and through Node, then
compares hotspot coordinates, card order, headings, sides and numbering. Current result:

```
steps rendered   WordPress 8 · headless 8 · Node 8
MATCH   WordPress vs headless
MATCH   headless vs Node
```

Add your adapter to that script and it is held to the same standard.

## Writing a new one

1. Read [`../core/scrollmap.schema.json`](../core/scrollmap.schema.json).
2. Map your content type onto it. The three rules in
   [`../core/README.md`](../core/README.md#the-contract) are the only ones that bite.
3. Decide server-render or JSON-render — if in doubt, JSON-render, it is no code.
4. Copy `core/` into wherever your CMS serves static assets. Never edit it there;
   `node tools/sync-core.js --check` is how you keep that honest.
5. Sanitise rich text **server-side, on save**, with the same whitelist
   (`p br em strong u a[href|target|rel]`).
6. Run `check-parity.js`.
