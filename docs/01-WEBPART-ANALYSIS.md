# Webpart Analysis — Reverse-Engineered Spec

Source: `research/reference-page.html` (downloaded 2026-09-14).
Section id in original DOM: `#section-tgP4G4z9av`
`class="Theme-Section Theme-ScrollpointsSection Theme-Section-Position-3 Theme-Section-Layout--Full Theme-Section-Light Theme-Section-HasOverlay"`

The page is a Shorthand story. Desktop and mobile are **separate sections**:
- Position 3 = desktop Scrollpoints section (this spec) — hidden under 900px by the
  page structure (the mobile variant at Position 2 carries `Display--md-none`, i.e.
  mobile-only; the desktop title has `Display--none Display--md-block`).
- Position 2 = mobile "BackgroundScrollmation" variant with portrait map crops
  (`phone_tiger-pop-info-*.jpg`, 750×1333 etc.).

---

## 1. DOM anatomy (desktop section)

```
div.Theme-Section.Theme-ScrollpointsSection.Theme-Section-Light
└── div.Scrollpoints                       ← container, padding-bottom:20vh
    ├── div.Scrollpoints__media            ← the pinned map layer
    │     data-media="aug24-100.jpg"  data-color="#000"  data-opacity="10"
    │     (runtime JS injects: <img>, dim overlay div, highlight div)
    └── div.Scrollpoints__points
        ├── div.Scrollpoints__point        ← one per step
        │   └── div[data-item-id][data-box='{"highlights":[…]}'][data-align]
        │       └── grid → column → div.Theme-Layer-BodyText (the card)
        │           ├── .Theme-Layer-BodyText--inner (h2, p, figure…)
        │           └── .Theme-Overlay (card bg, style="opacity:0.85")
        └── … 8 points total
```

### Runtime behavior (Shorthand JS, to reimplement)
- `.Scrollpoints__media` gets `data-attach` = `before | during | after`:
  - before → `position:absolute; top:0; left:0`
  - during → `position:fixed; top:0; left:0`   ← pinned while section in view
  - after  → `position:absolute; bottom:0` (height 100vh)
- Active point determined by scroll position; its highlight box is applied to a single
  `.Theme-Scrollpoints-Highlight` element which **transitions 0.8s** between boxes.
- Dim layer `.Theme-Scrollpoints` (black, opacity .5) only visible when the active
  point has a highlight.

## 2. The 8 scrollpoints (exact content + coordinates)

Coordinates are % of the map image. `box` = highlight rectangle (x,y = top-left, w,h),
`align` = card column position. Dots (`hasDot:false`) are unused in this story.

| # | align | Card content | Highlight box (x, y, w, h) |
|---|-------|-------------|------------------------------|
| 1 | center | Intro (no heading): "We talk a lot about *tiger prey*, but what animals do tigers eat?" / "The most important tiger prey are often ungulates, which are mammals with hooves, such as large deer, wild cattle, and wild pigs. Let's take a look at some of the places where tiger prey are found." | none — map fully bright |
| 2 | right | **SAMBAR DEER** + photo `original_ww185785` (3928×2497). Caption: "Sambar foal and its mother in Ranthambore Tiger Reserve, India © Martin Harvey / WWF" | 48.5, 43.0, 17.1, 39.3 (India/Nepal region) |
| 3 | left | **WILD PIG** + photo `original_ww258518` (4096×2731). Caption: "Wild boar have brown fur that provides excellent camouflage in the forest. © Ola Jennersten / WWF-Sweden" | 66.5, 79.4, 20.0, 22.6 (Sumatra/Indonesia) |
| 4 | right | **BANTENG** + photo `medium_ww194699` (1200×803). Caption: "A male banteng photographed in Kuiburi National Park, Thailand. © Wayuphong Jitvijak / WWF-Greater Mekong". Second paragraph contains external link (sciencedirect) styled `#1155cc` underlined. | 66.2, 55.5, 14.0, 18.3 (Thailand) |
| 5 | right | **BUKHARA DEER** + photo `3-1797x1080`. Caption: "Newly released bukhara deer, Kazakhstan. © WWF" | 52.0, 16.0, 15.5, 20.0 (Kazakhstan) |
| 6 | right | **NILGAI** + photo `original_ww2138425` (4096×2731). Caption: "Nilgai spotted in Ranthambore Tiger Reserve, India. © Ola Jennersten / WWF-Sweden" | 46.2, 42.0, 17.7, 33.9 (India) |
| 7 | left | **CHITAL** + photo `_ww1118135` (2288×1762). Caption: "Chital recorded on camera traps set up to monitor wildlife in the Khata Corridor, Nepal. © DoFSC / WWF Nepal" | 56.4, 40.7, 11.4, 14.8 (India/Nepal/Bangladesh) |
| 8 | center | Outro: "These are just a few examples of the many tiger prey species, other important ungulates for tigers in parts of their range include gaur, roe deer, sika deer, hog deer, muntjac, barasingha, and eld's deer." | none |

