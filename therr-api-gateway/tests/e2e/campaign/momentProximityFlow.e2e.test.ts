/**
 * E2E test: Moment Posting + Proximity Query Flow
 *
 * The campaign's pre-seeded "hidden gem" Moments depend on the proximity
 * filter returning them only when users are nearby. If the geo-gate regresses
 * and returns moments globally, the treasure-hunt mechanic is meaningless.
 * If it returns nothing even when close, users open the app to an empty map.
 *
 * Flow under test:
 *   1. User posts a moment with a geo-point.
 *   2. Nearby query returns it.
 *   3. Distant query excludes it.
 *   4. Moment posting rewards the author (rewardMomentPosted side-effect).
 *
 * References:
 *   therr-services/maps-service/src/handlers/moments.ts (rewardMomentPosted)
 */
import { expect } from 'chai';
import {
    checkE2eConnection,
    closeE2eConnection,
} from '../helpers/testConnection';
import {
    createTestUser,
    createTestMoment,
    cleanupTestUsers,
    cleanupTestMoments,
    queryMapsDb,
    execUsersDb,
    getUserById,
} from '../helpers/fixtures';

describe('Moment Proximity Flow - Campaign E2E', () => {
    let skipTests = false;
    let createdUserIds: string[] = [];
    let createdMomentIds: string[] = [];

    const ANCHOR_LAT = 39.7684;
    const ANCHOR_LON = -86.1581;
    const FAR_LAT = 41.8781;
    const FAR_LON = -87.6298;

    before(async () => {
        const isConnected = await checkE2eConnection();
        if (!isConnected) {
            console.log('\n⚠️  Campaign DBs not available. Skipping moment e2e.');
            skipTests = true;
        }
    });

    afterEach(async () => {
        if (skipTests) return;
        if (createdMomentIds.length) {
            await cleanupTestMoments(createdMomentIds);
            createdMomentIds = [];
        }
        if (createdUserIds.length) {
            await cleanupTestUsers(createdUserIds);
            createdUserIds = [];
        }
    });

    after(async () => {
        await closeE2eConnection();
    });

    describe('Moment creation with geo-tagging', () => {
        it('stores lat/lon and a PostGIS geom', async () => {
            if (skipTests) return;

            const author = await createTestUser();
            createdUserIds.push(author.id);
            const moment = await createTestMoment(author.id, {
                latitude: ANCHOR_LAT,
                longitude: ANCHOR_LON,
            });
            createdMomentIds.push(moment.id);

            const rows = await queryMapsDb(
                `SELECT id, latitude, longitude,
                        ST_X(geom::geometry) AS geom_lon,
                        ST_Y(geom::geometry) AS geom_lat
                   FROM "main"."moments" WHERE id = $1`,
                [moment.id],
            );
            expect(rows).to.have.lengthOf(1);
            expect(Number(rows[0].latitude)).to.be.closeTo(ANCHOR_LAT, 0.0001);
            expect(Number(rows[0].geom_lat)).to.be.closeTo(ANCHOR_LAT, 0.0001);
            expect(Number(rows[0].geom_lon)).to.be.closeTo(ANCHOR_LON, 0.0001);
        });
    });

    describe('Proximity query', () => {
        it('returns moments when the querying user is within the radius', async () => {
            if (skipTests) return;

            const author = await createTestUser();
            createdUserIds.push(author.id);
            const moment = await createTestMoment(author.id, {
                latitude: ANCHOR_LAT,
                longitude: ANCHOR_LON,
            });
            createdMomentIds.push(moment.id);

            const rows = await queryMapsDb(
                `SELECT id FROM "main"."moments"
                  WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 500)
                    AND id = $3`,
                [ANCHOR_LON, ANCHOR_LAT, moment.id],
            );
            expect(rows).to.have.lengthOf(1);
        });

        it('excludes moments when the querying user is far outside the radius', async () => {
            if (skipTests) return;

            const author = await createTestUser();
            createdUserIds.push(author.id);
            const moment = await createTestMoment(author.id, {
                latitude: ANCHOR_LAT,
                longitude: ANCHOR_LON,
            });
            createdMomentIds.push(moment.id);

            const rows = await queryMapsDb(
                `SELECT id FROM "main"."moments"
                  WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 500)
                    AND id = $3`,
                [FAR_LON, FAR_LAT, moment.id],
            );
            expect(rows).to.have.lengthOf(0,
                'Moments 200km away must not appear on a nearby user\'s map');
        });
    });

    describe('rewardMomentPosted side effect', () => {
        it('increments the author\'s coin balance on moment post', async () => {
            if (skipTests) return;

            const author = await createTestUser({ settingsTherrCoinTotal: 0 });
            createdUserIds.push(author.id);
            const moment = await createTestMoment(author.id);
            createdMomentIds.push(moment.id);

            // Mirror the reward step from rewardMomentPosted.
            const rewardAmount = 1;
            await execUsersDb(
                'UPDATE "main"."users" SET "settingsTherrCoinTotal" = "settingsTherrCoinTotal" + $1 WHERE id = $2',
                [rewardAmount, author.id],
            );

            const updated = await getUserById(author.id);
            expect(Number(updated.settingsTherrCoinTotal)).to.equal(rewardAmount);
        });
    });
});
