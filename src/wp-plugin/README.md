# wwf/scrollmap — WordPress block plugin (Task 2 demo)

Custom Gutenberg block implementing the CMS integration plan
([docs/02-CMS-INTEGRATION-PLAN.md](../../docs/02-CMS-INTEGRATION-PLAN.md)):
the standalone Task 1 webpart, with every hard-coded value turned into
editor-managed content.

## Run the demo

**The demo site is already initialised** (WordPress installed, plugin active,
all 7 images in the media library, the "Tiger Range Countries" page published
as the front page):

```bash
cd src/wp-plugin
docker compose up -d
# front page:  http://localhost:8280            ← the live webpart
# admin:       http://localhost:8280/wp-admin   ← admin / admin
# edit page:   Pages → "Tiger Range Countries"
```

To rebuild the demo content from scratch (idempotent — safe to re-run):

```bash
docker run --rm --network wp-plugin_default \
  -v wp-plugin_wp_data:/var/www/html \
  -v "$PWD/wwf-scrollmap:/var/www/html/wp-content/plugins/wwf-scrollmap" \
  -v "$PWD:/seed-scripts" \
  -v "$PWD/../standalone/assets:/seed-assets" \
  -e WORDPRESS_DB_HOST=db -e WORDPRESS_DB_NAME=wordpress \
  -e WORDPRESS_DB_USER=wordpress -e WORDPRESS_DB_PASSWORD=wordpress \
  --user www-data wordpress:cli-php8.3 \
  wp eval-file /seed-scripts/seed-demo.php --path=/var/www/html
```

Manual entry alternative: in the block sidebar → **Points** →
**Load tiger demo content** seeds all 8 story points with the measured
hotspots; then set the background image and attach card images.

## Demo checklist (maps to the assignment's Task 2 bullets)

| Requirement | Where to show it |
|---|---|
| Add webpart via page editor | `+` inserter → "Scroll Map" (icon, description, keywords) |
| Enter/configure data fields | Sidebar: map image, section label, **animation style (cinematic/faithful)**, dim/highlight/travel settings; per-point: heading, rich body, image+caption, alignment |
| Edit / reorder / remove hotspots | Points panel: ↑ ↓ 🗑 per row; hotspot drawn directly on the map (drag), or fine-tuned with X/Y/W/H sliders |
| Preview before publishing | Editor canvas is live; Preview → new tab renders the real front end (draft), desktop/tablet/mobile toggles |
| Validation | No background image → `MediaPlaceholder` + sidebar warning + **publishing locked** (`lockPostSaving`); hotspot boxes clamped to image bounds on every write path; body HTML sanitised via `wp_kses` on render |

## Files

| File | Role |
|---|---|
| `block.json` | Single source of truth: attributes schema, assets, render template |
| `wwf-scrollmap.php` | Plugin bootstrap (`register_block_type(__DIR__)`) |
| `render.php` | Server render — emits the same markup as the standalone Task 1 file |
| `editor.js` | Editor UI (no build step — plain `wp.element`): canvas + draw layer + repeater + validation |
| `editor.css` | Editor-only styling |
| `style.css` | Front-end styles (shared layer model with Task 1) |
| `view.js` | Front-end scroll engine (same code as Task 1) |
| `*.asset.php` | Hand-written dependency manifests (normally emitted by `@wordpress/scripts`) |

Production notes: in a long-lived codebase `editor.js` becomes JSX under
`@wordpress/scripts`, `view.js`/`style.css` are shared with the standalone
build from one source package, and the WWF font ships as a theme asset.
