/**
 * Development seed file for moments, spaces, and events.
 *
 * Coordinates are centered in the Bay Area between:
 *   - iOS Simulator default: Apple Park, Cupertino (37.3318, -122.0312)
 *   - Android Emulator default: Googleplex, Mountain View (37.4221, -122.0841)
 *
 * Run with:
 *   npx knex seed:run --knexfile src/store/knexfile.js  (from maps-service directory)
 *
 * Uses ON CONFLICT (id) DO NOTHING for idempotency.
 */

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEV_GROUP_ID = '00000000-0000-0000-0000-000000000002';
const SPACE_RADIUS_METERS = 50;
const MOMENT_RADIUS = 100.0;
const LOCALE = 'en-us';
const REGION = 'us-east-1';

const moments = [
    {
        id: '10000000-0000-0000-0000-000000000001',
        message: 'Just discovered this hidden gem! Amazing views of the whole valley from up here.',
        notificationMsg: 'Just discovered this hidden gem!',
        category: 'uncategorized',
        latitude: 37.3361,
        longitude: -122.0389,
        hashTags: 'views,hiking,discovery',
        spaceId: null, // standalone moment
    },
    {
        id: '10000000-0000-0000-0000-000000000002',
        message: 'The morning coffee at this spot just hits different. Highly recommend to anyone passing by!',
        notificationMsg: 'The morning coffee at this spot just hits different.',
        category: 'uncategorized',
        latitude: 37.3490,
        longitude: -122.0480,
        hashTags: 'coffee,morningvibes,caffeine',
        spaceId: '20000000-0000-0000-0000-000000000001', // Cupertino Coffee House
    },
    {
        id: '10000000-0000-0000-0000-000000000003',
        message: 'Farmers market is back this weekend! Fresh produce and local artisan goods every Saturday.',
        notificationMsg: 'Farmers market is back this weekend!',
        category: 'uncategorized',
        latitude: 37.3700,
        longitude: -122.0620,
        hashTags: 'farmersmarket,local,fresh',
        spaceId: null, // standalone moment
    },
    {
        id: '10000000-0000-0000-0000-000000000004',
        message: 'Tech networking event was incredible tonight. Met so many brilliant minds in the valley.',
        notificationMsg: 'Tech networking event was incredible tonight.',
        category: 'uncategorized',
        latitude: 37.3861,
        longitude: -122.0839,
        hashTags: 'tech,networking,siliconvalley',
        spaceId: '20000000-0000-0000-0000-000000000003', // TechHub Coworking Space
    },
    {
        id: '10000000-0000-0000-0000-000000000005',
        message: 'Street art mural just went up on the corner. Absolutely stunning work by a local artist!',
        notificationMsg: 'Street art mural just went up on the corner.',
        category: 'uncategorized',
        latitude: 37.4000,
        longitude: -122.0750,
        hashTags: 'streetart,mural,art',
        spaceId: '20000000-0000-0000-0000-000000000006', // The Gallery at Mountain View
    },
    {
        id: '10000000-0000-0000-0000-000000000006',
        message: 'Running my favorite trail this morning. The weather is absolutely perfect today.',
        notificationMsg: 'Running my favorite trail this morning.',
        category: 'uncategorized',
        latitude: 37.4110,
        longitude: -122.0620,
        hashTags: 'running,fitness,outdoors',
        spaceId: null, // standalone moment
    },
    {
        id: '10000000-0000-0000-0000-000000000007',
        message: 'New food truck on the block serving authentic tacos. Line was totally worth the wait!',
        notificationMsg: 'New food truck serving authentic tacos.',
        category: 'uncategorized',
        latitude: 37.4221,
        longitude: -122.0841,
        hashTags: 'tacos,foodtruck,lunch',
        spaceId: '20000000-0000-0000-0000-000000000002', // Silicon Valley Bites
    },
    {
        id: '10000000-0000-0000-0000-000000000008',
        message: 'Sunset from the park bench today was absolutely unreal. Nature at its finest.',
        notificationMsg: 'Sunset from the park bench today was unreal.',
        category: 'uncategorized',
        latitude: 37.4300,
        longitude: -122.0900,
        hashTags: 'sunset,nature,peaceful',
        spaceId: null, // standalone moment
    },
    {
        id: '10000000-0000-0000-0000-000000000009',
        message: 'Community cleanup happened here last weekend. The neighborhood looks so much better!',
        notificationMsg: 'Community cleanup happened here last weekend.',
        category: 'uncategorized',
        latitude: 37.4150,
        longitude: -122.1000,
        hashTags: 'community,cleanup,neighborhood',
        spaceId: null, // standalone moment
    },
    {
        id: '10000000-0000-0000-0000-000000000010',
        message: 'Found the best little bookstore tucked away here. A true reader\'s paradise.',
        notificationMsg: 'Found the best bookstore tucked away here.',
        category: 'uncategorized',
        latitude: 37.3600,
        longitude: -122.0450,
        hashTags: 'books,reading,discovery',
        spaceId: '20000000-0000-0000-0000-000000000004', // Palo Alto Bookshop
    },
];

