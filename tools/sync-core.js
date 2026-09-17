#!/usr/bin/env node
/* ===========================================================================
   Copy src/core/ into the WordPress plugin, and verify it stayed copied.

   WordPress enqueues assets from the plugin directory, so the plugin needs its
   own copies of the stylesheet, the engine and GSAP. That is a packaging
   constraint, not a fork — src/core/ is the single source, and this script is
   the build step that would run in CI.

     node tools/sync-core.js          copy core → plugin
     node tools/sync-core.js --check  fail (exit 1) if they have drifted

   The Drupal and SPFx adapters have the same constraint and the same answer:
   copy core/ into the theme or the SiteAssets library, never edit it there.
   ======================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'src/core');
const PLUGIN = path.join(ROOT, 'src/wp-plugin/wwf-scrollmap');
const CHECK = process.argv.includes('--check');

/* core file → plugin file. view.js is the one that is not a byte copy: WordPress
   decides where the script tag lands, so it gets a DOM-ready boot. The header
   note records that, so nobody "fixes" the difference by hand. */
const FILES = [
  ['scrollmap.css', 'style.css', null],
  ['scrollmap-render.js', 'scrollmap-render.js', null],
  ['vendor/gsap.min.js', 'vendor/gsap.min.js', null],
  ['vendor/ScrollTrigger.min.js', 'vendor/ScrollTrigger.min.js', null],
  ['scrollmap.js', 'view.js', (src) => src.replace(
    '   THE webpart’s engine.',
    '   Copied from src/core/scrollmap.js by tools/sync-core.js — do not edit here.\n\n   THE webpart’s engine.'
  )]
];

let drift = 0;

for (const [from, to, transform] of FILES) {
  const a = path.join(CORE, from);
  const b = path.join(PLUGIN, to);
  const isText = /\.(css|js)$/.test(from) && !from.startsWith('vendor/');
  const src = fs.readFileSync(a, isText ? 'utf8' : null);
  const want = transform && isText ? transform(src) : src;

  const exists = fs.existsSync(b);
  const have = exists ? fs.readFileSync(b, isText ? 'utf8' : null) : null;
  const same = exists && (isText ? have === want : Buffer.compare(have, want) === 0);

  if (same) {
    console.log(`  ok      ${from}  ->  ${to}`);
    continue;
  }
  if (CHECK) {
    console.log(`  DRIFTED ${from}  ->  ${to}`);
    drift++;
  } else {
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.writeFileSync(b, want);
    console.log(`  copied  ${from}  ->  ${to}`);
  }
}

if (CHECK && drift) {
  console.log(`\n${drift} file(s) differ from src/core. Run: node tools/sync-core.js`);
  process.exit(1);
}
console.log(CHECK ? '\nPlugin is in sync with src/core.' : '\nDone.');
