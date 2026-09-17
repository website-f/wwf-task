<?php
/**
 * Server render for the wwf/scrollmap block.
 *
 * Prints exactly the markup of the standalone Task 1 file, so style.css and
 * view.js are shared with it byte-for-byte.
 *
 * The content model is the brief's, in the brief's words:
 *     section title  →  the opening card's heading + the section's accessible name
 *     lead text      →  the opening card's paragraphs
 *     images         →  the map, plus one optional image per hotspot
 *     hotspots[]     →  one card + one highlighted region each, in scroll order
 *     closing text   →  an optional final card
 *
 * Everything is escaped, every number is re-clamped (post content is editable,
 * so stored values are never trusted), and hotspot text goes through wp_kses.
 *
 * Available: $attributes (validated against block.json), $content, $block.
 */

defined( 'ABSPATH' ) || exit;

/* The template helpers live in wwf-scrollmap.php, which WordPress loads once.
   They cannot live here: a block render template is included once PER BLOCK
   INSTANCE, and `supports.multiple` means a page may hold several — the second
   include then fatals with "Cannot redeclare". */

/* ---------------------------------------------------------------------- */

$bg       = $attributes['backgroundImage'] ?? null;
$hotspots = $attributes['hotspots'] ?? array();

/* Required. Without a map there is nothing to render. */
if ( empty( $bg['url'] ) ) {
	if ( current_user_can( 'edit_posts' ) ) {
		echo '<p style="padding:1em;background:#fcf0f1;border:1px solid #d63638">'
			. esc_html__( 'Scroll Map: choose a map image to render this block.', 'wwf-scrollmap' )
			. '</p>';
	}
	return;
}

$section_title = trim( (string) ( $attributes['sectionTitle'] ?? '' ) );
$lead_text     = trim( (string) ( $attributes['leadText'] ?? '' ) );
$closing_text  = trim( (string) ( $attributes['closingText'] ?? '' ) );

$focal_x  = max( 0, min( 100, (float) ( $attributes['focalX'] ?? 0 ) ) );
$focal_y  = max( 0, min( 100, (float) ( $attributes['focalY'] ?? 50 ) ) );
$dim      = max( 0, min( 1, (float) ( $attributes['dimOpacity'] ?? 0.62 ) ) );
$card_op  = max( 0, min( 1, (float) ( $attributes['cardOpacity'] ?? 0.84 ) ) );
$accent   = sanitize_hex_color( $attributes['accentColor'] ?? '' ) ?: '#8fd14f';
$ink      = sanitize_hex_color( $attributes['inkColor'] ?? '' ) ?: '#f2efe6';
$backdrop = sanitize_hex_color( $attributes['backdropColor'] ?? '' ) ?: '#04140d';
$card_hex = sanitize_hex_color( $attributes['cardColor'] ?? '' ) ?: '#071a11';

/* Editor choices become scoped CSS custom properties — per-instance theming
   with no extra stylesheet and no !important anywhere. */
$style_vars = sprintf(
	'--accent:%1$s; --ink:%2$s; --ink-dim:rgba(%3$s,0.66); --forest:%4$s; --dim:%5$s; --card-bg:rgba(%6$s,%7$s); --card-border:rgba(%3$s,0.16);',
	esc_attr( $accent ),
	esc_attr( $ink ),
	esc_attr( wwf_scrollmap_rgb( $ink, '242, 239, 230' ) ),
	esc_attr( $backdrop ),
	esc_attr( $dim ),
	esc_attr( wwf_scrollmap_rgb( $card_hex, '7, 26, 17' ) ),
	esc_attr( $card_op )
);

/* Hotspot text: harmless inline markup only. This whitelist is mirrored by the
   editor's RichText allowedFormats, so what an editor can type and what the
   server will print can never drift apart. */
$allowed_html = array(
	'p'      => array(),
	'br'     => array(),
	'em'     => array(),
	'strong' => array(),
	'u'      => array(),
	'a'      => array(
		'href'   => true,
		'target' => true,
		'rel'    => true,
	),
);