// Spaces are spread >500m apart with 50m radius to satisfy the no_area_overlaps constraint
const spaces = [
    {
        id: '20000000-0000-0000-0000-000000000001',
        message: 'Cupertino Coffee House - Your neighborhood specialty coffee destination with single-origin beans and artisan pastries.',
        notificationMsg: 'Cupertino Coffee House',
        category: 'uncategorized',
        latitude: 37.3320,
        longitude: -122.0310,
        hashTags: 'coffee,cafe,specialty',
    },
    {
        id: '20000000-0000-0000-0000-000000000002',
        message: 'Silicon Valley Bites - A fusion restaurant blending bold flavors from around the world.',
        notificationMsg: 'Silicon Valley Bites restaurant',
        category: 'uncategorized',
        latitude: 37.3490,
        longitude: -122.0530,
        hashTags: 'restaurant,fusion,dining',
    },
    {
        id: '20000000-0000-0000-0000-000000000003',
        message: 'TechHub Coworking Space - Hot desks, private offices, and a vibrant startup community.',
        notificationMsg: 'TechHub Coworking Space',
        category: 'uncategorized',
        latitude: 37.3700,
        longitude: -122.0600,
        hashTags: 'coworking,startup,office',
    },
    {
        id: '20000000-0000-0000-0000-000000000004',
        message: 'Palo Alto Bookshop - Curated independent bookstore specializing in tech, science, and fiction.',
        notificationMsg: 'Palo Alto Bookshop',
        category: 'uncategorized',
        latitude: 37.3850,
        longitude: -122.0800,
        hashTags: 'books,reading,local',
    },
    {
        id: '20000000-0000-0000-0000-000000000005',
        message: 'Peak Performance Gym - State-of-the-art fitness equipment and personal training sessions.',
        notificationMsg: 'Peak Performance Gym',
        category: 'uncategorized',
        latitude: 37.4000,
        longitude: -122.0700,
        hashTags: 'gym,fitness,workout',
    },
    {
        id: '20000000-0000-0000-0000-000000000006',
        message: 'The Gallery at Mountain View - Rotating exhibits from local and international artists.',
        notificationMsg: 'The Gallery at Mountain View',
        category: 'uncategorized',
        latitude: 37.4100,
        longitude: -122.0600,
        hashTags: 'art,gallery,culture',
    },
    {
        id: '20000000-0000-0000-0000-000000000007',
        message: 'The Taproom - Craft beers on tap from local Bay Area breweries. Always something new.',
        notificationMsg: 'The Taproom craft beer bar',
        category: 'uncategorized',
        latitude: 37.4220,
        longitude: -122.0800,
        hashTags: 'craftbeer,bar,local',
    },
    {
        id: '20000000-0000-0000-0000-000000000008',
        message: 'Sunrise Yoga Studio - Morning and evening yoga classes for all skill levels.',
        notificationMsg: 'Sunrise Yoga Studio',
        category: 'uncategorized',
        latitude: 37.4350,
        longitude: -122.0950,
        hashTags: 'yoga,wellness,mindfulness',
    },
    {
        id: '20000000-0000-0000-0000-000000000009',
        message: 'Valley Vintage - Curated vintage clothing and accessories from every decade. Always a find.',
        notificationMsg: 'Valley Vintage clothing store',
        category: 'uncategorized',
        latitude: 37.3600,
        longitude: -122.0450,
        hashTags: 'vintage,fashion,thrift',
    },
    {
        id: '20000000-0000-0000-0000-000000000010',
        message: 'Central Park Café - Open-air café inside the park with a locally sourced seasonal menu.',
        notificationMsg: 'Central Park Café',
        category: 'uncategorized',
        latitude: 37.3950,
        longitude: -122.0550,
        hashTags: 'cafe,outdoor,seasonal',
    },
];

