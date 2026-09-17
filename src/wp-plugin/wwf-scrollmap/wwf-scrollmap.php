<?php
/**
 * Plugin Name:       WWF Scroll Map
 * Description:       Scroll-driven map webpart: the camera flies and zooms to each highlighted region while story cards scroll past. Editors manage the map, the regions and the cards visually — no code, no coordinates to type.
 * Version:           2.0.0
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

define( 'WWF_SCROLLMAP_VER', '2.0.0' );

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
