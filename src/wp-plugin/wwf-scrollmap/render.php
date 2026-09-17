<?php
/**
 * Server render for the wwf/scrollmap block.
 *
 * Prints exactly the markup of the standalone Task 1 file, so style.css and
 * view.js are shared with it byte-for-byte. Every value is escaped, every
 * number re-clamped (never trust what is stored in post content), and card
 * HTML is whitelisted through wp_kses.
 *
 * Available: $attributes (validated against block.json), $content, $block.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Split a heading into masked lines for the reveal animation.
 *
 * Each line becomes <span class="w"><span>…</span></span>: the outer span
 * clips, the inner one is what GSAP slides up from underneath. Editors
 * control the line breaks by pressing Enter in the heading field — that is
 * the whole contract, and it keeps typography under editorial control.
 */
function wwf_scrollmap_heading_lines( $heading ) {
	$lines = preg_split( '/\R+/u', trim( (string) $heading ) );
	$out   = '';
	foreach ( $lines as $line ) {
		$line = trim( $line );
		if ( '' === $line ) {
			continue;
		}
		$out .= '<span class="w"><span>' . esc_html( $line ) . '</span></span>';
	}
	return $out;
}

/** Clamp a hotspot to the image, matching the editor's clampBox() exactly. */
function wwf_scrollmap_clamp_box( $box ) {
	if ( ! is_array( $box ) ) {
		return null;
	}
	$w = max( 2, min( 100, (float) ( $box['w'] ?? 10 ) ) );
	$h = max( 2, min( 100, (float) ( $box['h'] ?? 10 ) ) );
	return array(
		'x' => round( max( 0, min( 100 - $w, (float) ( $box['x'] ?? 0 ) ) ), 2 ),
		'y' => round( max( 0, min( 100 - $h, (float) ( $box['y'] ?? 0 ) ) ), 2 ),
		'w' => round( $w, 2 ),
		'h' => round( $h, 2 ),
	);
}

/** #rrggbb → "r, g, b" so a hex picker can drive an rgba() custom property. */
function wwf_scrollmap_rgb( $hex, $fallback = '0,0,0' ) {
	$hex = sanitize_hex_color( $hex );
	if ( ! $hex ) {
		return $fallback;
	}
	$hex = ltrim( $hex, '#' );
	if ( 3 === strlen( $hex ) ) {
		$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
	}
	return hexdec( substr( $hex, 0, 2 ) ) . ', ' . hexdec( substr( $hex, 2, 2 ) ) . ', ' . hexdec( substr( $hex, 4, 2 ) );
}

/* ---------------------------------------------------------------------- */

$bg     = $attributes['backgroundImage'] ?? null;
$points = $attributes['points'] ?? array();

/* Required field. Without a map there is nothing to render. */
if ( empty( $bg['url'] ) ) {
	if ( current_user_can( 'edit_posts' ) ) {
		echo '<p style="padding:1em;background:#fcf0f1;border:1px solid #d63638">'
			. esc_html__( 'Scroll Map: choose a background map image to render this block.', 'wwf-scrollmap' )
			. '</p>';
	}
	return;
}

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

