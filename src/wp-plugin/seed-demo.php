<?php
/**
 * Demo seeder for the wwf/scrollmap block — run via WP-CLI:
 *
 *   wp eval-file seed-demo.php
 *
 * Expects the standalone assets mounted at /seed-assets (see the `docker run`
 * command in README.md). Idempotent: re-running reuses existing attachments
 * (matched by slug) and updates the same page.
 *
 * Creates/updates:
 *   · 7 media-library images (map + 6 prey photos) with alt text
 *   · page "Tiger Range Countries" containing one fully-populated block
 *   · sets it as the site front page
 *
 * It doubles as the answer to "how would you migrate existing content in?" —
 * a migration is a script that builds this attribute array and hands it to
 * serialize_block().
 */

defined( 'ABSPATH' ) || exit;

$assets_dir = '/seed-assets';

$images = array(
	'map'     => array( 'file' => 'map.jpg',     'title' => 'Tiger range countries map', 'alt' => 'Illustrated map of Asia titled Tiger Range Countries, showing each country\'s wild tiger population and population trend.' ),
	'sambar'  => array( 'file' => 'sambar.jpg',  'title' => 'Sambar deer',  'alt' => 'A sambar deer foal resting its head against its mother in dry grassland.' ),
	'wildpig' => array( 'file' => 'wildpig.jpg', 'title' => 'Wild boar',    'alt' => 'A wild boar and three striped piglets walking across bare forest floor.' ),
	'banteng' => array( 'file' => 'banteng.jpg', 'title' => 'Banteng',      'alt' => 'A male banteng, a large dark wild ox with white stockings, in a forest clearing.' ),
	'bukhara' => array( 'file' => 'bukhara.jpg', 'title' => 'Bukhara deer', 'alt' => 'A herd of bukhara deer moving across dry open plain after release.' ),
	'nilgai'  => array( 'file' => 'nilgai.jpg',  'title' => 'Nilgai',       'alt' => 'A nilgai antelope standing alert in golden grassland.' ),
	'chital'  => array( 'file' => 'chital.jpg',  'title' => 'Chital',       'alt' => 'A chital, or spotted deer, caught on a night-time camera trap.' ),
);

$media = array();
foreach ( $images as $key => $def ) {
	$slug     = sanitize_title( $def['title'] );
	$existing = get_posts( array(
		'post_type'   => 'attachment',
		'name'        => $slug,
		'numberposts' => 1,
		'post_status' => 'inherit',
	) );
	if ( $existing ) {
		$att_id = $existing[0]->ID;
	} else {
		$path = $assets_dir . '/' . $def['file'];
		if ( ! file_exists( $path ) ) {
			WP_CLI::warning( "Missing asset: $path" );
			continue;
		}
		$upload = wp_upload_bits( $def['file'], null, file_get_contents( $path ) );
		if ( ! empty( $upload['error'] ) ) {
			WP_CLI::warning( "Upload failed for {$def['file']}: {$upload['error']}" );
			continue;
		}
		$att_id = wp_insert_attachment( array(
			'post_title'     => $def['title'],
			'post_name'      => $slug,
			'post_mime_type' => 'image/jpeg',
			'post_status'    => 'inherit',
		), $upload['file'] );
		require_once ABSPATH . 'wp-admin/includes/image.php';
		wp_update_attachment_metadata( $att_id, wp_generate_attachment_metadata( $att_id, $upload['file'] ) );
		update_post_meta( $att_id, '_wp_attachment_image_alt', $def['alt'] );
	}
	$media[ $key ] = array(
		'id'  => $att_id,
		'url' => wp_get_attachment_url( $att_id ),
		'alt' => $def['alt'],
	);
	WP_CLI::log( "media[$key] = #{$att_id}" );
}

/* ---------------------------------------------------------------------
   The chapters. Hotspots are the ORIGINAL story's own coordinates, read
   out of its DOM — percentages of the map image, so they are independent
   of viewport size and of which image rendition gets served.
   ------------------------------------------------------------------ */
