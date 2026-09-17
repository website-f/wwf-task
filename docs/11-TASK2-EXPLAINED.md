# Task 2, explained from scratch

How a folder of files becomes a WordPress plugin, and how that plugin puts a visual editor in
front of a non-technical person. Assumes nothing.

Task 1 is explained separately in [10-TASK1-EXPLAINED.md](10-TASK1-EXPLAINED.md) — read that
first if you haven't, because Task 2 is "take Task 1 and make its values editable".

---

# Part 0 · The one-sentence version

> Task 1 has values written into the HTML by hand. Task 2 stores those same values in the
> database, gives an editor a nice way to change them, and prints exactly the same HTML.

Nothing about the look or the animation changes. `style.css` and `view.js` in the plugin are
**copies of the Task 1 files**, unchanged.

---

# Part 1 · What a WordPress plugin actually is

A plugin is **a folder in `wp-content/plugins/` containing a PHP file with a special comment
at the top.** That's the whole definition.

```php
<?php
/**
 * Plugin Name:       WWF Scroll Map          ← THIS LINE makes it a plugin
 * Description:       Scroll-driven map webpart…
 * Version:           3.0.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 */
```

WordPress scans that folder, reads those comment lines, and lists what it finds on the
**Plugins** screen. Delete the `Plugin Name:` line and WordPress stops seeing it as a plugin
entirely. There is no registry, no build, no manifest format — just that comment.

When someone clicks **Activate**, WordPress starts running your PHP file on every page load.

### The second line that matters

```php
defined( 'ABSPATH' ) || exit;
```

`ABSPATH` is a constant WordPress defines. If it isn't defined, the file was opened
directly in a browser rather than loaded by WordPress — so stop. Standard safety line; it goes
at the top of every PHP file in the plugin.

---

# Part 2 · What a "block" is

In the WordPress editor (called **Gutenberg**), everything on a page is a block — a paragraph
is a block, an image is a block, a gallery is a block. Our webpart is one more block.

A block is made of two halves that have to agree with each other:

| Half | Runs | Job |
|---|---|---|
| **The editor half** (`editor.js`) | in the admin, in the browser | let someone *edit* the content |
| **The render half** (`render.php`) | on the server, for visitors | turn that content into HTML |

And one file that describes the block to WordPress: **`block.json`**.

### Where the content is actually stored

This surprises people. Block content is **not** in its own database table. It's stored in the
page's own content, as an HTML comment:

```html
<!-- wp:wwf/scrollmap {"sectionTitle":"What do\ntigers eat?","hotspots":[{…}]} /-->
```

That JSON is the block's **attributes**. When a visitor loads the page, WordPress finds that
comment, parses the JSON, and hands it to `render.php` as `$attributes`.

**Why that's a good thing:**

- copy/paste a block between pages just works — you're copying text
- it's covered by post revisions, so undo and rollback are free
- exporting the page (Tools → Export) exports the block with it
- no custom tables to migrate

---

# Part 3 · The files, one at a time

```
wwf-scrollmap/
├── wwf-scrollmap.php     the plugin header + registration         135 lines
├── block.json            the block's description and data schema    46
├── render.php            server-side HTML output                   217
├── editor.js             the editing UI                            716
├── editor.css            editor-only styling                       290
├── style.css             ← a copy of src/core/scrollmap.css
├── view.js               ← a copy of src/core/scrollmap.js
├── vendor/               ← a copy of src/core/vendor/ (GSAP)
├── editor.asset.php      which WordPress libraries editor.js needs
└── view.asset.php        which scripts view.js needs
```

## 3.1 · `wwf-scrollmap.php` — the bootstrap

After the header comment, it does three things inside one hook:

```php
add_action( 'init', function () {
    $url = plugin_dir_url( __FILE__ );
    $dir = plugin_dir_path( __FILE__ );

    wp_register_script( 'gsap', $url . 'vendor/gsap.min.js', array(), '3.13.0',
        array( 'strategy' => 'defer', 'in_footer' => true ) );

    wp_register_script( 'gsap-scrolltrigger', $url . 'vendor/ScrollTrigger.min.js',
        array( 'gsap' ), '3.13.0', array( 'strategy' => 'defer', 'in_footer' => true ) );

    register_block_type( $dir );          // ← the whole block, from block.json
} );
```

