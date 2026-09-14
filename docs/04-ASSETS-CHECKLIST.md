# Assets Checklist

## Downloaded from the original story (in `research/assets/`)

| File | Use | Status |
|---|---|---|
| `3eu9hIfPcs_aug24-100.jpg` (2561×1224 class, 1.1MB) | Desktop map background | ✅ |
| `wwf.woff` (39KB) | Heading font (@font-face "WWF", used for both 400/700) | ✅ |
| `BvyXbPiVOn_original_ww185785-3928x2497.jpg` | Point 2 — Sambar deer | ✅ |
| `P2gHOlWin9_original_ww258518-4096x2731.jpg` | Point 3 — Wild pig | ✅ |
| `xmkBFFcFGD_medium_ww194699-1200x803.jpg` | Point 4 — Banteng | ✅ |
| `WbQV1BXq2l_3-1797x1080.jpg` | Point 5 — Bukhara deer | ✅ |
| `xBiuUDSFoL_original_ww2138425-4096x2731.jpg` | Point 6 — Nilgai | ✅ |
| `BMjVFF4ZeJ__ww1118135-2288x1762.jpg` | Point 7 — Chital | ✅ |
| `APg3zWfgw2_phone_tiger-pop-info-2-750x1333.jpg` | Mobile portrait map ref | ✅ |
| `DBwWeP1GTP_phone_tiger-pop-info-3-750x1333.jpg` | Mobile portrait map ref | ✅ |

## Still needed before build

- [ ] **Open Sans** — body font. Plan: Google Fonts `<link>` for dev + downloaded
  woff2 (400, 400italic, 700) committed for the offline demo fallback.
- [ ] Resized/compressed renditions for `src/standalone/assets/`:
  map at 2560w (q80, ~450KB target) + 1280w; prey photos at 1200w (they render
  inside a 6-col card — the 4096px originals are wasteful). Use `ffmpeg` or
  `cwebp`/`squoosh`; keep JPG fallback + WebP.
- [ ] Favicon/nothing else — single-page demo.

## Licensing / usage note

All imagery and the WWF font are © WWF and their photographers (credits preserved in
captions). Used here **solely for a WWF interview assignment replicating their own page** —
not for redistribution. Keep the repo private; say this if asked about asset provenance.

## Verification snapshots to capture during build (for side-by-side fidelity checks)

- [ ] Original at 1920×1080: intro state, sambar spotlight state, wild-pig spotlight state
- [ ] Original mobile (375×812) scrollmation states
- [ ] Same three states from the rebuild for A/B comparison in the demo deck