$points = array(
	array(
		'id' => 'pt-intro', 'wide' => true, 'side' => 'right',
		'label' => 'Tiger range countries',
		'heading' => "What do\ntigers eat?",
		'body' => '<p>We talk a lot about <em>tiger prey</em> — but what animals do tigers actually eat?</p><p>The most important tiger prey are ungulates: mammals with hooves, such as large deer, wild cattle and wild pigs. Scroll on to travel to some of the places where tiger prey are found.</p>',
		'image' => null, 'caption' => '', 'hotspot' => null, 'zoom' => 1,
		'number' => '', 'status' => '', 'statusLevel' => '',
	),
	array(
		'id' => 'pt-sambar', 'wide' => false, 'side' => 'right',
		'number' => '01', 'label' => 'India & Nepal', 'heading' => "Sambar\ndeer",
		'status' => 'IUCN · Vulnerable', 'statusLevel' => 'vulnerable',
		'hotspot' => array( 'x' => 48.5, 'y' => 43, 'w' => 17.1, 'h' => 39.3 ), 'zoom' => 1,
		'body' => '<p>Sambar deer are one of the most important tiger prey species. They are often abundant in tiger reserves in India and Nepal. They can also be found across Southeast Asia, but are much rarer there due to hunting.</p>',
		'image' => isset( $media['sambar'] ) ? $media['sambar'] : null,
		'caption' => 'Sambar foal and its mother in Ranthambore Tiger Reserve, India © Martin Harvey / WWF',
	),
	array(
		'id' => 'pt-wildpig', 'wide' => false, 'side' => 'left',
		'number' => '02', 'label' => 'Sumatra, Indonesia', 'heading' => 'Wild pig',
		'status' => 'IUCN · Least concern', 'statusLevel' => 'least',
		'hotspot' => array( 'x' => 66.5, 'y' => 79.4, 'w' => 20, 'h' => 20.6 ), 'zoom' => 1,
		'body' => '<p>Wild pigs are the most widely distributed tiger prey species, occurring in every landscape in which tigers are found. On Sumatra they are one of the most important prey species of all. A female can have up to two litters a year, of four to eight piglets each.</p>',
		'image' => isset( $media['wildpig'] ) ? $media['wildpig'] : null,
		'caption' => 'Wild boar have brown fur that provides excellent camouflage in the forest © Ola Jennersten / WWF-Sweden',
	),
	array(
		'id' => 'pt-banteng', 'wide' => false, 'side' => 'right',
		'number' => '03', 'label' => 'Thailand', 'heading' => 'Banteng',
		'status' => 'IUCN · Endangered', 'statusLevel' => 'endangered',
		'hotspot' => array( 'x' => 66.2, 'y' => 55.5, 'w' => 14, 'h' => 18.3 ), 'zoom' => 1,
		'body' => '<p>One of the largest tiger prey species: banteng are wild cattle, classified as Endangered. Historic hunting and a current snaring crisis across Southeast Asia have driven their populations down — but in Thailand there are signs of hope.</p><p>A <a href="https://www.sciencedirect.com/science/article/pii/S2351989424002166" target="_blank" rel="noopener">recently published paper</a> showed banteng in Huai Kha Khaeng have doubled in 15 years, on the back of strong law enforcement and long-term investment in protecting a source tiger site.</p>',
		'image' => isset( $media['banteng'] ) ? $media['banteng'] : null,
		'caption' => 'A male banteng in Kuiburi National Park, Thailand © Wayuphong Jitvijak / WWF-Greater Mekong',
	),
	array(
		'id' => 'pt-bukhara', 'wide' => false, 'side' => 'left',
		'number' => '04', 'label' => 'Kazakhstan', 'heading' => "Bukhara\ndeer",
		'status' => 'Central Asian red deer', 'statusLevel' => '',
		'hotspot' => array( 'x' => 52, 'y' => 16, 'w' => 15.5, 'h' => 20 ), 'zoom' => 1,
		'body' => '<p>In Central Asia a different set of species matters. Bukhara deer — the Central Asian subspecies of red deer — are increasing thanks to conservation work. Restoring healthy numbers is key to a landmark reintroduction: tigers went extinct in Kazakhstan over 70 years ago, and are planned to return within a few years.</p>',
		'image' => isset( $media['bukhara'] ) ? $media['bukhara'] : null,
		'caption' => 'Newly released bukhara deer, Kazakhstan © WWF',
	),
	array(
		'id' => 'pt-nilgai', 'wide' => false, 'side' => 'right',
		'number' => '05', 'label' => 'India', 'heading' => 'Nilgai',
		'status' => 'IUCN · Least concern', 'statusLevel' => 'least',
		'hotspot' => array( 'x' => 46.2, 'y' => 42, 'w' => 17.7, 'h' => 33.9 ), 'zoom' => 1,
		'body' => '<p>Nilgai are the largest antelope in Asia. Thin legs, a large torso, a wide neck and a small head make them unmistakable. Found mostly in India and parts of Nepal, they weigh roughly 100–288 kg depending on sex.</p>',
		'image' => isset( $media['nilgai'] ) ? $media['nilgai'] : null,
		'caption' => 'Nilgai in Ranthambore Tiger Reserve, India © Ola Jennersten / WWF-Sweden',
	),
	array(
		'id' => 'pt-chital', 'wide' => false, 'side' => 'left',
		'number' => '06', 'label' => 'Nepal & India', 'heading' => 'Chital',
		'status' => 'IUCN · Least concern', 'statusLevel' => 'least',
		'hotspot' => array( 'x' => 56.4, 'y' => 40.7, 'w' => 11.4, 'h' => 14.8 ), 'zoom' => 1,
		'body' => '<p>Also known as spotted deer, chital are an important and abundant prey species for tigers in India and Nepal. They are also found in Bangladesh and Bhutan.</p>',
		'image' => isset( $media['chital'] ) ? $media['chital'] : null,
		'caption' => 'Chital on a camera trap in the Khata Corridor, Nepal © DoFSC / WWF Nepal',
	),
	array(
		'id' => 'pt-outro', 'wide' => true, 'side' => 'left',
		'label' => 'And many more', 'heading' => 'Six of many',
		'body' => "<p>These are just a few of the many tiger prey species. Other important ungulates across the tiger's range include gaur, roe deer, sika deer, hog deer, muntjac, barasingha and eld's deer.</p>",
		'image' => null, 'caption' => '', 'hotspot' => null, 'zoom' => 1,
		'number' => '', 'status' => '', 'statusLevel' => '',
	),
);

