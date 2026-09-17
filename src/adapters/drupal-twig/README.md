# Drupal adapter

Server-side rendering, the same way the WordPress plugin does it — because Drupal can
template, so there is no reason to render in the browser.

## Content model

One **Paragraph type** `scroll_map`, with a nested Paragraph type `scroll_map_hotspot`.

| Paragraph `scroll_map` | Field type |
|---|---|
| `field_section_title` | Text (plain, long) — newlines are deliberate line breaks |
| `field_lead_text` | Text (plain, long) — one paragraph per line |
| `field_closing_text` | Text (plain, long), optional |
| `field_map_image` | Image, required |
| `field_hotspots` | Entity reference revisions → `scroll_map_hotspot`, unlimited, **draggable** |
| `field_focal_x`, `field_focal_y` | Number (0–100), optional |
| `field_show_paws/markers/rail` | Boolean, default on |
| `field_theme_*` | Colour / number, optional |

| Paragraph `scroll_map_hotspot` | Field type |
|---|---|
| `field_label` | Text (plain) |
| `field_title` | Text (plain, long) |
| `field_text` | Text (formatted) — use a restricted text format, see below |
| `field_image` + `field_caption` | Image, Text (plain) |
| `field_side` | List (text): `left` \| `right` |
| `field_box` | Four number fields, or one JSON field — `x, y, w, h` as **% of the map image** |
| `field_zoom`, `field_badge`, `field_badge_level` | optional |

Drupal's Paragraphs UI gives **add / reorder (drag) / remove** for free — that is the brief's
third bullet with no custom code. Reordering the field reorders the story, and numbering is
derived from position, so nothing else has to change.

## The one thing to build: drawing the box

Out of the box an editor would type four numbers. To match the WordPress editor, add a small
field widget that shows the map image with draggable rectangles on it and writes into
`field_box`. The pointer maths is ~60 lines and is already written — lift
`onDown/onMove/onUp` + `clampBox` from
[`wwf-scrollmap/editor.js`](../../wp-plugin/wwf-scrollmap/editor.js); they are plain DOM code
with no WordPress dependency.

## Wiring it up

**1. Preprocess** — build the schema object and filter the rich text:

```php
function mytheme_preprocess_paragraph__scroll_map(array &$variables) {
  $p = $variables['paragraph'];

  $hotspots = [];
  foreach ($p->field_hotspots as $item) {
    $h = $item->entity;
    $hotspots[] = [
      'label'   => $h->field_label->value,
      'title'   => $h->field_title->value,
      // Filter here. The Twig template prints this with |raw.
      'text'    => check_markup($h->field_text->value, $h->field_text->format),
      'image'   => $h->field_image->entity ? [
        'src'    => $h->field_image->entity->createFileUrl(),
        'alt'    => $h->field_image->alt,
        'width'  => $h->field_image->width,
        'height' => $h->field_image->height,
      ] : NULL,
      'caption'    => $h->field_caption->value,
      'side'       => $h->field_side->value ?: 'right',
      'box'        => json_decode($h->field_box->value, TRUE),
      'zoom'       => (float) ($h->field_zoom->value ?: 1),
      'badge'      => $h->field_badge->value,
      'badgeLevel' => $h->field_badge_level->value,
    ];
  }

  $variables['map'] = [
    'sectionTitle' => $p->field_section_title->value,
    'leadText'     => $p->field_lead_text->value,
    'closingText'  => $p->field_closing_text->value,
    'map'          => [
      'src'    => $p->field_map_image->entity->createFileUrl(),
      'alt'    => $p->field_map_image->alt,
      'width'  => $p->field_map_image->width,
      'height' => $p->field_map_image->height,
    ],
    'hotspots' => $hotspots,
    'options'  => [
      'focal'   => ['x' => (float) $p->field_focal_x->value, 'y' => (float) $p->field_focal_y->value],
      'paws'    => (bool) $p->field_show_paws->value,
      'markers' => (bool) $p->field_show_markers->value,
      'rail'    => (bool) $p->field_show_rail->value,
      'theme'   => ['accent' => $p->field_theme_accent->value ?: '#8fd14f'],
    ],
  ];
}
```

**2. The `scrollmap_rgb` filter** used by the template — or drop it and pass three
precomputed `rgba()` strings from the preprocess instead, which needs no extension:

```php
// mytheme/src/TwigExtension.php
public function getFilters() {
  return [new \Twig\TwigFilter('scrollmap_rgb', function ($hex) {
    $hex = ltrim((string) $hex, '#');
    if (strlen($hex) === 3) $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
    return hexdec(substr($hex, 0, 2)) . ', ' . hexdec(substr($hex, 2, 2)) . ', ' . hexdec(substr($hex, 4, 2));
  })];
}
```

**3. Libraries** — `mytheme.libraries.yml`:

```yaml
scrollmap:
  css:
    component:
      css/scrollmap.css: {}
  js:
    js/vendor/gsap.min.js: { minified: true }
    js/vendor/ScrollTrigger.min.js: { minified: true }
    js/scrollmap.js: { defer: true }
```

Copy `src/core/scrollmap.css`, `src/core/scrollmap.js` and `src/core/vendor/` into the theme
unchanged, and attach the library from the preprocess:
`$variables['#attached']['library'][] = 'mytheme/scrollmap';`

**4. Preview before publishing** — Drupal's own. Content moderation gives Draft → Preview →
Published; the paragraph renders in preview exactly as it will live.

## Validation

`scrollmap-render.js` exports the same rule set the WordPress editor uses:

```js
const { errors, warnings, ok } = ScrollMapRender.validate(content);
```

Run it in a Node build step or port the ~20 lines into a
`ConstraintValidator` on the paragraph. Either way the rules live in one place.