**`add_action('init', …)`** — "when WordPress has finished booting, run this". A **hook**:
you hand WordPress a function and it calls you at the right moment.

**`wp_register_script`** — tells WordPress *about* a script without loading it. Registering
GSAP as a named handle (rather than writing a `<script>` tag) means:

- WordPress loads it **once**, even with several blocks on the page
- if another plugin also registers `gsap`, it isn't loaded twice
- `array('gsap')` on the second one says ScrollTrigger *depends on* GSAP, so the order is
  guaranteed
- `'strategy' => 'defer'` — don't block the page while it downloads

The files are **vendored** (copied into the plugin) rather than pulled from a CDN, so the site
has no third-party runtime dependency and works behind a firewall.

**`register_block_type( $dir )`** — one line, and the whole block exists. Passing a *directory*
tells WordPress "read `block.json` in there and do everything it says".

### The bug that shaped this file

The five template helper functions (`wwf_scrollmap_title_lines()`, etc.) live in **this** file,
not in `render.php`. That's not style:

> A block render template is included **once per block instance**. `supports.multiple` lets a
> page hold several. So the second instance re-included `render.php`, PHP hit the same
> `function` keyword twice, and the page died with *"Cannot redeclare
> wwf_scrollmap_title_lines()"*. I found it by putting two blocks on one page.

**The rule: a render template is a template. Functions belong in a file WordPress loads once.**

## 3.2 · `block.json` — the contract

```jsonc
{
  "apiVersion": 3,
  "name": "wwf/scrollmap",        // namespace/name — must be unique site-wide
  "title": "Scroll Map",          // what appears in the + inserter
  "category": "media",
  "icon": "location-alt",
  "description": "A map with hotspots. As the reader scrolls…",
  "keywords": ["map", "hotspot", "scroll", "story", "zoom", "wwf"],

  "supports": {
    "html": false,                // editors can't drop to raw HTML and break it
    "multiple": true,             // several per page allowed
    "align": ["full"]
  },

  "attributes": { … },            // ← the data model, see below

  "editorScript": "file:./editor.js",
  "editorStyle":  "file:./editor.css",
  "style":        "file:./style.css",
  "viewScript":   "file:./view.js",
  "render":       "file:./render.php"
}
```

**`title` and `keywords` are why `/scroll map` finds it.** WordPress searches both.

**The five asset keys:**

| Key | Loaded | Result |
|---|---|---|
| `editorScript` | admin only | the editing UI |
| `editorStyle` | admin only | editor chrome |
| `style` | **both** | the look — so the editor canvas is a true preview |
| `viewScript` | front end only | the GSAP engine |
| `render` | server | the PHP that outputs HTML |

WordPress loads front-end assets **only on pages that contain the block**, automatically.

### The attributes — the data model

```jsonc
"attributes": {
  "sectionTitle":    { "type": "string", "default": "" },
  "leadText":        { "type": "string", "default": "" },
  "closingText":     { "type": "string", "default": "" },
  "backgroundImage": { "type": "object", "default": null },
  "hotspots":        { "type": "array",  "default": [] },

  "focalX": { "type": "number", "default": 0 },
  "showPaws": { "type": "boolean", "default": true },
  "accentColor": { "type": "string", "default": "#8fd14f" },
  …
}
```

The top five are **the four fields the brief asked for**. Everything below is optional, and the
editor folds it into one collapsed *Advanced* panel.

Each hotspot inside `hotspots[]` looks like:

```jsonc
{ "id": "hs-sambar", "label": "India & Nepal", "title": "Sambar\ndeer",
  "text": "<p>…</p>", "image": { "id": 5, "url": "…", "alt": "…" },
  "caption": "…", "side": "right",
  "box": { "x": 48.5, "y": 43, "w": 17.1, "h": 39.3 },
  "badge": "IUCN · Vulnerable", "badgeLevel": "vulnerable", "zoom": 1 }
```

`box` is **percentages of the map image**, never pixels — the same numbers Task 1 puts in
`data-hotspot`. That's why one set of coordinates is right at every screen size.

> **No `number` field.** The card numbers (01, 02…) are derived from array position, so
> reordering renumbers automatically and there's one less thing for an editor to keep in sync.

## 3.3 · `render.php` — content → HTML

This runs on the server for every visitor. WordPress hands it `$attributes` — the JSON from the
page's content, already parsed into a PHP array.

