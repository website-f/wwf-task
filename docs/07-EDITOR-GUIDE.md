# Scroll Map — guide for content editors

How to put a scroll map on a page and change everything in it. No code, no coordinates.
If you can add an image to a page in WordPress, you can do all of this.

**What a scroll map is:** one big picture — usually a map — that stays on screen while the
reader scrolls. As they scroll, the picture zooms in on one place after another, and a card
of text and photos comes in beside it. Each place-plus-card is called a **chapter**.

---

## 1. Put one on a page

1. **Pages → Add New** (or open an existing page).
2. Click the **+** button.
3. Type `scroll map` and click **Scroll Map**.
4. The block asks for a picture. Click **Media Library** or **Upload**, and choose your map.

That's it — the block is on the page. Everything else is changing what's in it.

> **Tip:** give your map image proper **alt text** in the Media Library. The block will
> remind you if you forget. Alt text is what a blind reader hears instead of the picture.

---

## 2. The three places you edit things

| Where | What you change there |
|---|---|
| **The map picture** in the middle of the screen | The coloured boxes — which part of the map each chapter zooms to |
| **The card below the map** | The heading, the text, the little status label |
| **The settings panel on the right** | Everything else: which photo, the labels, the colours, the order of chapters |

If the right-hand panel is not showing, click the **⚙ settings icon** at the top right, then
the **Block** tab.

---

## 3. Chapters: add, reorder, remove

Open the **Chapters** panel on the right. You'll see a numbered list.

| To do this | Do this |
|---|---|
| **See / edit a chapter** | Click its row. The map highlights its box, and the card below shows its text |
| **Move it earlier or later** | The **↑** and **↓** buttons on its row |
| **Make a copy** | The **⧉** button — handy for a chapter that's similar to one you already have |
| **Delete it** | The **🗑** button. It asks you to confirm |
| **Add a new one** | **+ Map chapter** (zooms to a place) or **+ Text chapter** (no zoom — good for an opening or closing message) |

The order in the list is the order readers see. Nothing else needs changing when you reorder
— numbering on the map follows automatically.

> **Just want to see a finished example?** On a brand-new block, the Chapters panel has a
> **Load the tiger demo content** link. It fills in eight complete chapters so you can look
> at how one is put together, then change them.

---

## 4. Choosing the place on the map (the fun bit)

Select a chapter, then, on the map picture:

- **Drag a new box** — click **Draw region**, then drag a rectangle over the place you want.
- **Move a box** — drag it from its middle.
- **Resize a box** — drag one of the four white corner squares.
- **Pick a different chapter's box** — click its round numbered badge. (Badges are always
  clickable, even where two boxes overlap.)

Whatever you draw is where the map zooms to when the reader reaches that chapter.

**Two helpful things on screen:**

- **Layout guide** (toggle it under the map): a dashed box showing where the region will end
  up on the reader's screen, and a green box showing where the card will sit. They are always
  on opposite sides — that is deliberate, so the card can never cover the place you are
  talking about.
- **Card side** in the chapter settings: *Card right · map left* or *Card left · map right*.
  Alternating them down the page gives a nice rhythm.

If you would rather type exact numbers, the **X / Y / W / H** boxes at the bottom of the
chapter settings are the same values. You never have to touch them.

---

## 5. Writing a chapter

### In the card below the map

| Field | Notes |
|---|---|
| **Heading** | The big display type. **Press Enter to break the line** — each line slides in separately, so `Sambar` ⏎ `deer` looks better than one long line |
| **Status chip** | The little pill under the heading, e.g. `IUCN · Vulnerable`. Leave it empty to hide it |
| **Body** | Normal typing. Select text to make it **bold**, *italic*, or a link, exactly like any other WordPress block |

### In the settings panel

