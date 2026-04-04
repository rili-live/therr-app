/**
 * Development seed file for reactions with review data.
 *
 * Generates moment reactions, space reactions (with ratings), and event reactions
 * using the shared seed IDs from therr-services/seed-constants.js.
 *
 * Run with:
 *   npx knex seed:run --knexfile src/store/knexfile.js  (from reactions-service directory)
 *
 * Uses ON CONFLICT DO NOTHING for idempotency.
 */

const seed = require('../../../../seed-constants'); // eslint-disable-line @typescript-eslint/no-var-requires

const {
    DEV_USER_ID, DEV_USER_IDS, MOMENT_IDS, SPACE_IDS, EVENT_IDS, LOCALE,
} = seed;

// Pre-generated reaction UUIDs (moments: 40000000, spaces: 50000000, events: 60000000)
const MOMENT_REACTION_PREFIX = '40000000-0000-0000-0000-';
const SPACE_REACTION_PREFIX = '50000000-0000-0000-0000-';
const EVENT_REACTION_PREFIX = '60000000-0000-0000-0000-';

const padId = (n) => String(n).padStart(12, '0');

// ── Moment Reactions ─────────────────────────────────────────────────────────
// Various dev users react to seeded moments
const momentReactions = [
    // User 1 liked moment 1
    {
        id: `${MOMENT_REACTION_PREFIX}${padId(1)}`,
        momentId: MOMENT_IDS[0],
        userId: DEV_USER_IDS[0],
        userHasActivated: true,
        userHasLiked: true,
        userHasSuperLiked: false,
        userHasDisliked: false,
        userViewCount: 3,
    },
    // User 2 super-liked moment 1
    {
        id: `${MOMENT_REACTION_PREFIX}${padId(2)}`,
        momentId: MOMENT_IDS[0],
        userId: DEV_USER_IDS[1],
        userHasActivated: true,
        userHasLiked: false,
        userHasSuperLiked: true,
        userHasDisliked: false,
        userViewCount: 1,
    },
    // User 3 liked moment 2 (coffee moment linked to Cupertino Coffee House)
    {
        id: `${MOMENT_REACTION_PREFIX}${padId(3)}`,
        momentId: MOMENT_IDS[1],
        userId: DEV_USER_IDS[2],
        userHasActivated: true,
        userHasLiked: true,
        userHasSuperLiked: false,
        userHasDisliked: false,
        userViewCount: 2,
    },
    // User 4 disliked moment 4 (tech networking)
    {
        id: `${MOMENT_REACTION_PREFIX}${padId(4)}`,
        momentId: MOMENT_IDS[3],
        userId: DEV_USER_IDS[3],
        userHasActivated: true,
        userHasLiked: false,
        userHasSuperLiked: false,
        userHasDisliked: true,
        userViewCount: 1,
    },
    // User 5 liked moment 5 (street art linked to The Gallery)
    {
        id: `${MOMENT_REACTION_PREFIX}${padId(5)}`,
        momentId: MOMENT_IDS[4],
        userId: DEV_USER_IDS[4],
        userHasActivated: true,
        userHasLiked: true,
        userHasSuperLiked: false,
        userHasDisliked: false,
        userViewCount: 5,
    },
    // User 1 liked moment 7 (food truck linked to Silicon Valley Bites)
    {
        id: `${MOMENT_REACTION_PREFIX}${padId(6)}`,
        momentId: MOMENT_IDS[6],
        userId: DEV_USER_IDS[0],
        userHasActivated: true,
        userHasLiked: true,
        userHasSuperLiked: false,
        userHasDisliked: false,
        userViewCount: 2,
    },
    // User 6 bookmarked moment 10 (bookstore linked to Palo Alto Bookshop)
    {
        id: `${MOMENT_REACTION_PREFIX}${padId(7)}`,
        momentId: MOMENT_IDS[9],
        userId: DEV_USER_IDS[5],
        userHasActivated: true,
        userHasLiked: true,
        userHasSuperLiked: false,
        userHasDisliked: false,
        userViewCount: 4,
        userBookmarkCategory: 'favorites',
    },
];

