#!/usr/bin/env node
/* ===========================================================================
   Build the installable WordPress plugin .zip.

   This is the artefact you hand someone with an empty WordPress. They do
   Plugins → Add New Plugin → Upload Plugin → Activate, and the "Scroll Map"
   block appears in their editor. Nothing else is required — no build step on
   their side, no npm, no composer, no CDN.

     node tools/build-plugin-zip.js          → dist/wwf-scrollmap-<version>.zip

   The zip contains ONE top-level folder, `wwf-scrollmap/`, which is what the
   WordPress uploader expects. Files are taken from src/wp-plugin/wwf-scrollmap
   after tools/sync-core.js has copied src/core into it, so the shipped plugin
   can never contain a stale engine.
   ======================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { writeZip } = require('./lib/zip');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/wp-plugin/wwf-scrollmap');
const DIST = path.join(ROOT, 'dist');
const SLUG = 'wwf-scrollmap';

/* Never ship editor noise or OS junk. */
const SKIP = [/(^|[\\/])\./, /\.map$/, /~$/, /Thumbs\.db$/i, /\.DS_Store$/];

function version() {
  const php = fs.readFileSync(path.join(SRC, 'wwf-scrollmap.php'), 'utf8');
  const m = /^\s*\*\s*Version:\s*(.+)$/m.exec(php);
  return m ? m[1].trim() : '0.0.0';
}

function walk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (SKIP.some((re) => re.test(name))) continue;
    if (fs.statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push({ abs, rel });
  }
  return out;
}

/* ---- the plugin must actually be loadable before we ship it ------------- */
function preflight(files) {
  const problems = [];
  const names = files.map((f) => f.rel);

  for (const required of ['wwf-scrollmap.php', 'block.json', 'render.php',
                          'editor.js', 'view.js', 'style.css',
                          'vendor/gsap.min.js', 'vendor/ScrollTrigger.min.js']) {
    if (!names.includes(required)) problems.push(`missing ${required}`);
  }

  const php = fs.readFileSync(path.join(SRC, 'wwf-scrollmap.php'), 'utf8');
  if (!/^\s*\*\s*Plugin Name:/m.test(php)) {
    problems.push('wwf-scrollmap.php has no "Plugin Name:" header — WordPress will not see it as a plugin');
  }

  // block.json must parse, and every file: reference must exist
  const block = JSON.parse(fs.readFileSync(path.join(SRC, 'block.json'), 'utf8'));
  for (const key of ['editorScript', 'editorStyle', 'style', 'viewScript', 'render']) {
    const v = block[key];
    if (!v) continue;
    const rel = String(v).replace(/^file:\.\//, '');
    if (!names.includes(rel)) problems.push(`block.json ${key} points at ${rel}, which is not in the package`);
  }
  return problems;
}

/* ------------------------------------------------------------------------ */

const files = walk(SRC);
const problems = preflight(files);
if (problems.length) {
  console.error('Refusing to build:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

const v = version();
fs.mkdirSync(DIST, { recursive: true });
const zipPath = path.join(DIST, `${SLUG}-${v}.zip`);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

/* Every entry is prefixed with the slug, because WordPress installs the zip's
   single top-level directory and that name becomes the plugin folder.
   Paths use forward slashes — see tools/lib/zip.js for why that is not
   delegated to the shell. */
writeZip(zipPath, files.map((f) => ({
  name: SLUG + '/' + f.rel,
  data: fs.readFileSync(f.abs)
})));

const kb = (fs.statSync(zipPath).size / 1024).toFixed(0);
console.log(`${path.relative(ROOT, zipPath)}  (${kb} KB, ${files.length} files)`);
console.log('\nInstall on any WordPress 6.4+:');
console.log('  Plugins → Add New Plugin → Upload Plugin → choose this file → Install Now → Activate');
console.log('  or:  wp plugin install ' + path.basename(zipPath) + ' --activate');