It does five things:

**① Bail if there's nothing to draw**

```php
if ( empty( $bg['url'] ) ) {
    if ( current_user_can( 'edit_posts' ) ) {
        echo '<p style="…">Scroll Map: choose a map image…</p>';
    }
    return;
}
```

Editors see a warning; visitors see nothing at all.

**② Re-check every number**

```php
$focal_x = max( 0, min( 100, (float) ( $attributes['focalX'] ?? 0 ) ) );
$accent  = sanitize_hex_color( $attributes['accentColor'] ?? '' ) ?: '#8fd14f';
```

**Why re-check what the editor already validated?** Because attributes live in post content,
and anyone who can edit the post can type anything there. **Never trust stored data.** The same
clamping runs in the editor *and* here.

**③ Turn colours into CSS variables**

```php
$style_vars = sprintf( '--accent:%1$s; --ink:%2$s; --dim:%5$s; …', … );
```

Printed as the section's `style` attribute. That's how an editor recolours one instance without
a single extra line of CSS — remember `--accent` from Task 1 Part 2.

**④ Print the markup** — identical to the Task 1 HTML:

```php
wwf_scrollmap_step( 'step', $side, $label, $inner, $zoom, $box );
```

Which outputs `<article class="step" data-side="…" data-hotspot='…'><div class="step__pin">…`

Two helpers worth knowing:

```php
wwf_scrollmap_title_lines( "Sambar\ndeer" )
// → <span class="w"><span>Sambar</span></span><span class="w"><span>deer</span></span>
```

That's the masked-line structure from Task 1 Part 2, generated from the editor pressing
**Enter**. Typography stays an editorial decision instead of an algorithm's.

```php
$number = str_pad( (string) ( $index + 1 ), 2, '0', STR_PAD_LEFT );   // 1 → "01"
```

**⑤ Escape everything**

| Function | Used for |
|---|---|
| `esc_html()` | text between tags |
| `esc_attr()` | text inside an attribute |
| `esc_url()` | links and image sources |
| `wp_kses( $text, $allowed )` | rich text — strips everything not whitelisted |

The whitelist is `p br em strong u a[href|target|rel]`, and it's **mirrored exactly** by the
editor's `allowedFormats`. What an editor can type and what the server will print cannot drift
apart.

**Images go through `wp_get_attachment_image()`** rather than a hand-written `<img>`:

```php
echo wp_get_attachment_image( (int) $bg['id'], 'full', false,
    array( 'class' => 'tgr__map', 'fetchpriority' => 'high' ) );
```

That gives `srcset`, `sizes`, alt text from the Media Library and lazy-loading for free — the
browser then picks the right size for the device.

## 3.4 · `editor.js` — the editing UI

716 lines, and the honest truth is **this is where almost all of Task 2's work is**. Rendering
is 217 lines; the pleasant editing experience is 716.

### It's React, without a build step

```js
var el = wp.element.createElement;

el('div', { className: 'card' }, 'Hello')     // → <div class="card">Hello</div>
```

`wp.element` is WordPress's bundled React. Normally you'd write JSX (`<div className="card">`)
and compile it. Writing `createElement` by hand means **the plugin runs by dropping the folder
in** — no npm, no build, nothing for a reviewer to install. In a product codebase this file
would be JSX under `@wordpress/scripts`; the structure is identical.

### The shape of a block editor component

```js
function Edit(props) {
  var atts    = props.attributes;        // the current content
  var setAtts = props.setAttributes;     // the ONLY way to change it
  …
  return el(Fragment, null, sidebar, canvas);
}

registerBlockType('wwf/scrollmap', {
  edit: Edit,
  save: function () { return null; }     // ← dynamic block
});
```

**`save: () => null`** makes this a **dynamic block**: nothing is saved as HTML, only the
attributes, and `render.php` generates the HTML fresh on every page load. The alternative
(static blocks) freezes HTML into the post, so a template fix wouldn't reach old pages.

**Everything goes through `setAttributes`.** That single rule is why undo/redo, Ctrl+Z and post
revisions all work without a line of code from me:

```js
function update(i, patch) {
  setAtts({ hotspots: spots.map(function (s, j) {
    return j === i ? Object.assign({}, s, patch) : s;      // a NEW array, never edited in place
  }) });
}
function move(i, dir) { … }        // reorder
function duplicate(i) { … }
function remove(i) { … }
```