| Field | What it does |
|---|---|
| **Chapter type** | *Map chapter* zooms to a region. *Text chapter* stays on the wide view — use it for the opening and closing |
| **Card side** | Which half of the screen the card sits in |
| **Region label** | Short place name, e.g. `India & Nepal`. Appears on the green badge over the map and in the chapter bar at the bottom of the screen |
| **Number** | The small number on the card, e.g. `01`. Optional |
| **Status chip colour** | Neutral, green, amber or coral — for example coral for Endangered |
| **Photo** | Choose from the Media Library. Give it alt text there |
| **Photo caption / credit** | Sits under the photo. This is where the photographer credit goes |
| **Zoom strength** | How hard the map pushes in on this region. `1` is normal; lower is gentler, higher is tighter |

---

## 6. Settings for the whole block

### Map panel

- **Replace map image** — swap the picture. Your chapter boxes stay where they are, as
  percentages, so if the new picture shows the same area they still line up.
- **Section title** — *required*. Not visible on the page; it's what screen readers announce
  and what search engines read. Something like `Tiger range countries`.
- **Framing — horizontal / vertical** — a wide picture can't fit a tall screen without some
  of it being cut off. These two sliders choose which part survives. `0` horizontal keeps the
  **left** edge (right for our map, because the title and legend live on the left), `100`
  keeps the right, `50` keeps the middle.

### Motion panel

- **Paw-print trail** — animal tracks walk across the screen from the last place to the next.
- **Numbered pins** — small pins on the map at each chapter's region.
- **Chapter rail** — the row of dots along the bottom that readers can click to jump.

Turn any of them off if the page feels busy.

> Readers who have asked their phone or computer to **reduce motion** (an accessibility
> setting) automatically get the same content with the flying and zooming switched off. You
> don't have to do anything.

### Colours panel

Accent, text, backdrop and card colours, plus two sliders: how much the map dims outside the
highlighted region, and how see-through the cards are. The swatches are the brand palette;
the custom picker is there if you need something else.

---

## 7. Check it before it goes live

1. **Preview → Desktop / Tablet / Mobile** in the top bar — the block is built to work on all
   three. On a phone the map keeps its own window at the top of the screen and the cards slide
   in sideways underneath it, so the text never covers the map.
2. **Preview → Preview in new tab** — this is the real page, exactly as a visitor will see it,
   while the page is still a draft. Scroll it end to end.
3. **Publish.**

### If Publish is greyed out

The block is telling you something is missing. Look at the top of the settings panel: a red
**Fix before publishing** box lists exactly what. The usual ones:

| Message | What to do |
|---|---|
| A background map image is required | Choose a map in the Map panel |
| A section title is required | Fill in Section title in the Map panel |
| Chapter *n* needs a heading or body text | That chapter is empty — write something, or delete it |
| Chapter *n*: map chapters need a region | Draw a box for it, or change its type to *Text chapter* |

Rows with a problem are also outlined in red in the Chapters list, so you can find them fast.

Separately, an amber **Accessibility** box may warn that a photo has no alt text. That one
will not stop you publishing — but please fix it.

---

## 8. Everyday questions

**I made a mistake.** `Ctrl+Z` (`Cmd+Z` on a Mac) undoes anything, including deleting a
chapter or moving a box. Every past version of the page is also under
**Page → Revisions**.

**Can I use this block for something other than a map?** Yes. Nothing in it is tiger- or
map-specific — it works for any big picture you want to walk a reader around: a floor plan, a
diagram, a satellite photo, an illustration.

**Can I have two on one page?** Yes, as many as you like.

**Will it look right on a phone?** Yes — the map gets its own window at the top and the cards
slide in sideways beneath it. Use Preview → Mobile to check your own content. Long chapter text
is the one thing to watch: the card is capped in height so it can never cover the map, so aim
for about one screen of text per chapter, and split anything longer into two.

**Someone else needs the same map on another page.** Select the block, choose **Copy** from
its ⋮ menu, and paste it into the other page. Or save it as a **synced pattern** so that
editing it once updates it everywhere.
