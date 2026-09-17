# wwf/scrollmap — WordPress plugin (Task 2)

The Task 1 webpart as a Gutenberg block. Same `style.css`, same engine (`view.js`),
every hard-coded value turned into something an editor can change without touching code.

- **Editor guide for content people:** [docs/07-EDITOR-GUIDE.md](../../docs/07-EDITOR-GUIDE.md)
- **Architecture / data model:** [docs/02-CMS-INTEGRATION-PLAN.md](../../docs/02-CMS-INTEGRATION-PLAN.md)

---

## 1. Run it

Every command below was run on this machine; the output quoted is the real output.

### 1.1 Start the stack

```bash
cd src/wp-plugin
docker compose up -d
```

Two containers come up: `wp-plugin-wordpress-1` (WordPress 6.7, PHP 8.3, Apache) on
**http://localhost:8280**, and `wp-plugin-db-1` (MariaDB 11). The plugin folder is
bind-mounted straight into `wp-content/plugins/wwf-scrollmap`, so editing a file on your
machine changes the running site — no rebuild, no copy step.

Give it ~20 seconds the first time: WordPress copies itself into the volume on first boot.
`curl -s -o /dev/null -w "%{http_code}" http://localhost:8280/` returning `302` means ready.

### 1.2 Install + seed (one block, run once)

> **Windows note:** run these from **PowerShell**, not Git Bash — Git Bash rewrites the
> container-side paths (`/var/www/html` becomes `C:/Program Files/Git/var/www/html`) and
> WP-CLI then reports *"This does not seem to be a WordPress installation"*.

```powershell
cd C:\...\wwf-task\src\wp-plugin

$mounts = @(
  '-v','wp-plugin_wp_data:/var/www/html',
  '-v',"$($PWD.Path)\wwf-scrollmap:/var/www/html/wp-content/plugins/wwf-scrollmap",
  '-v',"$($PWD.Path):/seed-scripts",
  '-v',"$((Resolve-Path '..\standalone\assets').Path):/seed-assets"
)
$envs = @('-e','WORDPRESS_DB_HOST=db','-e','WORDPRESS_DB_NAME=wordpress',
          '-e','WORDPRESS_DB_USER=wordpress','-e','WORDPRESS_DB_PASSWORD=wordpress')

# install WordPress
docker run --rm --network wp-plugin_default @mounts @envs --user 33:33 wordpress:cli-php8.3 `
  wp core install --url=http://localhost:8280 --title="WWF Tiger prey" `
  --admin_user=admin --admin_password=admin --admin_email=demo@example.com --skip-email `
  --path=/var/www/html

# activate the block plugin
docker run --rm --network wp-plugin_default @mounts @envs --user 33:33 wordpress:cli-php8.3 `
  wp plugin activate wwf-scrollmap --path=/var/www/html

# import the 7 images and publish the demo page as the front page
docker run --rm --network wp-plugin_default @mounts @envs --user 33:33 wordpress:cli-php8.3 `
  wp eval-file /seed-scripts/seed-demo.php --path=/var/www/html
```

> **`--user 33:33`, not `--user www-data`.** The `wordpress:cli` image is Alpine-based where
> `www-data` is uid **82**; the Apache image is Debian-based where it is uid **33**. Passing
> the *name* makes WP-CLI run as 82, which cannot write to the uploads directory owned by 33,
> and every image import fails with *"Unable to create directory wp-content/uploads/…"*.
> Passing the numeric uid fixes it. This bit me on the first run.

Expected output of the last command:

```
media[map] = #4
media[sambar] = #5
… (7 attachments)
created page #11
Success: Seeded. Front page: http://localhost:8280/
```

### 1.3 Look at it

| What | Where |
|---|---|
| The live webpart | **http://localhost:8280/** |
| Admin | http://localhost:8280/wp-admin — **admin / admin** |
| Edit the block | Pages → *Tiger Range Countries* → the Scroll Map block |

### 1.4 Reset to a clean demo

```powershell
docker run --rm --network wp-plugin_default @mounts @envs --user 33:33 wordpress:cli-php8.3 wp db reset --yes --path=/var/www/html
# then repeat the three commands in 1.2
```

Stop everything with `docker compose down`; add `-v` to also drop the database and uploads.

---

## 2. The Task 2 requirements, mapped to what to click

| Brief says | Where it is |
|---|---|
| Add the webpart to any page via the page editor | `+` inserter → search **Scroll Map**. Registered in `block.json` with an icon, description and keywords (`map`, `scrollytelling`, `hotspot`, `story`, `zoom`) |
| Enter/configure the data fields | **Block** sidebar → *Map* (image, section title, framing), *Motion* (paw trail / pins / rail), *Colours*, *Chapters*, *Chapter N*. Heading and body are typed **inside the card preview** under the map |
| Edit / reorder / remove hotspots | *Chapters* panel: click a row to select, ↑ ↓ to reorder, ⧉ to duplicate, 🗑 to remove. The region itself is **drawn on the map** — drag to create, drag the middle to move, drag a corner to resize |
| Preview before publishing | The canvas is live; **Preview → Desktop / Tablet / Mobile**, and *Preview in new tab* renders the real front end from the draft |
| Validation | Publish is **locked** with a listed reason until: a map image is set, a section title exists, there is ≥1 chapter, every chapter has a heading or body, and every map chapter has a region. Alt-text gaps warn but never block |

---

## 3. Files

| File | Role |
|---|---|
| `block.json` | Single source of truth: attribute schema, asset wiring, `render` template |
| `wwf-scrollmap.php` | Registers the block, and registers the two vendored GSAP scripts as WordPress handles |
| `render.php` | Server render — prints the same markup as the standalone Task 1 file |
| `editor.js` | Editor UI: canvas with draw/move/resize, chapter repeater, live card preview, validation |
| `editor.css` | Editor chrome only |
| `style.css` | **Byte-identical to `src/standalone/scrollmap.css`** |
| `view.js` | The standalone engine + a DOM-ready boot |
| `vendor/` | GSAP 3.13 + ScrollTrigger, vendored — no CDN dependency at runtime |
| `*.asset.php` | Hand-written dependency manifests (normally emitted by `@wordpress/scripts`) |
| `../seed-demo.php` | Idempotent site seeder — also the worked example of content migration |

**Production notes.** In a long-lived codebase `editor.js` becomes JSX under
`@wordpress/scripts`; `view.js`/`style.css` are built from one shared source package instead
of being copied; and the WWF display font ships as a theme asset rather than being assumed.
