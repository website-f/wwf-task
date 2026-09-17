# Scroll Map — the webpart

**This folder is the product. Everything else in `src/` is an adapter.**

There is no CMS in here. The webpart is driven entirely by `data-` attributes and one JSON
contract, so integrating it into a CMS means mapping that CMS's storage onto the contract —
not porting the webpart.

```
scrollmap.schema.json   the contract. Start here.
scrollmap.css           all the styling
scrollmap.js            the engine — behaviour, and optional self-rendering from JSON
scrollmap-render.js     JSON → HTML. Runs in Node and in the browser.
vendor/                 GSAP 3.13 + ScrollTrigger (vendored — no CDN at runtime)
```

Total: ~30KB of our code, plus 115KB of GSAP. No build step, no framework, no npm.

---

## Pick your integration

There are only two, and which one you want depends on a single question:
**can your CMS render a server-side template?**

### A. Yes — render server-side (WordPress, Drupal, Umbraco, Sitecore, Craft, Rails…)

Your template turns content into the markup the engine expects, exactly like
`scrollmap-render.js` does. You ship two files and one script tag:

```html
<link rel="stylesheet" href="/assets/scrollmap/scrollmap.css">
…your rendered <section class="tgr" data-tgr …> markup here…
<script src="/assets/scrollmap/vendor/gsap.min.js" defer></script>
<script src="/assets/scrollmap/vendor/ScrollTrigger.min.js" defer></script>
<script src="/assets/scrollmap/scrollmap.js" defer></script>
```

Best for SEO and first paint: the content is in the HTML before any JavaScript runs.

Worked examples: [`../wp-plugin/wwf-scrollmap/render.php`](../wp-plugin/wwf-scrollmap/render.php)
(PHP) and [`../adapters/drupal-twig/`](../adapters/drupal-twig/) (Twig).

### B. No, or you'd rather not — render from JSON (headless, SPA, SharePoint SPFx)

Emit the JSON and add `scrollmap-render.js`. **No templating at all:**

```html
<link rel="stylesheet" href="/assets/scrollmap/scrollmap.css">

<script type="application/json" id="map-content">{ …schema… }</script>
<div data-tgr-src="#map-content"></div>

<script src="/assets/scrollmap/vendor/gsap.min.js"></script>
<script src="/assets/scrollmap/vendor/ScrollTrigger.min.js"></script>
<script src="/assets/scrollmap/scrollmap-render.js"></script>
<script src="/assets/scrollmap/scrollmap.js"></script>
```

`scrollmap.js` finds every `[data-tgr-src]` / `[data-tgr-json]`, renders it and boots it.
For one small instance you can inline the JSON: `<div data-tgr-json='{ … }'></div>`.

Worked example: [`../adapters/headless/`](../adapters/headless/) — open `index.html`, it
fetches `content.json` and renders in the browser.

### The same renderer also works in Node

For Eleventy, Astro, Next, Nuxt, a Nunjucks site, or a build step that turns CMS JSON into
static HTML:

```js
const ScrollMapRender = require('./src/core/scrollmap-render.js');
const html = ScrollMapRender(contentFromYourCms);   // → a string
```

---

## The contract

[`scrollmap.schema.json`](scrollmap.schema.json) is JSON Schema draft-07 — machine-readable,
so you can validate CMS output in CI. The shape, short version:

```jsonc
{
  "sectionTitle": "What do\ntigers eat?",   // required; \n = a deliberate line break
  "leadText":     "…",                      // one paragraph per line
  "closingText":  "…",                      // optional
  "map":      { "src": "…", "alt": "…" },   // required
  "hotspots": [                             // required; array order = scroll order
    { "label": "India & Nepal",
      "title": "Sambar\ndeer",
      "text":  "<p>…</p>",                  // p/br/em/strong/u/a only
      "image": { "src": "…", "alt": "…" }, "caption": "…",
      "side":  "right",                     // which half the TEXT is in
      "box":   { "x": 48.5, "y": 43, "w": 17.1, "h": 39.3 } }   // % of the image
  ],
  "options": { "focal": { "x": 0, "y": 50 }, "paws": true, "markers": true, "rail": true,
               "theme": { "accent": "#8fd14f", "…": "…" } }
}
```

**Three rules worth knowing before you map your fields onto it:**

1. **`box` is percentages of the image, never pixels.** That is what makes one set of
   coordinates correct at every viewport size and for every rendition your CMS serves.
2. **`side` is where the *text* goes.** The engine always flies the hotspot into the other
   half of the screen, which is how the text is guaranteed never to cover it.
3. **Order is meaning.** Array position drives scroll order *and* the number on each card,
   so a reorder in your CMS needs no other change.

### Validation, shared

```js
const { errors, warnings, ok } = ScrollMapRender.validate(content);
```

`errors` should block a publish; `warnings` (missing alt text) should never. The WordPress
editor uses exactly these rules — implement them once, not once per CMS.

---

## Security

`scrollmap-render.js` strips everything outside `p/br/em/strong/u/a` and rejects any href
that is not http(s), mailto, tel or relative. **That is defence in depth, not the security
boundary.** Sanitise rich text in your CMS, on save, server-side:

| CMS | Use |
|---|---|
| WordPress | `wp_kses( $text, $allowed )` — the plugin does this in `render.php` |
| Drupal | `check_markup()` with a restricted text format |
| SPFx / headless | sanitise in the API layer before the JSON is stored |

Keep your whitelist identical to the one above, or the two ends will drift.

---

## Accessibility and motion

Handled by the core, so every adapter gets it:

- `prefers-reduced-motion` is a first-class branch — same content, no flying.
- Semantic `article` / `figure` / `figcaption`, real `<button>`s in the jump bar
  with `aria-current`, decorative layers `aria-hidden`.
- Interaction is native scroll, so keyboard users get everything.
- No-JS: the section renders as a static image with readable stacked cards.

One thing the adapter must supply: **alt text on every image**, and — if the picture has
data baked into it, as the tiger map does — a text alternative near it. The standalone demo
does this with a visually-hidden `<table>`.

---

## Keeping copies honest

WordPress, Drupal and SPFx all need their own copy of these files, because each loads assets
from its own directory. `src/core/` is the source; copies are generated:

```
node tools/sync-core.js           copy core → the WordPress plugin
node tools/sync-core.js --check   fail if they have drifted   (CI)
node tools/check-parity.js        assert the PHP, browser and Node renderers
                                  produce the same webpart from the same content
```

`check-parity.js` is the one that matters. It renders the same content three ways —
WordPress's PHP, the browser, and Node — and compares hotspot coordinates, card order,
headings, sides and numbering. If an adapter ever drifts from the contract, it fails.
