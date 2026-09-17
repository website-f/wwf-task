# Scroll Map — guide for content editors

Four things to do. The block walks you through them, and ticks them off as you go.

**What it is:** one big picture — usually a map — that stays on screen while the reader
scrolls. As they scroll, the picture zooms to one place after another, and text appears
beside it. Each place-plus-text is a **hotspot**.

---

## 1. Add it to a page

1. **Pages → Add New Page**, or open an existing page.
2. On the empty line, type `/scroll map` and press **Enter** — or click **+**, type
   `scroll map`, click **Scroll Map**.
3. It asks for a picture — choose your map from the Media Library.

Done. You can put more than one on the same page if you need to.

> **In a hurry, or just want to see it work?** Once the map is in, panel **3 · Hotspots** has
> an **Or load the tiger example** link. It fills in the title, the text and six ready-made
> hotspots — *and finds their photos in the Media Library for you*. Then edit it into your own
> content. It only appears while there are no hotspots, so it can never overwrite your work.

**Screenshot-by-screenshot version of this whole flow:**
[08-ADD-TO-A-PAGE.md](08-ADD-TO-A-PAGE.md) · **Can't find "Scroll Map" in the list?** The
plugin isn't installed on that site yet — ask whoever looks after it, and point them at
[09-INSTALLING.md](09-INSTALLING.md).

> Give the map proper **alt text** in the Media Library. The block will remind you if you
> forget. Alt text is what a blind reader hears instead of the picture.

---

## 2. Fill in the words

Open the settings panel on the right (the **⚙** icon, then the **Block** tab).

### Panel "1 · Section"

| Field | What it's for |
|---|---|
| **Section title** | *Required.* The big heading on the opening card — and what screen readers and Google read. Press **Enter** to break the line where you want it |
| **Lead text** | Your introduction, shown before the first hotspot. **One paragraph per line** |
| **Closing text** | Optional. A final card after the last hotspot |

### Panel "2 · Map image"

Swap the picture here at any time. Hotspots are stored as percentages of the image, so a new
version of the same map keeps them all in place.

### Each hotspot's own words

Select a hotspot (see step 3), then type straight into the **card preview underneath the
map** — the title and the body text are edited right there, in the card, as it will look.
Select text to make it **bold**, *italic*, or a link, exactly like any other block.

---

## 3. Hotspots — add, edit, reorder, remove

Everything is in panel **3 · Hotspots**.

| To do this | Do this |
|---|---|
| **Add** | **+ Add hotspot**. It drops you straight into drawing mode — drag a box on the map |
| **Edit** | Click its row. The map highlights it and the card below shows its text |
| **Reorder** | **↑** and **↓** on its row. Numbering follows automatically — nothing else to change |
| **Duplicate** | **⧉** — useful when the next one is similar |
| **Remove** | **🗑**, then confirm |

The order in the list is the order readers see.

### Drawing the hotspot on the map

With a hotspot selected, on the picture itself:

- **Draw it** — click **Redraw on map**, then drag a box over the place.
- **Move it** — drag the box from its middle.
- **Resize it** — drag one of its four white corners.
- **Pick another one** — click its round numbered badge. Badges stay clickable even where
  boxes overlap.

You never have to type coordinates. (If you want to, the numbers are under **Advanced**.)

### Two things on screen that help

- **The layout guide** (toggle under the map): a dashed box showing where the map will zoom
  to, and a green box showing where the text will sit. They are always on opposite sides —
  that is deliberate, so the text can never cover the place you are talking about.
- **Which side is the text on?** in the hotspot's settings. Alternating it down the page
  gives a nice rhythm.

### Per hotspot, in the settings panel

| Field | What it does |
|---|---|
| **Location label** | Short place name, e.g. `India & Nepal`. Shown on the badge over the map and in the jump bar at the bottom |
| **Which side is the text on?** | Text right · map left, or text left · map right |
| **Image** + **Caption / credit** | The photo for this hotspot. Give it alt text in the Media Library |

---

## 4. Preview, then publish

1. **Preview → Desktop / Tablet / Mobile** in the top bar. On a phone the map keeps its own
   window at the top and the cards slide in sideways underneath, so the text never covers
   the map — but check your own content at that size.
2. **Preview → Preview in new tab** — the real page, exactly as a visitor sees it, while it
   is still a draft. Scroll it end to end.
3. **Publish.**

### If Publish is greyed out

The **Before you publish** panel at the top of the settings tells you exactly what is
missing, and rows with a problem are outlined red in the hotspot list.

| It says | Do this |
|---|---|
| Choose a map image | Panel 2 |
| Write a section title | Panel 1 |
| Add at least one hotspot | Panel 3 → + Add hotspot |
| Hotspot *nn* — give it a title or some text | That one is empty. Write something, or delete it |

A separate amber note may say an image has no alt text. That one will **not** stop you
publishing — but please fix it.

---

## Everyday questions

**I made a mistake.** `Ctrl+Z` (`Cmd+Z` on Mac) undoes anything — deleting a hotspot,
moving a box, all of it. Older versions of the whole page are under **Page → Revisions**.

**Can I change the colours or turn the animations down?** Yes — the **Advanced** panel has
colours, the paw-print trail, the map pins and the jump bar, plus how tightly each hotspot
zooms. Nothing in there is required.

**Does it work for people who get motion sickness?** Yes. Readers whose device asks for
reduced motion automatically get the same content with the movement switched off. You don't
have to do anything.

**Can I use it for something other than a map?** Yes — a floor plan, a diagram, a satellite
photo, an illustration. Nothing in the block is map-specific.

**Someone needs the same map on another page.** Select the block, **Copy** from its ⋮ menu,
paste into the other page. Or save it as a **synced pattern** so editing it once updates it
everywhere.

**Will long text still fit?** The card is capped in height so it can never cover the map, so
aim for about one screen of text per hotspot and split anything longer into two hotspots.

**I just want to see a finished example.** On a brand-new block, panel 3 has an
**Or load the tiger example** link. It fills in a complete, working map you can pick apart.
