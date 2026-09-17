# Assets Checklist

## Downloaded from the original story (in `research/assets/`)

| File | Use | Status |
|---|---|---|
| `3eu9hIfPcs_aug24-100.jpg` (2561×1224, 1.1MB) | Desktop map background | ✅ |
| `wwf.woff` (39KB) | Heading font (@font-face "WWF", used for both 400/700) | ✅ |
| `BvyXbPiVOn_original_ww185785-3928x2497.jpg` | Point 2 — Sambar deer | ✅ |
| `P2gHOlWin9_original_ww258518-4096x2731.jpg` | Point 3 — Wild pig | ✅ |
| `xmkBFFcFGD_medium_ww194699-1200x803.jpg` | Point 4 — Banteng | ✅ |
| `WbQV1BXq2l_3-1797x1080.jpg` | Point 5 — Bukhara deer | ✅ |
| `xBiuUDSFoL_original_ww2138425-4096x2731.jpg` | Point 6 — Nilgai | ✅ |
| `BMjVFF4ZeJ__ww1118135-2288x1762.jpg` | Point 7 — Chital | ✅ |
| `APg3zWfgw2_phone_tiger-pop-info-2-750x1333.jpg` | Mobile portrait map (reference only — see note) | ✅ |
| `DBwWeP1GTP_phone_tiger-pop-info-3-750x1333.jpg` | Mobile portrait map (reference only — see note) | ✅ |

> The two portrait crops are **reference, not shipped**. The original duplicates the whole
> section for mobile with hand-cropped artwork; the rebuild pans the single desktop map
> instead, so mobile needs no second image and editors enter content once. A `mobileImage`
> field is the planned refinement (see `02-CMS-INTEGRATION-PLAN.md` §1a).

## Shipped in `src/standalone/assets/` — done

| File | Size | Note |
|---|---|---|
| `map.jpg` | 1.1MB | 2561×1224, the original artwork unchanged — it is the one thing that must stay sharp |
| `sambar.jpg` · `wildpig.jpg` · `banteng.jpg` · `bukhara.jpg` · `nilgai.jpg` · `chital.jpg` | 142–375KB each | resized to ~1200–1400w (the 4096px originals were wasteful — cards are 6 of 12 columns) |
| `wwf.woff` | 39KB | the real heading font, `font-display: swap` |

- [x] Prey photos resized/recompressed (≈9MB → ≈1.4MB total)
- [x] `loading="lazy"` on card images, `fetchpriority="high"` on the map, explicit
      `width`/`height` on every image against CLS
- [ ] **Open Sans is loaded from Google Fonts**, with a `"Segoe UI", Arial, sans-serif`
      fallback stack — so the page still renders correctly offline, just in the system
      font. Self-hosting the woff2 (400 / 400italic / 600 / 700) is the production move
      and a 10-minute change; say so if asked rather than claiming it's already offline.
- [ ] AVIF/WebP renditions with `<picture>` — skipped for the standalone file on purpose:
      in the CMS this is automatic via `wp_get_attachment_image()` and the media library,
      which is the better answer than hand-rolling it here.

## Licensing / usage note

All imagery and the WWF font are © WWF and their photographers (credits preserved in the
captions). Used here **solely for a WWF interview assignment replicating their own page** —
not for redistribution. Keep the repo private; say this if asked about asset provenance.

## Verification snapshots — captured

See [`../research/shots/README.md`](../research/shots/README.md) for which file is the
original and which is the rebuild.

- [x] Original at 1600×900: intro state, sambar/wild-pig spotlight states
- [x] Original mobile at 390×844
- [x] The same states from the rebuild (`verify-*`) for side-by-side comparison
