<?php
/**
 * Server render for the wwf/scrollmap block.
 *
 * Emits the exact same semantic markup as the standalone Task 1 file, so the
 * shared view.js engine and style.css work unchanged. All output is escaped
 * or passed through wp_kses — editor content can never inject script.
 *
 * Available: $attributes (validated against block.json), $content, $block.
 */

defined( 'ABSPATH' ) || exit;

$bg     = $attributes['backgroundImage'] ?? null;
$points = $attributes['points'] ?? array();

/* Hard requirement (also enforced in the editor): no map, no output.        */
if ( empty( $bg['url'] ) ) {
	if ( current_user_can( 'edit_posts' ) ) {
		echo '<p style="padding:1em;background:#fcf0f1;border:1px solid #d63638">'
			. esc_html__( 'Scroll Map: select a background image to render this block.', 'wwf-scrollmap' )
			. '</p>';
	}
	return;
}

/* Editor-controlled design tokens → scoped CSS custom properties.           */
$dim_opacity  = max( 0, min( 1, (float) ( $attributes['dimOpacity'] ?? 0.5 ) ) );
$card_opacity = max( 0, min( 1, (float) ( $attributes['cardOpacity'] ?? 0.85 ) ) );
$hl_width     = max( 0, min( 12, (int) ( $attributes['highlightWidth'] ?? 4 ) ) );
$travel_ms    = max( 0, min( 3000, (int) ( $attributes['travelMs'] ?? 800 ) ) );
$hl_color     = sanitize_hex_color( $attributes['highlightColor'] ?? '' ) ?: '#2a6788';

$style_vars = sprintf(
	'--dim: rgba(0,0,0,%s); --hl-color: %s; --hl-border: %dpx; --hl-speed: %dms; --card-bg: rgba(255,255,255,%s);',
	esc_attr( $dim_opacity ),
	esc_attr( $hl_color ),
	$hl_width,
	$travel_ms,
	esc_attr( $card_opacity )
);

/* Rich text in cards: allow harmless inline markup only.                    */
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

$mode = in_array( $attributes['mode'] ?? '', array( 'cinematic', 'faithful' ), true )
	? $attributes['mode'] : 'cinematic';

$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class'      => 'scrollmap',
		'style'      => $style_vars,
		'aria-label' => $attributes['sectionTitle'] ?? '',
	)
);
?>
<section <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput ?> data-scrollmap data-mode="<?php echo esc_attr( $mode ); ?>">

	<div class="scrollmap__viewport">
		<div class="scrollmap__stage">
			<?php
			/* Media-library render: srcset/sizes/alt/lazyloading for free.  */
			if ( ! empty( $bg['id'] ) ) {
				echo wp_get_attachment_image(
					(int) $bg['id'],
					'full',
					false,
					array(
						'class'         => 'scrollmap__map',
						'fetchpriority' => 'high',
						'loading'       => 'eager',
					)
				);
			} else {
				printf(
					'<img class="scrollmap__map" src="%s" alt="%s" fetchpriority="high">',
					esc_url( $bg['url'] ),
					esc_attr( $bg['alt'] ?? '' )
				);
			}
			?>
			<div class="scrollmap__frame" aria-hidden="true"></div>
		</div>
	</div>

	<div class="scrollmap__points">
		<?php foreach ( $points as $point ) : ?>
			<?php
			$align   = in_array( $point['align'] ?? '', array( 'left', 'right', 'center' ), true ) ? $point['align'] : 'center';
			$hotspot = $point['hotspot'] ?? null;
			$spot_attr = '';
			if ( is_array( $hotspot ) ) {
				/* Clamp server-side too — same rule as the editor's clampBox:
				   sizes ≥ 2%, and the box may not leave the image.          */
				$w = max( 2, min( 100, (float) ( $hotspot['w'] ?? 10 ) ) );
				$h = max( 2, min( 100, (float) ( $hotspot['h'] ?? 10 ) ) );
				$spot_attr = wp_json_encode(
					array(
						'x' => max( 0, min( 100 - $w, (float) ( $hotspot['x'] ?? 0 ) ) ),
						'y' => max( 0, min( 100 - $h, (float) ( $hotspot['y'] ?? 0 ) ) ),
						'w' => $w,
						'h' => $h,
					)
				);
			}
			?>
			<article class="scrollmap__point" data-align="<?php echo esc_attr( $align ); ?>"
				<?php if ( $spot_attr ) : ?>data-hotspot="<?php echo esc_attr( $spot_attr ); ?>"<?php endif; ?>>
				<div class="card">
					<?php if ( ! empty( $point['heading'] ) ) : ?>
						<h2><?php echo esc_html( $point['heading'] ); ?></h2>
					<?php endif; ?>

					<?php if ( ! empty( $point['body'] ) ) : ?>
						<?php echo wp_kses( $point['body'], $allowed_html ); ?>
					<?php endif; ?>

					<?php if ( ! empty( $point['image']['id'] ) || ! empty( $point['image']['url'] ) ) : ?>
						<figure>
							<?php
							if ( ! empty( $point['image']['id'] ) ) {
								echo wp_get_attachment_image( (int) $point['image']['id'], 'large', false, array( 'loading' => 'lazy' ) );
							} else {
								printf(
									'<img src="%s" alt="%s" loading="lazy">',
									esc_url( $point['image']['url'] ),
									esc_attr( $point['image']['alt'] ?? '' )
								);
							}
							if ( ! empty( $point['caption'] ) ) {
								echo '<figcaption>' . esc_html( $point['caption'] ) . '</figcaption>';
							}
							?>
						</figure>
					<?php endif; ?>
				</div>
			</article>
		<?php endforeach; ?>
	</div>
</section>
