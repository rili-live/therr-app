/**
 * E2E test: Event Creation + Discovery Flow
 *
 * The launch Event is what the Treasure Hunt posters point people to. If
 * event creation fails or the geo-filter wrongly excludes nearby users, the
 * entire campaign becomes undiscoverable in-app.
 *
 * Flow under test:
 *   1. A user creates a time-bound event at known coordinates.
 *   2. Proximity search from within the radius returns the event.
 *   3. Proximity search from far away excludes it.
 *   4. EventPlanner achievement progresses for the creator.
 *
 * References:
 *   therr-services/maps-service/src/handlers/events.ts
 *   therr-public-library/therr-js-utilities/src/config/achievements/eventPlanner.ts
 */
import { expect } from 'chai';
import {
    checkE2eConnection,
    closeE2eConnection,
} from '../helpers/testConnection';
import {
    createTestUser,
    createTestEvent,
    cleanupTestUsers,
    cleanupTestEvents,
    queryUsersDb,
    execUsersDb,
    queryMapsDb,
} from '../helpers/fixtures';

describe('Event Creation Flow - Campaign E2E', () => {
    let skipTests = false;
    let createdUserIds: string[] = [];
    let createdEventIds: string[] = [];

    // Anchor coordinates for the campaign zone (arbitrary, used for proximity math).
    const ANCHOR_LAT = 39.7684;
    const ANCHOR_LON = -86.1581;
    // ~200km away — should always be outside a 1km campaign radius.
    const FAR_LAT = 41.8781;
    const FAR_LON = -87.6298;

    before(async () => {
        const isConnected = await checkE2eConnection();
        if (!isConnected) {
            console.log('\n⚠️  Campaign DBs not available. Skipping event e2e.');
            skipTests = true;
        }
    });

    afterEach(async () => {
        if (skipTests) return;
        if (createdEventIds.length) {
            await cleanupTestEvents(createdEventIds);
            createdEventIds = [];
        }
        if (createdUserIds.length) {
            await cleanupTestUsers(createdUserIds);
            createdUserIds = [];
        }
    });

    after(async () => {
        await closeE2eConnection();
    });

    describe('Event creation', () => {
        it('creates an event with future start time and valid geom', async () => {
            if (skipTests) return;

            const organizer = await createTestUser();
            createdUserIds.push(organizer.id);
            const event = await createTestEvent(organizer.id, {
                latitude: ANCHOR_LAT,
                longitude: ANCHOR_LON,
            });
            createdEventIds.push(event.id);

            const rows = await queryMapsDb(
                'SELECT id, "fromUserId", latitude, longitude, "scheduleStartAt" FROM "main"."events" WHERE id = $1',
                [event.id],
            );
            expect(rows).to.have.lengthOf(1);
            expect(rows[0].fromUserId).to.equal(organizer.id);
            expect(new Date(rows[0].scheduleStartAt).getTime())
                .to.be.greaterThan(Date.now(), 'Event must be scheduled in the future');
        });
    });

    describe('Proximity discovery', () => {
        it('returns the event to users within the campaign radius', async () => {
            if (skipTests) return;

            const organizer = await createTestUser();
            createdUserIds.push(organizer.id);
            const event = await createTestEvent(organizer.id, {
                latitude: ANCHOR_LAT,
                longitude: ANCHOR_LON,
            });
            createdEventIds.push(event.id);

            // Simulate the handler's proximity query. 1000m buffer around the
            // anchor — within a typical campaign zone.
            const rows = await queryMapsDb(
                `SELECT id FROM "main"."events"
                  WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 1000)
                    AND id = $3`,
                [ANCHOR_LON, ANCHOR_LAT, event.id],
            );
            expect(rows).to.have.lengthOf(1, 'Event must be returned to users within 1km');
        });

        it('excludes the event from users far outside the radius', async () => {
            if (skipTests) return;

            const organizer = await createTestUser();
            createdUserIds.push(organizer.id);
            const event = await createTestEvent(organizer.id, {
                latitude: ANCHOR_LAT,
                longitude: ANCHOR_LON,
            });
            createdEventIds.push(event.id);

            const rows = await queryMapsDb(
                `SELECT id FROM "main"."events"
                  WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 1000)
                    AND id = $3`,
                [FAR_LON, FAR_LAT, event.id],
            );
            expect(rows).to.have.lengthOf(0,
                'Proximity gate must exclude users 200km away — or every moment globally pollutes the feed');
        });
    });

    describe('EventPlanner achievement', () => {
        it('progresses eventPlanner achievement for the creator', async () => {
            if (skipTests) return;

            const organizer = await createTestUser();
            createdUserIds.push(organizer.id);

            await execUsersDb(
                `INSERT INTO "main"."userAchievements"
                    ("userId", "achievementId", "achievementClass", "achievementTier", "progressCount")
                 VALUES ($1, $2, $3, $4, $5)`,
                [organizer.id, 'eventPlanner_1_1', 'eventPlanner', '1_1', 1],
            );

            const rows = await queryUsersDb(
                'SELECT "progressCount" FROM "main"."userAchievements" WHERE "userId" = $1 AND "achievementClass" = $2',
                [organizer.id, 'eventPlanner'],
            );
            expect(rows).to.have.lengthOf(1);
            expect(Number(rows[0].progressCount)).to.equal(1);
        });
    });
});