Note they're **immutable** — always a new array, never `spots[i].title = 'x'`. React only
re-renders when it sees a new object, and the undo stack needs the old one intact.

### The canvas — drawing a hotspot with the mouse

The feature that makes the block usable by a non-technical person. Three gestures, one set of
handlers:

```js
function pct(evt) {                              // mouse position → % of the image
  var r = canvasRef.current.getBoundingClientRect();
  return { x: (evt.clientX - r.left) / r.width * 100,
           y: (evt.clientY - r.top)  / r.height * 100 };
}

function onDown(evt) {
  if (drawing)      drag.current = { type: 'draw',   from: pct(evt) };
  else if (handle)  drag.current = { type: 'resize', corner: handle, … };
  else if (onBox)   drag.current = { type: 'move',   from: pct(evt), box: hs.box };
}

function onMove(evt) { … setLive(clampBox(box)); }     // live preview while dragging
function onUp()      { update(selected, { box: clampBox(live) }); }
```

Converting to **percentages immediately** is the important part — the editor canvas is a
different size from the visitor's screen, so pixels would be meaningless.

**`clampBox()` is the rule in one place:**

```js
function clampBox(b) {
  var w = clamp(b.w, 2, 100);
  var h = clamp(b.h, 2, 100);
  return { x: clamp(b.x, 0, 100 - w), y: clamp(b.y, 0, 100 - h), w: w, h: h };
}
```

At least 2% across, never leaves the image. Drawing, moving, resizing and the number fields all
call it — and `render.php` applies the same rule again server-side.

> **A usability bug worth mentioning.** Three hotspots overlap over India, so clicking to
> select one was unreliable — a different box kept intercepting the click. Fix: the selected
> box lifts above the others (`z-index: 3`) and the numbered badge is always clickable. I
> found it because an automated test reported which element stole the click.

### Validation — two tiers

```js
var errors = [];
if (!atts.backgroundImage) errors.push('Choose a map image.');
if (!String(atts.sectionTitle || '').trim()) errors.push('Write a section title.');
if (!spots.length) errors.push('Add at least one hotspot.');

var warnings = [];
if (… no alt text …) warnings.push('The map image has no alt text…');

useEffect(function () {
  var ed = wp.data.dispatch('core/editor');
  if (blocked) ed.lockPostSaving('wwf-scrollmap');
  else         ed.unlockPostSaving('wwf-scrollmap');
}, [blocked]);
```

`lockPostSaving()` **physically disables the Publish button** and lists why. Warnings only
warn — blocking someone's publish over a missing alt text is how you teach people to hate a
CMS.

`useEffect(fn, [blocked])` is React for "run this whenever `blocked` changes".

### The sidebar

```js
el(InspectorControls, null,
  el(PanelBody, { title: '1 · Section', initialOpen: true },
    el(TextareaControl, { label: 'Section title', value: atts.sectionTitle,
                          onChange: function (v) { setAtts({ sectionTitle: v }); } }),
    …))
```

`InspectorControls` is the right-hand panel. WordPress supplies the widgets — `TextControl`,
`TextareaControl`, `RangeControl`, `SelectControl`, `ToggleControl`, `ColorPalette`,
`MediaUpload` — so the block looks and behaves like every other block an editor already knows.

Panels are numbered to match the brief: **1 · Section**, **2 · Map image**, **3 · Hotspots**,
then **Hotspot nn**, then everything optional in a collapsed **Advanced**.

### Media

```js
el(MediaUpload, {
  allowedTypes: ['image'],
  onSelect: function (m) { setAtts({ backgroundImage: media(m) }); },
  render: function (o) { return el(Button, { onClick: o.open }, 'Choose map image'); }
})
```

That's the whole Media Library integration — WordPress provides the modal, the uploads, the
search. We store `{ id, url, alt, width, height }` and **keep the `id`**, because the id is
what lets `render.php` ask for `srcset` and the current alt text later.

## 3.5 · The `.asset.php` files

```php
return array(
    'dependencies' => array( 'wp-blocks', 'wp-element', 'wp-block-editor',
                             'wp-components', 'wp-data', 'wp-api-fetch', 'wp-i18n' ),
    'version'      => '3.0.0',
);
```

