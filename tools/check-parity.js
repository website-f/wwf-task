#!/usr/bin/env node
/* ===========================================================================
   Renderer parity check.

   "It works with any CMS" is only worth saying if the renderers actually agree.
   This asserts that the WordPress/PHP path and the JavaScript path produce the
   SAME webpart from the SAME content — same number of steps, same hotspot
   coordinates, same headings, same card order, same side assignments.

   It compares:
     A. the live WordPress page  (render.php, server-side)
     B. the headless adapter     (scrollmap-render.js, in the browser)
     C. scrollmap-render.js run in Node (server-side render for Eleventy/Astro/…)

   Run:   node tools/check-parity.js
   Needs: the docker stack up (localhost:8280) and a static server for the repo.
          Both are started for you if they are not already running.
   ======================================================================== */

'use strict';

const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const WP = process.env.WP_URL || 'http://localhost:8280/';
const STATIC_PORT = 8399;
const HEADLESS = `http://localhost:${STATIC_PORT}/src/adapters/headless/index.html`;

/* ---- a fingerprint of the rendered webpart, independent of formatting ---- */
const FINGERPRINT = () => {
  const sec = document.querySelector('[data-tgr]');
  if (!sec) return null;
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  return {
    focal: sec.dataset.focal,
    paws: sec.dataset.paws,
    markers: sec.dataset.markers,
    rail: sec.dataset.rail,
    steps: [...sec.querySelectorAll('.step')].map((st) => ({
      wide: st.classList.contains('step--wide'),
      side: st.dataset.side,
      zoom: st.dataset.zoom,
      label: norm(st.dataset.label),
      box: st.dataset.hotspot
        ? (() => { const b = JSON.parse(st.dataset.hotspot);
                   return [b.x, b.y, b.w, b.h].map(Number).join(','); })()
        : null,
      num: norm((st.querySelector('.card__num') || {}).textContent),
      title: [...st.querySelectorAll('.h2 .w > span')].map((s) => norm(s.textContent)).join(' | '),
      badge: norm((st.querySelector('.card__status') || {}).textContent),
      level: (st.querySelector('.card__status') || {}).dataset
        ? (st.querySelector('.card__status').dataset.level || '') : '',
      paras: [...st.querySelectorAll('.card p:not(.lede)')].map((p) => norm(p.textContent)).length,
      lede: [...st.querySelectorAll('.card p.lede')].map((p) => norm(p.textContent)).length,
      hasImg: !!st.querySelector('.card__shot img'),
      caption: norm((st.querySelector('figcaption') || {}).textContent)
    }))
  };
};

function serveStatic(port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
                  '.woff': 'font/woff' };
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); return res.end('nope'); }
        res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(port, () => resolve(srv));
  });
}

function diff(a, b, labelA, labelB) {
  const out = [];
  const A = JSON.stringify(a, null, 1).split('\n');
  const B = JSON.stringify(b, null, 1).split('\n');
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] !== B[i]) out.push(`  line ${i}: ${labelA}=${A[i]} ${labelB}=${B[i]}`);
    if (out.length > 12) { out.push('  …'); break; }
  }
  return out;
}

(async () => {
  const srv = await serveStatic(STATIC_PORT);
  const browser = await chromium.launch();
  let failures = 0;

  const grab = async (url, label) => {
    const pg = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForTimeout(2500);
    const fp = await pg.evaluate(FINGERPRINT);
    await pg.close();
    if (errs.length) console.log(`  ! ${label} console: ${errs[0]}`);
    if (!fp) throw new Error(`${label}: no [data-tgr] section rendered`);
    return fp;
  };

  console.log('Scroll Map — renderer parity\n');

  // C. Node-side render of the same JSON the headless adapter uses
  const ScrollMapRender = require(path.join(ROOT, 'src/core/scrollmap-render.js'));
  const content = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src/adapters/headless/content.json'), 'utf8'));
  const check = ScrollMapRender.validate(content);
  console.log(`content.json validates: ${check.ok ? 'yes' : 'NO — ' + check.errors.join('; ')}`);
  if (!check.ok) failures++;

  const nodeHtml = ScrollMapRender(content);
  const nodePage = path.join(ROOT, 'src/adapters/headless/.parity-node.html');
  fs.writeFileSync(nodePage,
    `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../../core/scrollmap.css">` +
    nodeHtml +
    `<script src="../../core/vendor/gsap.min.js"></script>` +
    `<script src="../../core/vendor/ScrollTrigger.min.js"></script>` +
    `<script src="../../core/scrollmap.js"></script>`);

  const A = await grab(WP, 'WordPress (render.php)');
  const B = await grab(HEADLESS, 'headless (browser render)');
  const C = await grab(`http://localhost:${STATIC_PORT}/src/adapters/headless/.parity-node.html`,
                       'Node (server render)');

  console.log(`\nsteps rendered   WordPress ${A.steps.length} · headless ${B.steps.length} · Node ${C.steps.length}`);

  const pairs = [['WordPress', A, 'headless', B], ['headless', B, 'Node', C]];
  for (const [la, a, lb, b] of pairs) {
    const same = JSON.stringify(a) === JSON.stringify(b);
    console.log(`${same ? 'MATCH  ' : 'DIFFER '} ${la} vs ${lb}`);
    if (!same) { failures++; diff(a, b, la, lb).forEach((l) => console.log(l)); }
  }

  fs.unlinkSync(nodePage);
  await browser.close();
  srv.close();

  console.log(failures
    ? `\n${failures} mismatch(es) — the renderers have drifted apart.`
    : '\nAll three renderers agree. The content contract holds across CMSs.');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
