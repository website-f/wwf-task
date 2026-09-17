<?php
/**
 * Dependency manifest for view.js.
 *
 * The two GSAP handles are registered in wwf-scrollmap.php from the vendored
 * files in ./vendor, so WordPress loads them before the engine and never twice.
 */
return array(
	'dependencies' => array( 'gsap', 'gsap-scrolltrigger' ),
	'version'      => '2.0.0',
);