const buildEvents = () => {
    const now = new Date();
    const daysFromNow = (days, extraHours = 0) => new Date(now.getTime() + (days * 24 + extraHours) * 60 * 60 * 1000);

    return [
        {
            id: '30000000-0000-0000-0000-000000000001',
            spaceId: '20000000-0000-0000-0000-000000000001',
            message: 'Latte Art Competition - Show off your barista skills! Open to all levels, prizes for top 3.',
            notificationMsg: 'Latte Art Competition at Cupertino Coffee House',
            category: 'uncategorized',
            latitude: 37.3320,
            longitude: -122.0310,
            hashTags: 'coffee,competition,fun',
            scheduleStartAt: daysFromNow(2),
            scheduleStopAt: daysFromNow(2, 3),
        },
        {
            id: '30000000-0000-0000-0000-000000000002',
            spaceId: '20000000-0000-0000-0000-000000000003',
            message: 'Bay Area Startup Pitch Night - Hear from 5 early-stage startups and connect with investors.',
            notificationMsg: 'Bay Area Startup Pitch Night',
            category: 'uncategorized',
            latitude: 37.3700,
            longitude: -122.0600,
            hashTags: 'startup,pitch,investors',
            scheduleStartAt: daysFromNow(3),
            scheduleStopAt: daysFromNow(3, 2),
        },
        {
            id: '30000000-0000-0000-0000-000000000003',
            spaceId: '20000000-0000-0000-0000-000000000005',
            message: 'Free Trial Bootcamp - 60-minute high-intensity workout session. No experience needed!',
            notificationMsg: 'Free Trial Bootcamp at Peak Performance Gym',
            category: 'uncategorized',
            latitude: 37.4000,
            longitude: -122.0700,
            hashTags: 'bootcamp,fitness,free',
            scheduleStartAt: daysFromNow(1),
            scheduleStopAt: daysFromNow(1, 1),
        },
        {
            id: '30000000-0000-0000-0000-000000000004',
            spaceId: '20000000-0000-0000-0000-000000000006',
            message: 'Opening Night: Digital Frontiers Exhibition - Celebrating AI-generated art and digital creativity.',
            notificationMsg: 'Opening Night: Digital Frontiers Exhibition',
            category: 'uncategorized',
            latitude: 37.4100,
            longitude: -122.0600,
            hashTags: 'art,ai,exhibition,opening',
            scheduleStartAt: daysFromNow(5),
            scheduleStopAt: daysFromNow(5, 4),
        },
        {
            id: '30000000-0000-0000-0000-000000000005',
            spaceId: '20000000-0000-0000-0000-000000000007',
            message: 'Craft Beer Tasting Flight - Sample 8 local brews paired with a curated food guide.',
            notificationMsg: 'Craft Beer Tasting Flight at The Taproom',
            category: 'uncategorized',
            latitude: 37.4220,
            longitude: -122.0800,
            hashTags: 'beer,tasting,craftbeer',
            scheduleStartAt: daysFromNow(4),
            scheduleStopAt: daysFromNow(4, 3),
        },
        {
            id: '30000000-0000-0000-0000-000000000006',
            spaceId: '20000000-0000-0000-0000-000000000008',
            message: 'Full Moon Yoga Flow - Outdoor yoga under the full moon. All levels welcome, mats provided.',
            notificationMsg: 'Full Moon Yoga Flow at Sunrise Yoga Studio',
            category: 'uncategorized',
            latitude: 37.4350,
            longitude: -122.0950,
            hashTags: 'yoga,fullmoon,outdoor,wellness',
            scheduleStartAt: daysFromNow(6),
            scheduleStopAt: daysFromNow(6, 2),
        },
        {
            id: '30000000-0000-0000-0000-000000000007',
            spaceId: null,
            message: 'Bay Area Developer Meetup - Monthly gathering for web and mobile developers. All stacks welcome.',
            notificationMsg: 'Bay Area Developer Meetup',
            category: 'uncategorized',
            latitude: 37.3861,
            longitude: -122.0839,
            hashTags: 'developers,meetup,tech',
            scheduleStartAt: daysFromNow(7),
            scheduleStopAt: daysFromNow(7, 2),
        },
        {
            id: '30000000-0000-0000-0000-000000000008',
            spaceId: null,
            message: 'Community Cleanup Day - Join your neighbors to clean up the park and surrounding streets.',
            notificationMsg: 'Community Cleanup Day',
            category: 'uncategorized',
            latitude: 37.4150,
            longitude: -122.1000,
            hashTags: 'community,cleanup,volunteer',
            scheduleStartAt: daysFromNow(8),
            scheduleStopAt: daysFromNow(8, 4),
        },
        {
            id: '30000000-0000-0000-0000-000000000009',
            spaceId: '20000000-0000-0000-0000-000000000002',
            message: "Chef's Table Dinner - 7-course tasting menu with wine pairings. Very limited seating.",
            notificationMsg: "Chef's Table Dinner at Silicon Valley Bites",
            category: 'uncategorized',
            latitude: 37.3490,
            longitude: -122.0530,
            hashTags: 'finedining,chefstable,wine',
            scheduleStartAt: daysFromNow(10),
            scheduleStopAt: daysFromNow(10, 3),
        },
        {
            id: '30000000-0000-0000-0000-000000000010',
            spaceId: '20000000-0000-0000-0000-000000000010',
            message: 'Sunday Jazz Brunch - Live jazz trio plays while you enjoy brunch favorites all morning.',
            notificationMsg: 'Sunday Jazz Brunch at Central Park Café',
            category: 'uncategorized',
            latitude: 37.3950,
            longitude: -122.0550,
            hashTags: 'jazz,brunch,livemusic',
            scheduleStartAt: daysFromNow(9),
            scheduleStopAt: daysFromNow(9, 3),
        },
    ];
};