// ── Space Reactions (with ratings/reviews) ───────────────────────────────────
// Multiple users rate and review seeded spaces
const spaceReactions = [
    // Cupertino Coffee House - 3 reviews
    {
        id: `${SPACE_REACTION_PREFIX}${padId(1)}`,
        spaceId: SPACE_IDS[0],
        userId: DEV_USER_IDS[0],
        userHasActivated: true,
        userHasLiked: true,
        rating: 5,
        userViewCount: 8,
    },
    {
        id: `${SPACE_REACTION_PREFIX}${padId(2)}`,
        spaceId: SPACE_IDS[0],
        userId: DEV_USER_IDS[1],
        userHasActivated: true,
        userHasLiked: true,
        rating: 4,
        userViewCount: 3,
    },
    {
        id: `${SPACE_REACTION_PREFIX}${padId(3)}`,
        spaceId: SPACE_IDS[0],
        userId: DEV_USER_IDS[2],
        userHasActivated: true,
        userHasLiked: false,
        rating: 3,
        userViewCount: 1,
    },
    // Silicon Valley Bites - 2 reviews
    {
        id: `${SPACE_REACTION_PREFIX}${padId(4)}`,
        spaceId: SPACE_IDS[1],
        userId: DEV_USER_IDS[3],
        userHasActivated: true,
        userHasLiked: true,
        rating: 5,
        userViewCount: 6,
    },
    {
        id: `${SPACE_REACTION_PREFIX}${padId(5)}`,
        spaceId: SPACE_IDS[1],
        userId: DEV_USER_IDS[4],
        userHasActivated: true,
        userHasLiked: true,
        rating: 4,
        userViewCount: 2,
    },
    // TechHub Coworking Space - 2 reviews
    {
        id: `${SPACE_REACTION_PREFIX}${padId(6)}`,
        spaceId: SPACE_IDS[2],
        userId: DEV_USER_IDS[0],
        userHasActivated: true,
        userHasLiked: true,
        rating: 4,
        userViewCount: 10,
    },
    {
        id: `${SPACE_REACTION_PREFIX}${padId(7)}`,
        spaceId: SPACE_IDS[2],
        userId: DEV_USER_IDS[5],
        userHasActivated: true,
        userHasLiked: false,
        rating: 2,
        userViewCount: 1,
    },
    // Palo Alto Bookshop - 1 review
    {
        id: `${SPACE_REACTION_PREFIX}${padId(8)}`,
        spaceId: SPACE_IDS[3],
        userId: DEV_USER_IDS[6],
        userHasActivated: true,
        userHasLiked: true,
        rating: 5,
        userViewCount: 4,
        userBookmarkCategory: 'favorites',
    },
    // Peak Performance Gym - 2 reviews
    {
        id: `${SPACE_REACTION_PREFIX}${padId(9)}`,
        spaceId: SPACE_IDS[4],
        userId: DEV_USER_IDS[7],
        userHasActivated: true,
        userHasLiked: true,
        rating: 4,
        userViewCount: 12,
    },
    {
        id: `${SPACE_REACTION_PREFIX}${padId(10)}`,
        spaceId: SPACE_IDS[4],
        userId: DEV_USER_IDS[8],
        userHasActivated: true,
        userHasLiked: true,
        rating: 5,
        userViewCount: 7,
    },
    // The Gallery at Mountain View - 1 review
    {
        id: `${SPACE_REACTION_PREFIX}${padId(11)}`,
        spaceId: SPACE_IDS[5],
        userId: DEV_USER_IDS[9],
        userHasActivated: true,
        userHasLiked: true,
        rating: 3,
        userViewCount: 2,
    },
    // The Taproom - 2 reviews
    {
        id: `${SPACE_REACTION_PREFIX}${padId(12)}`,
        spaceId: SPACE_IDS[6],
        userId: DEV_USER_IDS[0],
        userHasActivated: true,
        userHasLiked: true,
        rating: 5,
        userViewCount: 15,
    },
    {
        id: `${SPACE_REACTION_PREFIX}${padId(13)}`,
        spaceId: SPACE_IDS[6],
        userId: DEV_USER_IDS[1],
        userHasActivated: true,
        userHasLiked: true,
        rating: 4,
        userViewCount: 3,
    },
];

// ── Event Reactions ──────────────────────────────────────────────────────────
const eventReactions = [
    // Latte Art Competition
    {
        id: `${EVENT_REACTION_PREFIX}${padId(1)}`,
        eventId: EVENT_IDS[0],
        userId: DEV_USER_IDS[0],
        userHasActivated: true,
        userHasLiked: true,
        rating: 5,
        userViewCount: 2,
    },
    // Startup Pitch Night
    {
        id: `${EVENT_REACTION_PREFIX}${padId(2)}`,
        eventId: EVENT_IDS[1],
        userId: DEV_USER_IDS[2],
        userHasActivated: true,
        userHasLiked: true,
        rating: 4,
        userViewCount: 3,
    },
    // Free Trial Bootcamp
    {
        id: `${EVENT_REACTION_PREFIX}${padId(3)}`,
        eventId: EVENT_IDS[2],
        userId: DEV_USER_IDS[7],
        userHasActivated: true,
        userHasLiked: true,
        rating: 5,
        userViewCount: 1,
    },
    // Community Cleanup Day
    {
        id: `${EVENT_REACTION_PREFIX}${padId(4)}`,
        eventId: EVENT_IDS[7],
        userId: DEV_USER_IDS[4],
        userHasActivated: true,
        userHasLiked: true,
        rating: 4,
        userViewCount: 2,
    },
    // Jazz Brunch - bookmarked
    {
        id: `${EVENT_REACTION_PREFIX}${padId(5)}`,
        eventId: EVENT_IDS[9],
        userId: DEV_USER_IDS[9],
        userHasActivated: true,
        userHasLiked: true,
        rating: 5,
        userViewCount: 4,
        userBookmarkCategory: 'upcoming',
    },
];

