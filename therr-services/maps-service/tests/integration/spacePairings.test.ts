/* eslint-disable no-unused-expressions */
/**
 * Integration Tests for Space Pairings
 *
 * These tests connect to a real PostgreSQL database with PostGIS to verify
 * that the space pairings feature works end-to-end at the data layer.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import SpacesStore from '../../src/store/SpacesStore';
import SpacePairingFeedbackStore from '../../src/store/SpacePairingFeedbackStore';
import MediaStore from '../../src/store/MediaStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    checkPostGIS,
} from './testDbConnection';

// Use remote coordinates unlikely to collide with any seeded data
// Each test uses a unique base latitude offset to avoid overlap constraints
const BASE_LAT = 61.0;
const BASE_LNG = 25.0;

describe('Space Pairings - Integration Tests', () => {
    const TEST_USER_ID = 'f896a269-f8cd-4838-b60e-cff9bf48b220';
    let spacesStore: SpacesStore;
    let feedbackStore: SpacePairingFeedbackStore;
    let skipTests = false;
    const createdSpaceIds: string[] = [];

    before(async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.'); // eslint-disable-line no-console
            skipTests = true;
            return;
        }

        const hasPostGIS = await checkPostGIS();
        if (!hasPostGIS) {
            console.log('\n⚠️  PostGIS extension not available. Skipping pairings tests.'); // eslint-disable-line no-console
            skipTests = true;
            return;
        }

        const connection = getTestConnection();
        const mediaStore = new MediaStore(connection);
        spacesStore = new SpacesStore(connection, mediaStore);
        feedbackStore = new SpacePairingFeedbackStore(connection);
    });

    beforeEach(async () => {
        if (skipTests) return;
        const conn = getTestConnection();
        try {
            if (createdSpaceIds.length > 0) {
                const ids = createdSpaceIds.map((id) => `'${id}'`).join(',');
                await conn.write.query(`DELETE FROM main."spacePairingFeedback" WHERE "sourceSpaceId" IN (${ids}) OR "pairedSpaceId" IN (${ids})`);
                await conn.write.query(`DELETE FROM main.spaces WHERE id IN (${ids})`);
                createdSpaceIds.length = 0;
            }
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        if (!skipTests) {
            const conn = getTestConnection();
            if (createdSpaceIds.length > 0) {
                try {
                    const ids = createdSpaceIds.map((id) => `'${id}'`).join(',');
                    await conn.write.query(`DELETE FROM main."spacePairingFeedback" WHERE "sourceSpaceId" IN (${ids}) OR "pairedSpaceId" IN (${ids})`);
                    await conn.write.query(`DELETE FROM main.spaces WHERE id IN (${ids})`);
                } catch {
                    // Ignore cleanup errors
                }
            }
            try {
                await conn.write.query(`DELETE FROM main."spacePairingFeedback" WHERE "userId" = '${TEST_USER_ID}'`);
            } catch {
                // Ignore cleanup errors
            }
        }
        await closeTestConnection();
    });

    const createTestSpace = async (params: {
        latitude: number;
        longitude: number;
        category: string;
        notificationMsg: string;
        isPublic?: boolean;
    }) => {
        const conn = getTestConnection();
        const isPublic = params.isPublic !== false;
        const result = await conn.write.query(`
            INSERT INTO main.spaces (
                "fromUserId", "notificationMsg", "message", "category",
                "latitude", "longitude", "radius", "region",
                "isPublic", "isMatureContent", "isClaimPending",
                "areaType", "locale",
                "geom", "geomCenter"
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, 1, 'FI',
                $7, false, false,
                'spaces', 'en-us',
                ST_SetSRID(ST_Buffer(ST_MakePoint($6, $5)::geography, 1::double precision)::geometry, 4326),
                ST_SetSRID(ST_MakePoint($6, $5), 4326)
            ) RETURNING id
        `, [
            TEST_USER_ID,
            params.notificationMsg,
            `Test space: ${params.notificationMsg}`,
            params.category,
            params.latitude,
            params.longitude,
            isPublic,
        ]);

        const spaceId = result.rows[0].id;
        createdSpaceIds.push(spaceId);
        return spaceId;
    };

    describe('SpacesStore.searchPairedSpaces', () => {
        it('should return nearby spaces excluding the source space', async () => {
            if (skipTests) return;

            const sourceId = await createTestSpace({
                latitude: BASE_LAT,
                longitude: BASE_LNG,
                category: 'categories.restaurant/food',
                notificationMsg: 'Test Restaurant Source',
            });

            const nearbyId = await createTestSpace({
                latitude: BASE_LAT + 0.001,
                longitude: BASE_LNG + 0.001,
                category: 'categories.bar/drinks',
                notificationMsg: 'Test Bar Nearby',
            });

            const results = await spacesStore.searchPairedSpaces(sourceId, BASE_LAT, BASE_LNG, 'categories.restaurant/food');

            expect(results).to.be.an('array');
            const sourceInResults = results.find((r: any) => r.id === sourceId);
            expect(sourceInResults).to.be.undefined;
            const nearbyInResults = results.find((r: any) => r.id === nearbyId);
            expect(nearbyInResults).to.not.be.undefined;
        });

        it('should not return spaces outside the radius', async () => {
            if (skipTests) return;

            const sourceId = await createTestSpace({
                latitude: BASE_LAT + 0.1,
                longitude: BASE_LNG,
                category: 'categories.restaurant/food',
                notificationMsg: 'Test Restaurant Radius',
            });

            // ~400km away
            await createTestSpace({
                latitude: BASE_LAT + 4.0,
                longitude: BASE_LNG,
                category: 'categories.bar/drinks',
                notificationMsg: 'Test Bar Far Away',
            });

            const results = await spacesStore.searchPairedSpaces(sourceId, BASE_LAT + 0.1, BASE_LNG, 'categories.restaurant/food');

            const farSpace = results.find((r: any) => r.notificationMsg === 'Test Bar Far Away');
            expect(farSpace).to.be.undefined;
        });

        it('should score complementary categories higher', async () => {
            if (skipTests) return;

            const sourceId = await createTestSpace({
                latitude: BASE_LAT + 0.2,
                longitude: BASE_LNG,
                category: 'categories.restaurant/food',
                notificationMsg: 'Test Restaurant Scoring',
            });

            // Complementary: bar (scored 2 for restaurant)
            await createTestSpace({
                latitude: BASE_LAT + 0.2 + 0.001,
                longitude: BASE_LNG + 0.001,
                category: 'categories.bar/drinks',
                notificationMsg: 'Test Complementary Bar',
            });

            // Non-complementary
            await createTestSpace({
                latitude: BASE_LAT + 0.2 + 0.002,
                longitude: BASE_LNG + 0.002,
                category: 'categories.hotels/lodging',
                notificationMsg: 'Test Non-Complementary Hotel',
            });

            const results = await spacesStore.searchPairedSpaces(sourceId, BASE_LAT + 0.2, BASE_LNG, 'categories.restaurant/food');

            expect(results.length).to.be.greaterThan(0);

            const barResult = results.find((r: any) => r.notificationMsg === 'Test Complementary Bar');
            const hotelResult = results.find((r: any) => r.notificationMsg === 'Test Non-Complementary Hotel');

            if (barResult && hotelResult) {
                expect(Number(barResult.catScore)).to.equal(2);
                expect(Number(hotelResult.catScore)).to.equal(1);
            }
        });

        it('should exclude non-public spaces', async () => {
            if (skipTests) return;

            const sourceId = await createTestSpace({
                latitude: BASE_LAT + 0.3,
                longitude: BASE_LNG,
                category: 'categories.restaurant/food',
                notificationMsg: 'Test Restaurant Filter',
            });

            await createTestSpace({
                latitude: BASE_LAT + 0.3 + 0.001,
                longitude: BASE_LNG + 0.001,
                category: 'categories.bar/drinks',
                notificationMsg: 'Private Space',
                isPublic: false,
            });

            const results = await spacesStore.searchPairedSpaces(sourceId, BASE_LAT + 0.3, BASE_LNG, 'categories.restaurant/food');

            const privateSpace = results.find((r: any) => r.notificationMsg === 'Private Space');
            expect(privateSpace).to.be.undefined;
        });

        it('should return at most 6 candidates', async () => {
            if (skipTests) return;

            const sourceId = await createTestSpace({
                latitude: BASE_LAT + 0.4,
                longitude: BASE_LNG,
                category: 'categories.restaurant/food',
                notificationMsg: 'Test Restaurant Limit',
            });

            // Create 8 nearby spaces sequentially with spread coordinates
            for (let i = 0; i < 8; i++) { // eslint-disable-line no-plusplus
                // eslint-disable-next-line no-await-in-loop
                await createTestSpace({
                    latitude: BASE_LAT + 0.4 + ((i + 1) * 0.002),
                    longitude: BASE_LNG + ((i + 1) * 0.002),
                    category: 'categories.bar/drinks',
                    notificationMsg: `Test Bar ${i}`,
                });
            }

            const results = await spacesStore.searchPairedSpaces(sourceId, BASE_LAT + 0.4, BASE_LNG, 'categories.restaurant/food');

            expect(results.length).to.be.at.most(6);
        });

        it('should return results with expected fields', async () => {
            if (skipTests) return;

            const sourceId = await createTestSpace({
                latitude: BASE_LAT + 0.5,
                longitude: BASE_LNG,
                category: 'categories.restaurant/food',
                notificationMsg: 'Test Restaurant Fields',
            });

            await createTestSpace({
                latitude: BASE_LAT + 0.5 + 0.001,
                longitude: BASE_LNG + 0.001,
                category: 'categories.bar/drinks',
                notificationMsg: 'Test Bar Fields',
            });

            const results = await spacesStore.searchPairedSpaces(sourceId, BASE_LAT + 0.5, BASE_LNG, 'categories.restaurant/food');

            expect(results.length).to.be.greaterThan(0);
            const result = results[0];
            expect(result).to.have.property('id');
            expect(result).to.have.property('notificationMsg');
            expect(result).to.have.property('category');
            expect(result).to.have.property('addressReadable');
            expect(result).to.have.property('latitude');
            expect(result).to.have.property('longitude');
            expect(result).to.have.property('distInMeters');
            expect(result).to.have.property('catScore');
        });

        it('should return empty array when no nearby spaces exist', async () => {
            if (skipTests) return;

            const sourceId = await createTestSpace({
                latitude: -45.0,
                longitude: 170.0,
                category: 'categories.restaurant/food',
                notificationMsg: 'Isolated Restaurant',
            });

            const results = await spacesStore.searchPairedSpaces(sourceId, -45.0, 170.0, 'categories.restaurant/food', { radiusMeters: 100 });

            expect(results).to.be.an('array');
            expect(results.length).to.equal(0);
        });
    });

    describe('SpacePairingFeedbackStore', () => {
        let feedbackSourceId: string;
        let feedbackPairedId: string;

        beforeEach(async () => {
            if (skipTests) return;
            // Create fresh spaces for each feedback test
            feedbackSourceId = await createTestSpace({
                latitude: BASE_LAT + 0.6 + (Math.random() * 0.01),
                longitude: BASE_LNG + (Math.random() * 0.01),
                category: 'categories.restaurant/food',
                notificationMsg: 'Feedback Source',
            });
            feedbackPairedId = await createTestSpace({
                latitude: BASE_LAT + 0.6 + 0.05 + (Math.random() * 0.01),
                longitude: BASE_LNG + 0.05 + (Math.random() * 0.01),
                category: 'categories.bar/drinks',
                notificationMsg: 'Feedback Paired',
            });
        });

        it('should create anonymous feedback', async () => {
            if (skipTests) return;

            const result = await feedbackStore.create({
                sourceSpaceId: feedbackSourceId,
                pairedSpaceId: feedbackPairedId,
                isHelpful: true,
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);
            expect(result[0]).to.have.property('id');
            expect(result[0].sourceSpaceId).to.equal(feedbackSourceId);
            expect(result[0].pairedSpaceId).to.equal(feedbackPairedId);
            expect(result[0].isHelpful).to.equal(true);
            expect(result[0].userId).to.be.null;
        });

        it('should create authenticated feedback', async () => {
            if (skipTests) return;

            const result = await feedbackStore.create({
                sourceSpaceId: feedbackSourceId,
                pairedSpaceId: feedbackPairedId,
                userId: TEST_USER_ID,
                isHelpful: true,
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);
            expect(result[0].userId).to.equal(TEST_USER_ID);
            expect(result[0].isHelpful).to.equal(true);
        });

        it('should upsert feedback for the same authenticated user', async () => {
            if (skipTests) return;

            await feedbackStore.create({
                sourceSpaceId: feedbackSourceId,
                pairedSpaceId: feedbackPairedId,
                userId: TEST_USER_ID,
                isHelpful: true,
            });

            // Second submission should update, not duplicate
            const result = await feedbackStore.create({
                sourceSpaceId: feedbackSourceId,
                pairedSpaceId: feedbackPairedId,
                userId: TEST_USER_ID,
                isHelpful: false,
            });

            expect(result).to.be.an('array');
            expect(result.length).to.equal(1);
            expect(result[0].isHelpful).to.equal(false);
        });

        it('should allow multiple anonymous feedbacks for the same pairing', async () => {
            if (skipTests) return;

            const result1 = await feedbackStore.create({
                sourceSpaceId: feedbackSourceId,
                pairedSpaceId: feedbackPairedId,
                isHelpful: true,
            });
            const result2 = await feedbackStore.create({
                sourceSpaceId: feedbackSourceId,
                pairedSpaceId: feedbackPairedId,
                isHelpful: false,
            });

            expect(result1[0].id).to.not.equal(result2[0].id);
        });

        it('should aggregate feedback counts correctly', async () => {
            if (skipTests) return;

            // Create 2 helpful + 1 not helpful
            await feedbackStore.create({ sourceSpaceId: feedbackSourceId, pairedSpaceId: feedbackPairedId, isHelpful: true });
            await feedbackStore.create({ sourceSpaceId: feedbackSourceId, pairedSpaceId: feedbackPairedId, isHelpful: true });
            await feedbackStore.create({ sourceSpaceId: feedbackSourceId, pairedSpaceId: feedbackPairedId, isHelpful: false });

            const aggregates = await feedbackStore.getAggregateBySourceId(feedbackSourceId);

            expect(aggregates).to.be.an('array');
            expect(aggregates.length).to.equal(1);
            expect(aggregates[0].pairedSpaceId).to.equal(feedbackPairedId);
            expect(Number(aggregates[0].helpfulCount)).to.equal(2);
            expect(Number(aggregates[0].notHelpfulCount)).to.equal(1);
        });
    });
});
