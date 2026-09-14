<?php
/**
 * Demo seeder for the wwf/scrollmap block — run via WP-CLI:
 *
 *   wp eval-file seed-demo.php
 *
 * Expects the standalone assets mounted at /seed-assets (see the docker run
 * command in README.md). Idempotent: re-running reuses existing attachments
 * (matched by slug) and updates the same page.
 *
 * Creates/updates:
 *   · 7 media-library images (map + 6 prey photos) with alt text
 *   · page "Tiger Range Countries" containing one fully-populated block
 *   · sets it as the site front page
 */

defined( 'ABSPATH' ) || exit;

$assets_dir = '/seed-assets';

$images = array(
	'map'     => array( 'file' => 'map.jpg',     'title' => 'Tiger range countries map', 'alt' => "Stylised map of Asia titled 'Tiger range countries', showing tiger populations and trends per country." ),
	'sambar'  => array( 'file' => 'sambar.jpg',  'title' => 'Sambar deer',   'alt' => 'A sambar deer foal standing beside its mother in dry grassland.' ),
	'wildpig' => array( 'file' => 'wildpig.jpg', 'title' => 'Wild boar',     'alt' => 'A wild boar walking through forest undergrowth.' ),
	'banteng' => array( 'file' => 'banteng.jpg', 'title' => 'Banteng',       'alt' => 'A male banteng, a large brown wild ox, standing in a forest clearing.' ),
	'bukhara' => array( 'file' => 'bukhara.jpg', 'title' => 'Bukhara deer',  'alt' => 'A herd of bukhara deer running across an open plain after release.' ),
	'nilgai'  => array( 'file' => 'nilgai.jpg',  'title' => 'Nilgai',        'alt' => 'A nilgai antelope standing alert in golden grassland.' ),
	'chital'  => array( 'file' => 'chital.jpg',  'title' => 'Chital',        'alt' => 'A chital, or spotted deer, captured on a night camera trap.' ),
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
	$media[ $key ] = array( 'id' => $att_id, 'url' => wp_get_attachment_url( $att_id ), 'alt' => $def['alt'] );
	WP_CLI::log( "media[$key] = #{$att_id}" );
}

