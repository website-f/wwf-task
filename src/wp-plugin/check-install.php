<?php
/**
 * Post-install smoke test, meant for a site that has only just installed the
 * plugin from the zip:
 *
 *   wp eval-file check-install.php
 *
 * Confirms the four things that have to be true before an editor will ever see
 * "/scroll map" in their page editor.
 */

defined( 'ABSPATH' ) || exit;

$fail = 0;

/* 1. the plugin is active */
if ( is_plugin_active( 'wwf-scrollmap/wwf-scrollmap.php' ) ) {
	WP_CLI::log( 'OK   plugin active' );
} else {
	WP_CLI::log( 'FAIL plugin not active' );
	$fail++;
}

/* 2. the block type is registered — this is what puts it in the + inserter */
$reg = WP_Block_Type_Registry::get_instance();
if ( $reg->is_registered( 'wwf/scrollmap' ) ) {
	$t = $reg->get_registered( 'wwf/scrollmap' );
	WP_CLI::log( 'OK   block registered: "' . $t->title . '", keywords: ' . implode( ', ', (array) $t->keywords ) );
} else {
	WP_CLI::log( 'FAIL block wwf/scrollmap not registered' );
	$fail++;
}

/* 3. GSAP is registered as a script handle, so the front end can enqueue it */
foreach ( array( 'gsap', 'gsap-scrolltrigger' ) as $handle ) {
	if ( wp_script_is( $handle, 'registered' ) ) {
		WP_CLI::log( 'OK   script handle "' . $handle . '" registered' );
	} else {
		WP_CLI::log( 'FAIL script handle "' . $handle . '" missing' );
		$fail++;
	}
}

/* 4. the block actually renders — the real proof */
$block = array(
	'blockName'    => 'wwf/scrollmap',
	'attrs'        => array(
		'sectionTitle' => 'Smoke test',
		'leadText'     => 'Installed from the zip.',
		'backgroundImage' => array( 'url' => 'https://example.test/map.jpg', 'alt' => 'a map' ),
		'hotspots'     => array(
			array(
				'id' => 'a', 'label' => 'Somewhere', 'title' => 'A place',
				'text' => '<p>Words.</p>', 'side' => 'right',
				'box' => array( 'x' => 10, 'y' => 10, 'w' => 20, 'h' => 20 ),
			),
		),
	),
	'innerBlocks'  => array(),
	'innerHTML'    => '',
	'innerContent' => array(),
);
$html = render_block( $block );

if ( false !== strpos( $html, 'data-tgr' ) && false !== strpos( $html, 'data-hotspot' ) ) {
	WP_CLI::log( 'OK   block renders (' . strlen( $html ) . ' bytes, '
		. substr_count( $html, 'class="step' ) / 2 . ' steps)' );
} else {
	WP_CLI::log( 'FAIL block produced no markup' );
	$fail++;
}

if ( $fail ) {
	WP_CLI::error( $fail . ' check(s) failed' );
}
WP_CLI::success( 'Install is good — "/scroll map" will now work in the page editor.' );