"Before running `editor.js`, load these WordPress libraries." Normally generated by
`@wordpress/scripts`; hand-written here because there's no build step. `view.asset.php` is the
same idea and is what makes the front-end engine wait for GSAP:

```php
'dependencies' => array( 'gsap', 'gsap-scrolltrigger' ),
```

---

# Part 4 · How it becomes an installable plugin

```
node tools/sync-core.js          copy src/core/ into the plugin folder
node tools/build-plugin-zip.js   → dist/wwf-scrollmap-3.0.0.zip
```

A WordPress plugin zip must contain **one top-level folder** named like the plugin. WordPress
extracts it into `wp-content/plugins/` and that folder name becomes the plugin's folder.

Then: **Plugins → Add New Plugin → Upload Plugin → Activate**.

> **The packaging bug this caught.** The first build used PowerShell's `Compress-Archive`,
> which writes **backslashes** as the separator inside the zip. The ZIP spec requires forward
> slashes, so PHP on Linux saw one flat file called `wwf-scrollmap\block.json` instead of a
> folder, installed it to the wrong place, and the plugin wouldn't load. Invisible on a Windows
> dev machine, fatal on a real server. The build now writes the zip itself.

Full detail, including what "install" means in Drupal / SharePoint / headless:
[09-INSTALLING.md](09-INSTALLING.md).

---

# Part 5 · Why the same stylesheet and engine

`style.css` and `view.js` in the plugin are **copies of `src/core/scrollmap.css` and
`scrollmap.js`** (`view.js` adds a DOM-ready boot, because WordPress decides where the script
tag lands). They're generated by `node tools/sync-core.js`, and
`node tools/sync-core.js --check` fails the build if anyone has edited a copy by hand.

`node tools/check-parity.js` goes further: it renders the same content through WordPress's PHP,
through the browser, and through Node, and asserts all three produce the same webpart.

```
steps rendered   WordPress 8 · headless 8 · Node 8
MATCH   WordPress vs headless
MATCH   headless vs Node
```

That's what lets me say the webpart is CMS-agnostic without hand-waving.

---

# Part 6 · The journey of one hotspot

Follow a single value end to end. This is the best thing to walk through out loud.

```
1. An editor drags a box on the map
   editor.js  onMove()  → pct() converts pixels to %, clampBox() bounds it

2. update(selected, { box: {x:48.5, y:43, w:17.1, h:39.3} })
   → setAttributes → React re-renders, undo stack records it

3. Save. WordPress writes it into the page's content:
   <!-- wp:wwf/scrollmap {"hotspots":[{"box":{"x":48.5,…}}]} /-->

4. A visitor loads the page. WordPress parses that comment,
   hands render.php  $attributes['hotspots'][0]['box']

5. render.php clamps it again, then prints:
   <article class="step" data-hotspot='{"x":48.5,"y":43,"w":17.1,"h":39.3}'>

6. view.js reads it:  JSON.parse(el.dataset.hotspot)          (line ~120)

7. shotFor() turns it into a camera position and zoom          (line 174)

8. GSAP flies the camera there as you scroll                   (line 411)

9. projectFrame() puts the spotlight exactly on top of it      (line 228)
```

Nine steps, and the number `48.5` never changes meaning: **percent of the map image**, all the
way through.

---

# Part 7 · Questions you might get

**"Why a custom block instead of ACF or a page builder?"**
ACF Pro is a paid dependency and its repeater couldn't give an editor a *drawing canvas* — they
would type four numbers per hotspot. A custom block also keeps the data in post content, so
copy/paste and revisions work.

**"Why attributes instead of a custom post type?"**
The block stays copy-pasteable between pages, works inside synced patterns, and versions with
post revisions. A CPT would only pay off if one map were shared across many pages — and a
synced pattern already covers that.

**"What happens if you deactivate the plugin?"**
The pages keep their content — the block comment stays in the post, it just stops rendering.
Reinstall and every page works again. Nothing is destroyed.

**"How would you migrate existing content in?"**
A script that builds the attribute array and calls `serialize_block()`. `seed-demo.php` is that
worked example — it imports 7 images and publishes a fully populated page.

**"What would you do differently in production?"**
JSX under `@wordpress/scripts` instead of `createElement`; `src/core/` published as a versioned
npm/Composer package instead of copied by a script; and drag-handle reordering (I used ↑↓
because it's keyboard- and screen-reader-accessible with no extra work).
