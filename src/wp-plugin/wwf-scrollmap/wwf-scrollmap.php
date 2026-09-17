<?php
/**
 * Plugin Name:       WWF Scroll Map
 * Description:       Scroll-driven map webpart: the camera flies and zooms to each highlighted region while story cards scroll past. Editors manage the map, the regions and the cards visually — no code, no coordinates to type.
 * Version:           3.0.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            Web Technologies assignment
 * License:           GPL-2.0-or-later
 * Text Domain:       wwf-scrollmap
 *
 * Everything block-related is declared in block.json (single source of truth):
 * the attribute schema, the editor/front-end assets, and the render template.
 * The only thing that needs PHP is registering the two GSAP scripts so the
 * block's view script can depend on them.
 */

defined( 'ABSPATH' ) || exit;

define( 'WWF_SCROLLMAP_VER', '3.0.0' );

/* ---------------------------------------------------------------------------
   Template helpers for render.php.
   They live HERE, not in render.php, because a block render template is
   included once per block instance and `supports.multiple` allows several on a
   page — declaring functions there fatals on the second one.
   ------------------------------------------------------------------------ */

/**
 * Split a title into masked lines for the reveal animation.
 *
 * Each line becomes <span class="w"><span>…</span></span>: the outer span
 * clips, the inner one is what GSAP slides up from underneath. Editors control
 * the line breaks by pressing Enter — that is the whole contract, and it keeps
 * typography an editorial decision rather than an algorithm's.
 */
function wwf_scrollmap_title_lines( $title ) {
	$out = '';
	foreach ( preg_split( '/\R+/u', trim( (string) $title ) ) as $line ) {
		$line = trim( $line );
		if ( '' !== $line ) {
			$out .= '<span class="w"><span>' . esc_html( $line ) . '</span></span>';
		}
	}
	return $out;
}

/** Plain typed text → paragraphs. Lead and closing text are plain textareas in
 *  the editor, because "type your intro" should not need a formatting toolbar. */
function wwf_scrollmap_paragraphs( $text, $class = '' ) {
	$out = '';
	$cls = $class ? ' class="' . esc_attr( $class ) . '"' : '';
	foreach ( preg_split( '/\R{2,}|\R/u', trim( (string) $text ) ) as $para ) {
		$para = trim( $para );
		if ( '' !== $para ) {
			$out .= '<p' . $cls . '>' . esc_html( $para ) . '</p>';
		}
	}
	return $out;
}

/** Clamp a hotspot box to the image — the same rule as the editor's clampBox(). */
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

/** #rrggbb → "r, g, b" so a colour picker can drive an rgba() custom property. */
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

/** One card, wrapped in the sticky pin the engine expects. */
function wwf_scrollmap_step( $classes, $side, $label, $inner, $zoom = 1, $box = null ) {
	printf(
		'<article class="%s" data-side="%s" data-zoom="%s"%s%s><div class="step__pin"><div class="card">%s</div></div></article>',
		esc_attr( $classes ),
		esc_attr( $side ),
		esc_attr( $zoom ),
		$label ? ' data-label="' . esc_attr( $label ) . '"' : '',
		$box ? ' data-hotspot="' . esc_attr( wp_json_encode( $box ) ) . '"' : '',
		$inner // phpcs:ignore WordPress.Security.EscapeOutput — every part is escaped above
	);
}

/* ------------------------------------------------------------------------ */

/**
 * Register GSAP + ScrollTrigger as normal WordPress script handles.
 *
 * They are VENDORED inside the plugin rather than pulled from a CDN, so the
 * site has no third-party runtime dependency, works offline/behind a firewall,
 * and the version is pinned by the deploy rather than by someone else's CDN.
 * Registering them as handles (instead of hard-coding <script> tags) means
 * WordPress deduplicates them if another plugin also needs GSAP.
 */
add_action( 'init', function () {
	$url = plugin_dir_url( __FILE__ );
	$dir = plugin_dir_path( __FILE__ );

	wp_register_script(
		'gsap',
		$url . 'vendor/gsap.min.js',
		array(),
		'3.13.0',
		array( 'strategy' => 'defer', 'in_footer' => true )
	);
	wp_register_script(
		'gsap-scrolltrigger',
		$url . 'vendor/ScrollTrigger.min.js',
		array( 'gsap' ),
		'3.13.0',
		array( 'strategy' => 'defer', 'in_footer' => true )
	);

	// view.asset.php declares these two as dependencies of the block's view script.
	register_block_type( $dir );
} );
