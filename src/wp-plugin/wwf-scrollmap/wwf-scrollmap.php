<?php
/**
 * Plugin Name:       WWF Scroll Map
 * Description:       Scroll-driven spotlight map webpart (Shorthand "Scrollpoints" pattern) as a Gutenberg block. Editors manage the map image, story points and hotspot regions visually.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            Web Technologies assignment
 * License:           GPL-2.0-or-later
 * Text Domain:       wwf-scrollmap
 *
 * Everything block-related is declared in block.json (single source of truth):
 * attributes schema, editor/front-end assets, and the server render template.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', function () {
	register_block_type( __DIR__ );
} );