/* ---- the full story content (measured hotspots from the original) -------- */
$points = array(
	array(
		'id' => 'pt-intro', 'align' => 'center', 'heading' => '',
		'body' => '<p>We talk a lot about <em>tiger prey</em>, but what animals do tigers eat?</p><p>The most important tiger prey are often ungulates, which are mammals with hooves, such as large deer, wild cattle, and wild pigs. Let’s take a look at some of the places where tiger prey are found.</p>',
		'image' => null, 'caption' => '', 'hotspot' => null,
	),
	array(
		'id' => 'pt-sambar', 'align' => 'right', 'heading' => 'Sambar deer',
		'body' => '<p>Sambar deer are one of the most important tiger prey species. They are often abundant in tiger reserves in India and Nepal. They can also be found across Southeast Asia but are much rarer in the region due to hunting. The IUCN lists sambar deer as Vulnerable.</p>',
		'image' => $media['sambar'] ?? null,
		'caption' => 'Sambar foal and its mother in Ranthambore Tiger Reserve, India © Martin Harvey / WWF',
		'hotspot' => array( 'x' => 48.5, 'y' => 43, 'w' => 17.1, 'h' => 39.3 ),
	),
	array(
		'id' => 'pt-wildpig', 'align' => 'left', 'heading' => 'Wild pig',
		'body' => '<p>Wild pigs are the most widely distributed tiger prey species and can be commonly found across Asia and occur in every landscape in which tigers are found. On the island of Sumatra (Indonesia) they are one of the most important tiger prey species. Female wild pig can have up to two litters of piglets per year, with 4-8 piglets per litter.</p>',
		'image' => $media['wildpig'] ?? null,
		'caption' => 'Wild boar have brown fur that provides excellent camouflage in the forest. © Ola Jennersten / WWF-Sweden',
		'hotspot' => array( 'x' => 66.5, 'y' => 79.4, 'w' => 20, 'h' => 20.6 ),
	),
	array(
		'id' => 'pt-banteng', 'align' => 'right', 'heading' => 'Banteng',
		'body' => '<p>One of the larger tiger prey species is the banteng, these are large wild cattle and are classified as Endangered by the IUCN. Historic hunting and a current snaring crisis in Southeast Asia have caused a decline in their populations. In Thailand, there are signs of hope with populations increasing.</p><p>A <a href="https://www.sciencedirect.com/science/article/pii/S2351989424002166" target="_blank" rel="noopener">recently published paper</a> showed that banteng populations in Huai Kha Khaeng have doubled in the past 15 years — the result of strong law enforcement and long-term investment into protection of a source tiger site.</p>',
		'image' => $media['banteng'] ?? null,
		'caption' => 'A male banteng photographed in Kuiburi National Park, Thailand. © Wayuphong Jitvijak / WWF-Greater Mekong',
		'hotspot' => array( 'x' => 66.2, 'y' => 55.5, 'w' => 14, 'h' => 18.3 ),
	),
	array(
		'id' => 'pt-bukhara', 'align' => 'right', 'heading' => 'Bukhara deer',
		'body' => '<p>In Central Asia a different set of species are important for tiger prey including bukhara deer. This is the Central Asian subspecies of the widespread red deer and populations are increasing thanks to conservation efforts. Restoring healthy bukhara deer numbers will be key to the success of a landmark tiger reintroduction project in the country. Tigers became extinct in Kazakhstan over 70 years ago and are planned to be reintroduced in the next few years.</p>',
		'image' => $media['bukhara'] ?? null,
		'caption' => 'Newly released bukhara deer, Kazakhstan. © WWF',
		'hotspot' => array( 'x' => 52, 'y' => 16, 'w' => 15.5, 'h' => 20 ),
	),
	array(
		'id' => 'pt-nilgai', 'align' => 'right', 'heading' => 'Nilgai',
		'body' => '<p>Commonly found in India, Nilgai are the largest antelope found in Asia. Their thin legs, large torso, wide neck, and small head make them unique. Mostly found in India and some parts of Nepal, this tiger prey weighs in at roughly 100-288 kg depending whether it’s male or female.</p>',
		'image' => $media['nilgai'] ?? null,
		'caption' => 'Nilgai spotted in Ranthambore Tiger Reserve, India. © Ola Jennersten / WWF-Sweden',
		'hotspot' => array( 'x' => 46.2, 'y' => 42, 'w' => 17.7, 'h' => 33.9 ),
	),
	array(
		'id' => 'pt-chital', 'align' => 'left', 'heading' => 'Chital',
		'body' => '<p>Also known as spotted deer, chital are an important and abundant prey species for tigers in India and Nepal. They can also be found in Bangladesh and Bhutan and are listed as Least Concern by the IUCN.</p>',
		'image' => $media['chital'] ?? null,
		'caption' => 'Chital recorded on camera traps set up to monitor wildlife in the Khata Corridor, Nepal. © DoFSC / WWF Nepal',
		'hotspot' => array( 'x' => 56.4, 'y' => 40.7, 'w' => 11.4, 'h' => 14.8 ),
	),
	array(
		'id' => 'pt-outro', 'align' => 'center', 'heading' => '',
		'body' => '<p>These are just a few examples of the many tiger prey species, other important ungulates for tigers in parts of their range include gaur, roe deer, sika deer, hog deer, muntjac, barasingha, and eld’s deer.</p>',
		'image' => null, 'caption' => '', 'hotspot' => null,
	),
);

$attrs = array(
	'align'           => 'full',
	'sectionTitle'    => 'Tiger range countries — scroll-driven map',
	'mode'            => 'cinematic',
	'backgroundImage' => $media['map'],
	'dimOpacity'      => 0.5,
	'highlightColor'  => '#2a6788',
	'highlightWidth'  => 4,
	'travelMs'        => 800,
	'cardOpacity'     => 0.85,
	'points'          => $points,
);

$content = serialize_block( array(
	'blockName'    => 'wwf/scrollmap',
	'attrs'        => $attrs,
	'innerBlocks'  => array(),
	'innerHTML'    => '',
	'innerContent' => array(),
) );

$existing_page = get_page_by_path( 'tiger-range-countries' );
$page_args = array(
	'post_title'   => 'Tiger Range Countries',
	'post_name'    => 'tiger-range-countries',
	'post_type'    => 'page',
	'post_status'  => 'publish',
	'post_content' => $content,
);
if ( $existing_page ) {
	$page_args['ID'] = $existing_page->ID;
	$page_id = wp_update_post( $page_args );
} else {
	$page_id = wp_insert_post( $page_args );
}

update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $page_id );

WP_CLI::success( "Page #$page_id 'Tiger Range Countries' published and set as front page." );