$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class' => 'tgr',
		'style' => $style_vars,
	)
);
?>
<section <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput ?>
	data-tgr
	data-focal="<?php echo esc_attr( $focal_x . ' ' . $focal_y ); ?>"
	data-paws="<?php echo empty( $attributes['showPaws'] ) ? 'off' : 'on'; ?>"
	data-markers="<?php echo empty( $attributes['showMarkers'] ) ? 'off' : 'on'; ?>"
	data-rail="<?php echo empty( $attributes['showRail'] ) ? 'off' : 'on'; ?>"
	<?php if ( $section_title ) : ?>aria-label="<?php echo esc_attr( wp_strip_all_tags( $section_title ) ); ?>"<?php endif; ?>>

	<div class="tgr__stage">
		<div class="tgr__camera">
			<?php
			/* Media-library render: srcset, sizes, alt and dimensions for free. */
			if ( ! empty( $bg['id'] ) ) {
				echo wp_get_attachment_image(
					(int) $bg['id'],
					'full',
					false,
					array(
						'class'         => 'tgr__map',
						'fetchpriority' => 'high',
						'loading'       => 'eager',
						'decoding'      => 'async',
					)
				);
			} else {
				printf(
					'<img class="tgr__map" src="%s" alt="%s" fetchpriority="high">',
					esc_url( $bg['url'] ),
					esc_attr( $bg['alt'] ?? '' )
				);
			}
			?>
		</div>

		<div class="tgr__grade" aria-hidden="true"></div>
		<div class="tgr__frame" aria-hidden="true"></div>

		<div class="tgr__chip" aria-hidden="true">
			<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>
			<span class="tgr__chip-t"></span>
		</div>

		<div class="tgr__bar" aria-hidden="true"></div>
	</div>

	<div class="tgr__steps">

		<?php
		/* ---- the opening card: section title + lead text ---------------- */
		if ( $section_title || $lead_text ) {
			$inner = '';
			if ( $section_title ) {
				$inner .= '<h2 class="h2 title">' . wwf_scrollmap_title_lines( $section_title ) . '</h2>';
			}
			$inner .= wwf_scrollmap_paragraphs( $lead_text, 'lede' );
			wwf_scrollmap_step(
				'step step--wide',
				'right',
				wp_strip_all_tags( str_replace( "\n", ' ', $section_title ) ),
				$inner
			);
		}

		/* ---- one card per hotspot, in order ----------------------------- */
		foreach ( $hotspots as $index => $hs ) {
			$box = wwf_scrollmap_clamp_box( $hs['box'] ?? null );
			if ( ! $box ) {
				continue;   /* a hotspot without a region has nothing to fly to */
			}

			$label  = trim( (string) ( $hs['label'] ?? '' ) );
			$title  = (string) ( $hs['title'] ?? '' );
			$badge  = trim( (string) ( $hs['badge'] ?? '' ) );
			$level  = in_array( $hs['badgeLevel'] ?? '', array( 'endangered', 'vulnerable', 'least' ), true )
				? $hs['badgeLevel'] : '';
			$side   = ( ( $hs['side'] ?? '' ) === 'left' ) ? 'left' : 'right';
			$zoom   = max( 0.4, min( 2.5, (float) ( $hs['zoom'] ?? 1 ) ) );
			$img    = $hs['image'] ?? null;

			/* Numbering follows the order, so reordering renumbers for free and
			   there is one less field for an editor to keep in sync. */
			$number = str_pad( (string) ( $index + 1 ), 2, '0', STR_PAD_LEFT );

			$inner = '<div class="card__meta"><span class="card__num">' . esc_html( $number ) . '</span>';
			if ( $label ) {
				$inner .= '<span class="card__region">' . esc_html( $label ) . '</span>';
			}
			$inner .= '</div>';

			if ( '' !== trim( $title ) ) {
				$inner .= '<p class="h2">' . wwf_scrollmap_title_lines( $title ) . '</p>';
			}
			if ( $badge ) {
				$inner .= '<span class="card__status"' . ( $level ? ' data-level="' . esc_attr( $level ) . '"' : '' )
					. '>' . esc_html( $badge ) . '</span>';
			}
			if ( ! empty( $hs['text'] ) ) {
				$inner .= wp_kses( $hs['text'], $allowed_html );
			}
			if ( ! empty( $img['id'] ) || ! empty( $img['url'] ) ) {
				$shot = ! empty( $img['id'] )
					? wp_get_attachment_image( (int) $img['id'], 'large', false, array( 'loading' => 'lazy', 'decoding' => 'async' ) )
					: sprintf( '<img src="%s" alt="%s" loading="lazy">', esc_url( $img['url'] ), esc_attr( $img['alt'] ?? '' ) );
				$inner .= '<figure><div class="card__shot">' . $shot . '</div>';
				if ( ! empty( $hs['caption'] ) ) {
					$inner .= '<figcaption>' . esc_html( $hs['caption'] ) . '</figcaption>';
				}
				$inner .= '</figure>';
			}

			wwf_scrollmap_step( 'step', $side, $label, $inner, $zoom, $box );
		}

		/* ---- the optional closing card ---------------------------------- */
		if ( $closing_text ) {
			wwf_scrollmap_step(
				'step step--wide',
				'left',
				__( 'In closing', 'wwf-scrollmap' ),
				wwf_scrollmap_paragraphs( $closing_text, 'lede' )
			);
		}
		?>

	</div>
</section>