/* Card body: harmless inline markup only. This whitelist is mirrored by the
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

$section_title = trim( (string) ( $attributes['sectionTitle'] ?? '' ) );

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
	<?php if ( $section_title ) : ?>aria-label="<?php echo esc_attr( $section_title ); ?>"<?php endif; ?>>

	<?php if ( $section_title ) : ?>
		<?php /* The visible title is part of the map artwork; this keeps the
		         section in the document outline for assistive tech and SEO. */ ?>
		<h2 class="tgr__sr"><?php echo esc_html( $section_title ); ?></h2>
	<?php endif; ?>

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
		<?php foreach ( $points as $index => $point ) : ?>
			<?php
			$side    = ( ( $point['side'] ?? '' ) === 'left' ) ? 'left' : 'right';
			$wide    = ! empty( $point['wide'] );
			$label   = trim( (string) ( $point['label'] ?? '' ) );
			$zoom    = max( 0.4, min( 2.5, (float) ( $point['zoom'] ?? 1 ) ) );
			$hotspot = $wide ? null : wwf_scrollmap_clamp_box( $point['hotspot'] ?? null );
			$heading = (string) ( $point['heading'] ?? '' );
			$status  = trim( (string) ( $point['status'] ?? '' ) );
			$level   = in_array( $point['statusLevel'] ?? '', array( 'endangered', 'vulnerable', 'least' ), true )
				? $point['statusLevel'] : '';
			$number  = trim( (string) ( $point['number'] ?? '' ) );
			$img     = $point['image'] ?? null;
			?>
			<article class="step<?php echo $wide ? ' step--wide' : ''; ?>"
				data-side="<?php echo esc_attr( $side ); ?>"
				data-zoom="<?php echo esc_attr( $zoom ); ?>"
				<?php if ( $label ) : ?>data-label="<?php echo esc_attr( $label ); ?>"<?php endif; ?>
				<?php if ( $hotspot ) : ?>data-hotspot="<?php echo esc_attr( wp_json_encode( $hotspot ) ); ?>"<?php endif; ?>>
				<?php /* .step__pin is sticky: the card holds at a fixed spot on screen
				         while the camera flies, so exactly one card is ever visible. */ ?>
				<div class="step__pin">
				<div class="card">

					<?php if ( $wide ) : ?>
						<?php if ( $label ) : ?>
							<span class="eyebrow"><?php echo esc_html( $label ); ?></span>
						<?php endif; ?>
						<?php if ( '' !== trim( $heading ) ) : ?>
							<p class="h2 title"><?php echo wwf_scrollmap_heading_lines( $heading ); // phpcs:ignore WordPress.Security.EscapeOutput ?></p>
						<?php endif; ?>
					<?php else : ?>
						<?php if ( $number || $label ) : ?>
							<div class="card__meta">
								<?php if ( $number ) : ?><span class="card__num"><?php echo esc_html( $number ); ?></span><?php endif; ?>
								<?php if ( $label ) : ?><span class="card__region"><?php echo esc_html( $label ); ?></span><?php endif; ?>
							</div>
						<?php endif; ?>
						<?php if ( '' !== trim( $heading ) ) : ?>
							<p class="h2"><?php echo wwf_scrollmap_heading_lines( $heading ); // phpcs:ignore WordPress.Security.EscapeOutput ?></p>
						<?php endif; ?>
						<?php if ( $status ) : ?>
							<span class="card__status"<?php echo $level ? ' data-level="' . esc_attr( $level ) . '"' : ''; ?>><?php echo esc_html( $status ); ?></span>
						<?php endif; ?>
					<?php endif; ?>

					<?php
					if ( ! empty( $point['body'] ) ) {
						$body = wp_kses( $point['body'], $allowed_html );
						if ( $wide ) {
							/* the opening/closing cards use the larger lede size */
							$body = str_replace( '<p>', '<p class="lede">', $body );
						}
						echo $body; // phpcs:ignore WordPress.Security.EscapeOutput — kses'd above
					}
					?>

					<?php if ( ! empty( $img['id'] ) || ! empty( $img['url'] ) ) : ?>
						<figure>
							<div class="card__shot">
								<?php
								if ( ! empty( $img['id'] ) ) {
									echo wp_get_attachment_image(
										(int) $img['id'],
										'large',
										false,
										array( 'loading' => 'lazy', 'decoding' => 'async' )
									);
								} else {
									printf(
										'<img src="%s" alt="%s" loading="lazy">',
										esc_url( $img['url'] ),
										esc_attr( $img['alt'] ?? '' )
									);
								}
								?>
							</div>
							<?php if ( ! empty( $point['caption'] ) ) : ?>
								<figcaption><?php echo esc_html( $point['caption'] ); ?></figcaption>
							<?php endif; ?>
						</figure>
					<?php endif; ?>

				</div>
				</div>
			</article>
		<?php endforeach; ?>
	</div>

	<?php
	/* Optional accessible alternative for data baked into the map artwork. */
	if ( ! empty( $attributes['dataTable'] ) ) {
		echo '<div class="tgr__sr">' . wp_kses_post( $attributes['dataTable'] ) . '</div>';
	}
	?>
</section>
