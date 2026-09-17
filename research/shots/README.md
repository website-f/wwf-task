# Screenshot evidence — which file is which

All captured in headless Chromium at fixed viewports and fixed scroll positions, so the
original and the rebuild can be compared like for like. If anyone asks "how do you know?",
open two of these side by side.

| Prefix | What it is | Viewport |
|---|---|---|
| `desktop-intro`, `desktop-sambar`, `desktop-wildpig`, `desktop-top` | **THE ORIGINAL** — wwftigers.shorthandstories.com, captured live | 1600×900 |
| `mobile-sambar` | **THE ORIGINAL**, its separate mobile section | 390×844 |
| **`new-d0…d7`** | **THE CURRENT BUILD**, standalone, one per chapter | 1600×900 |
| **`new-m0…m7`** | **THE CURRENT BUILD**, standalone, phone layout | 390×844 |
| `new-paws`, `new-midflight` | mid-transition frames: the paw trail walking between regions, and the camera in flight | 1600×900 |
| **`wp-0…wp-7`** | **THE CURRENT BUILD rendered by WordPress** — should be indistinguishable from `new-d*` | 1600×900 |
| `wp-editor-canvas`, `wp-editor-sidebar`, `wp-editor-preview`, `wp-editor-drag` | the **block editor**: region boxes on the map, the sidebar panels, the live card preview, the drag interaction | 1600×1000 |
| `verify-*`, `v2-*`, `desktop-p0…p4` | the earlier **faithful** rebuild, kept deliberately — this is what "as close to the original as possible" looked like before the redesign | mixed |

## The comparisons worth showing

| Show this | Against this | Point at |
|---|---|---|
| `desktop-intro.png` (original) | `verify-intro-faithful.png` | how close the faithful version got — same crop, same card column, same line breaks |
| `verify-sambar-faithful.png` | `new-d1.png` | the redesign: same region, same coordinates, camera flies and zooms instead of dimming |
| `new-d1.png` | `new-m1.png` | the responsive rule — desktop card beside the region, phone card *below* a map window |
| `new-d2.png` | `wp-2.png` | standalone vs WordPress, rendered from block attributes |
| `wp-editor-canvas.png` | — | Task 2's whole argument: an editor drawing regions on the real map |

## How to regenerate

Drive `src/standalone/index.html` (or `http://localhost:8280/`) with Playwright: scroll each
`.step` so its top sits at the viewport top — that is its resting state, with the camera
flight complete — wait ~1.5s for the scrub to settle, and screenshot. `research/shot-harness.html`
is an older iframe-based helper and is no longer the easiest route.