exports.seed = async (knex) => {
    // ── Moments ────────────────────────────────────────────────────────────────
    const momentResults = await Promise.all(
        moments.map((m) => knex.raw(`
            INSERT INTO main.moments
                (id, "fromUserId", locale, "isPublic", message, "notificationMsg",
                 "mediaIds", "mentionsIds", "hashTags", "maxViews",
                 latitude, longitude, radius, "polygonCoords", "maxProximity",
                 "doesRequireProximityToView", "isMatureContent", "isModeratorApproved",
                 "isForSale", "isHirable", "isPromotional", "isExclusiveToGroups",
                 category, valuation, region, geom, "spaceId")
            VALUES
                (?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?, ?, ?::jsonb, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?)
            ON CONFLICT (id) DO UPDATE SET "spaceId" = EXCLUDED."spaceId"
        `, [
            m.id, DEV_USER_ID, LOCALE, true, m.message, m.notificationMsg,
            '', '', m.hashTags, 0,
            m.latitude, m.longitude, MOMENT_RADIUS, '[]', 0.0,
            false, false, true,
            false, false, false, false,
            m.category, 0, REGION, m.longitude, m.latitude, m.spaceId,
        ])),
    );

    const momentsInserted = momentResults.filter((r) => r.rowCount > 0).length;
    const momentsSkipped = momentResults.length - momentsInserted;
    // eslint-disable-next-line no-console
    console.log(`Moments seed complete: ${momentsInserted} inserted/updated, ${momentsSkipped} skipped`);

    // ── Spaces ─────────────────────────────────────────────────────────────────
    const spaceResults = await Promise.all(
        spaces.map((s) => knex.raw(`
            INSERT INTO main.spaces
                (id, "fromUserId", locale, "isPublic", message, "notificationMsg",
                 "mediaIds", "mentionsIds", "hashTags", "maxViews",
                 latitude, longitude, radius, "polygonCoords", "maxProximity",
                 "doesRequireProximityToView", "isMatureContent", "isModeratorApproved",
                 "isForSale", "isHirable", "isPromotional", "isExclusiveToGroups",
                 category, valuation, region, geom, "geomCenter")
            VALUES
                (?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?, ?, ?::jsonb, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?, ?,
                 ST_SetSRID(ST_Buffer(ST_MakePoint(?, ?)::geography, ?)::geometry, 4326),
                 ST_SetSRID(ST_MakePoint(?, ?), 4326))
            ON CONFLICT (id) DO NOTHING
        `, [
            s.id, DEV_USER_ID, LOCALE, true, s.message, s.notificationMsg,
            '', '', s.hashTags, 0,
            s.latitude, s.longitude, SPACE_RADIUS_METERS, '[]', 0.0,
            false, false, true,
            false, false, false, false,
            s.category, 0, REGION,
            s.longitude, s.latitude, SPACE_RADIUS_METERS,
            s.longitude, s.latitude,
        ])),
    );

    const spacesInserted = spaceResults.filter((r) => r.rowCount > 0).length;
    const spacesSkipped = spaceResults.length - spacesInserted;
    // eslint-disable-next-line no-console
    console.log(`Spaces seed complete: ${spacesInserted} inserted, ${spacesSkipped} skipped`);

    // ── Events ─────────────────────────────────────────────────────────────────
    const events = buildEvents();
    const eventResults = await Promise.all(
        events.map((e) => knex.raw(`
            INSERT INTO main.events
                (id, "fromUserId", "groupId", "spaceId", locale, "isPublic",
                 message, "notificationMsg", "mediaIds", "mentionsIds", "hashTags", "maxViews",
                 latitude, longitude, radius, "polygonCoords", "maxProximity",
                 "doesRequireProximityToView", "isMatureContent", "isModeratorApproved",
                 "isExclusiveToGroups", category, "areaType", "isDraft",
                 "scheduleStartAt", "scheduleStopAt", valuation, region, geom)
            VALUES
                (?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?::jsonb, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326))
            ON CONFLICT (id) DO NOTHING
        `, [
            e.id, DEV_USER_ID, DEV_GROUP_ID, e.spaceId, LOCALE, true,
            e.message, e.notificationMsg, '', '', e.hashTags, 0,
            e.latitude, e.longitude, MOMENT_RADIUS, '[]', 0.0,
            false, false, true,
            false, e.category, 'events', false,
            e.scheduleStartAt, e.scheduleStopAt, 0, REGION, e.longitude, e.latitude,
        ])),
    );

    const eventsInserted = eventResults.filter((r) => r.rowCount > 0).length;
    const eventsSkipped = eventResults.length - eventsInserted;
    // eslint-disable-next-line no-console
    console.log(`Events seed complete: ${eventsInserted} inserted, ${eventsSkipped} skipped`);
};