$attrs = array(
	'align'           => 'full',
	'sectionTitle'    => 'Tiger range countries',
	'backgroundImage' => isset( $media['map'] ) ? $media['map'] : null,
	/* The original anchors the map crop to its left edge — that is where the
	   artwork's own title and legend live. */
	'focalX'          => 0,
	'focalY'          => 50,
	'showPaws'        => true,
	'showMarkers'     => true,
	'showRail'        => true,
	'accentColor'     => '#8fd14f',
	'inkColor'        => '#f2efe6',
	'backdropColor'   => '#04140d',
	'cardColor'       => '#071a11',
	'dimOpacity'      => 0.62,
	'cardOpacity'     => 0.84,
	'points'          => $points,
);

$content = serialize_block( array(
	'blockName'    => 'wwf/scrollmap',
	'attrs'        => $attrs,
	'innerBlocks'  => array(),
	'innerHTML'    => '',
	'innerContent' => array(),
) );

$page      = get_page_by_path( 'tiger-range-countries' );
$page_args = array(
	'post_title'   => 'Tiger Range Countries',
	'post_name'    => 'tiger-range-countries',
	/* wp_insert_post()/wp_update_post() expect SLASHED data and call
	   wp_unslash() internally. serialize_block() JSON-escapes every "<" as
	   <, so without wp_slash() those backslashes are eaten and the
	   block attributes come back as literal "u003cpu003e" text. Classic
	   WordPress gotcha, and the reason the demo content looked mangled the
	   first time this ran. */
	'post_content' => wp_slash( $content ),
	'post_status'  => 'publish',
	'post_type'    => 'page',
);
if ( $page ) {
	$page_args['ID'] = $page->ID;
	$page_id         = wp_update_post( $page_args );
	WP_CLI::log( "updated page #$page_id" );
} else {
	$page_id = wp_insert_post( $page_args );
	WP_CLI::log( "created page #$page_id" );
}

update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $page_id );
update_option( 'blogname', 'WWF — Tiger prey' );

WP_CLI::success( 'Seeded. Front page: ' . home_url( '/' ) );