Grid mapping of `align` (12-col grid):
- center → `col-6 offset-3` (lg & md)
- right  → `col-6 offset-6`
- left   → `col-6 offset-0`
- sm: `col-10 offset-0`; xs: `col-12 offset-0` (all alignments)

## 3. Typography

| Role | Spec |
|---|---|
| Headings (h2 in cards, titles) | `font-family:"WWF",sans-serif` (local `wwf.woff`, weight 400 & 700 both map to same file); `text-transform:uppercase`; `font-size:220%` base, `250%` ≥ larger breakpoint; `line-height:1.1`; `margin:1.5rem 0`; color inherits (#000 here) |
| Body | `font-family:"Open Sans",sans-serif`; color `#000`; antialiased |
| Base font-size (on `.Theme-Story`) | 17px default → 18px / 20px / 22px stepping up at wider breakpoints (Shorthand steps at ~620/1100/1600) |
| Card paragraphs | margin `.5em 0` |
| Captions | `.Theme-Caption` — smaller size (~65–75%), muted; verify in DevTools during build |
| em in intro ("tiger prey") | italic |

## 4. Colors & effects

| Token | Value |
|---|---|
| Text | `#000` (custom class KVMNtE = rgb(0,0,0)) |
| Links | `#1155cc` (custom class zJLAtO), underlined |
| Card background | white overlay `.Theme-Overlay{background:#fff}` at `opacity:0.85`, `border-radius:.5em` |
| Dim layer | `#000` at `opacity:0.5` (only while a highlight is active) |
| Spotlight window | `border:4px solid #2a6788`; interior shows undimmed map (`background-size:contain` on the same image); `transition-duration:0.8s` |
| Marker/dot (unused here) | `#0b987e`, 30px, 1px black border |
| Section theme | Light |

## 5. Spacing / scroll rhythm

```css
.Scrollpoints            { padding-bottom: 20vh; }
.Scrollpoints__point     { padding-top: 50vh; padding-bottom: 30vh; }
.Scrollpoints__point:first-child { padding-top: 85vh; }
.Scrollpoints__media     { width: 100%; min-height: 100vh; z-index: 0; }
```
Card inner padding: 10px top/bottom (≥620px), 20px (≥1100px); card width 95% under 1200px.
Layout max-width: 1560px (≥1750px viewport: wider), gutters via Layout grid.

## 6. Breakpoints (Shorthand grid)

- xs < 620px, sm ≥ 620px, md ≥ 900px (`Display--md-*` toggles at 900; `<source media="(min-width:901px)">`), lg ≥ 1100px, xl ≥ 1200px, max-width caps 1560px/2000px.
- **< 900px**: desktop section hidden; mobile variant = portrait map images
  (750×1333 …4096×7282) as a background scrollmation with the same card content.
  Our rebuild: single component, CSS/JS switch at 900px to portrait image +
  simplified full-bright (no spotlight) stacked flow — matching original UX.

## 7. Media/asset inventory

All downloaded to `research/assets/` from the original:

| File | Role |
|---|---|
| `3eu9hIfPcs_aug24-100.jpg` | **The map** (title, labels, counts, legend baked in) |
| `wwf.woff` | WWF heading font |
| `BvyXbPiVOn_original_ww185785-3928x2497.jpg` | Sambar deer |
| `P2gHOlWin9_original_ww258518-4096x2731.jpg` | Wild pig |
| `xmkBFFcFGD_medium_ww194699-1200x803.jpg` | Banteng |
| `WbQV1BXq2l_3-1797x1080.jpg` | Bukhara deer |
| `xBiuUDSFoL_original_ww2138425-4096x2731.jpg` | Nilgai |
| `BMjVFF4ZeJ__ww1118135-2288x1762.jpg` | Chital |
| `APg3zWfgw2_phone_tiger-pop-info-2-750x1333.jpg` | Mobile portrait map (frame) |
| `DBwWeP1GTP_phone_tiger-pop-info-3-750x1333.jpg` | Mobile portrait map (frame) |

Images lazy-load in the original (tiny GIF placeholder + `data-src`, swap on approach);
`<picture>` with ≥901px / ≤900px sources.

## 8. Accessibility notes (improve on the original)

The original is weak here (empty `alt=""` on the map!). Ours will add:
- Meaningful `alt` on the map ("Map of Asia showing tiger range countries and
  population trends…") + visually-hidden text list of the country data (the baked-in
  labels are invisible to screen readers).
- `aria-hidden` on the duplicated spotlight image; captions via `<figcaption>`.
- Keyboard: cards are in normal document flow (scroll = native), links focusable.
- `prefers-reduced-motion` → disable the 0.8s travel, snap states.