exports.seed = async (knex) => {
    // ── Moment Reactions ─────────────────────────────────────────────────────
    const momentResults = await Promise.all(
        momentReactions.map((r) => knex.raw(`
            INSERT INTO main."momentReactions"
                (id, "momentId", "userId", "userHasActivated", "userHasLiked",
                 "userHasSuperLiked", "userHasDisliked", "userHasSuperDisliked",
                 "userLocale", "userHasReported", "isArchived", "userViewCount",
                 "userBookmarkCategory", "contentAuthorId")
            VALUES
                (?::uuid, ?::uuid, ?::uuid, ?, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?::uuid)
            ON CONFLICT ("momentId", "userId") DO NOTHING
        `, [
            r.id, r.momentId, r.userId, r.userHasActivated, r.userHasLiked,
            r.userHasSuperLiked || false, r.userHasDisliked || false, false,
            LOCALE, false, false, r.userViewCount || 0,
            r.userBookmarkCategory || '', DEV_USER_ID,
        ])),
    );

    const momentsInserted = momentResults.filter((res) => res.rowCount > 0).length;
    const momentsSkipped = momentResults.length - momentsInserted;
    // eslint-disable-next-line no-console
    console.log(`Moment reactions seed: ${momentsInserted} inserted, ${momentsSkipped} skipped`);

    // ── Space Reactions ──────────────────────────────────────────────────────
    const spaceResults = await Promise.all(
        spaceReactions.map((r) => knex.raw(`
            INSERT INTO main."spaceReactions"
                (id, "spaceId", "userId", "userHasActivated", "userHasLiked",
                 "userHasSuperLiked", "userHasDisliked", "userHasSuperDisliked",
                 "userLocale", "userHasReported", "isArchived", "userViewCount",
                 "userBookmarkCategory", rating)
            VALUES
                (?::uuid, ?::uuid, ?::uuid, ?, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?)
            ON CONFLICT ("spaceId", "userId") DO NOTHING
        `, [
            r.id, r.spaceId, r.userId, r.userHasActivated, r.userHasLiked,
            false, false, false,
            LOCALE, false, false, r.userViewCount || 0,
            r.userBookmarkCategory || '', r.rating,
        ])),
    );

    const spacesInserted = spaceResults.filter((res) => res.rowCount > 0).length;
    const spacesSkipped = spaceResults.length - spacesInserted;
    // eslint-disable-next-line no-console
    console.log(`Space reactions seed: ${spacesInserted} inserted, ${spacesSkipped} skipped`);

    // ── Event Reactions ──────────────────────────────────────────────────────
    const eventResults = await Promise.all(
        eventReactions.map((r) => knex.raw(`
            INSERT INTO main."eventReactions"
                (id, "eventId", "userId", "userHasActivated", "userHasLiked",
                 "userHasSuperLiked", "userHasDisliked", "userHasSuperDisliked",
                 "userLocale", "userHasReported", "isArchived", "userViewCount",
                 "userBookmarkCategory", rating, "contentAuthorId")
            VALUES
                (?::uuid, ?::uuid, ?::uuid, ?, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?,
                 ?, ?, ?::uuid)
            ON CONFLICT ("eventId", "userId") DO NOTHING
        `, [
            r.id, r.eventId, r.userId, r.userHasActivated, r.userHasLiked,
            false, false, false,
            LOCALE, false, false, r.userViewCount || 0,
            r.userBookmarkCategory || '', r.rating, DEV_USER_ID,
        ])),
    );

    const eventsInserted = eventResults.filter((res) => res.rowCount > 0).length;
    const eventsSkipped = eventResults.length - eventsInserted;
    // eslint-disable-next-line no-console
    console.log(`Event reactions seed: ${eventsInserted} inserted, ${eventsSkipped} skipped`);
};
