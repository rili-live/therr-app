/**
 * Integration Tests for Maps Service
 *
 * These tests connect to a real PostgreSQL database with PostGIS to verify
 * that the data layer works correctly.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import MediaStore, { ICreateMediaParams } from '../../src/store/MediaStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    checkPostGIS,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests', () => {
    const TEST_USER_ID = 'f896a269-f8cd-4838-b60e-cff9bf48b220';
    let mediaStore: MediaStore;
    let skipTests = false;
    let createdMediaIds: string[] = [];

    before(async () => {
        // Check if database is available
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.');
            console.log('   Start the database with: docker compose -f docker-compose.infra.yml up -d');
            console.log('   Run migrations with: npm run migrations:run\n');
            skipTests = true;
            return;
        }

        // Check if PostGIS is available
        const hasPostGIS = await checkPostGIS();
        if (!hasPostGIS) {
            console.log('\n⚠️  PostGIS extension not available. Some geo tests may fail.');
        }

        // Initialize store with real connection
        const connection = getTestConnection();
        mediaStore = new MediaStore(connection);
    });

    beforeEach(async () => {
        if (skipTests) return;
        // Clean up any leftover test data
        try {
            await cleanupTestData('media', { fromUserId: TEST_USER_ID });
            createdMediaIds = [];
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test data
        try {
            await cleanupTestData('media', { fromUserId: TEST_USER_ID });
        } catch {
            // Ignore cleanup errors
        }
        // Close database connections
        await closeTestConnection();
    });

    describe('MediaStore - Database Integration', () => {
        it('should create media in the database', async () => {
            if (skipTests) return;

            const testMedia: ICreateMediaParams = {
                fromUserId: TEST_USER_ID,
                altText: 'Test integration media',
                type: 'image/jpeg',
                path: 'test/integration/path.jpg',
            };

            // Create the media
            const mediaIds = await mediaStore.create(testMedia);

            // Verify the media was created
            expect(mediaIds).to.be.an('array');
            expect(mediaIds.length).to.equal(1);
            expect(mediaIds[0]).to.be.a('string');

            createdMediaIds.push(...mediaIds);
        });

        it('should get media by ids', async () => {
            if (skipTests) return;

            // First create media
            const testMedia: ICreateMediaParams = {
                fromUserId: TEST_USER_ID,
                altText: 'Test get media',
                type: 'image/png',
                path: 'test/integration/get-test.png',
            };
            const mediaIds = await mediaStore.create(testMedia);
            createdMediaIds.push(...mediaIds);

            // Get the media
            const foundMedia = await mediaStore.get(mediaIds);

            expect(foundMedia).to.be.an('array');
            expect(foundMedia.length).to.equal(1);
            expect(foundMedia[0].id).to.equal(mediaIds[0]);
            expect(foundMedia[0].fromUserId).to.equal(TEST_USER_ID);
            expect(foundMedia[0].altText).to.equal('Test get media');
            expect(foundMedia[0].type).to.equal('image/png');
            expect(foundMedia[0].path).to.equal('test/integration/get-test.png');
        });

        it('should return empty array for non-existent media ids', async () => {
            if (skipTests) return;

            const foundMedia = await mediaStore.get(['0a97ac14-365b-4fa6-89f8-4e2f33813a40']);

            expect(foundMedia).to.be.an('array');
            expect(foundMedia.length).to.equal(0);
        });
    });

    describe('PostGIS - Database Integration', () => {
        it('should verify PostGIS is available and functional', async () => {
            if (skipTests) return;

            const connection = getTestConnection();

            // Test a simple PostGIS function
            const result = await connection.read.query(
                'SELECT ST_AsText(ST_MakePoint(-122.4194, 37.7749)) as point',
            );

            expect(result.rows).to.be.an('array');
            expect(result.rows.length).to.equal(1);
            expect(result.rows[0].point).to.include('POINT');
        });

        it('should calculate distance between two points', async () => {
            if (skipTests) return;

            const connection = getTestConnection();

            // Calculate distance between two points (San Francisco and Los Angeles)
            const result = await connection.read.query(`
                SELECT ST_Distance(
                    ST_MakePoint(-122.4194, 37.7749)::geography,
                    ST_MakePoint(-118.2437, 34.0522)::geography
                ) as distance_meters
            `);

            expect(result.rows).to.be.an('array');
            expect(result.rows.length).to.equal(1);
            // Distance should be approximately 559km (559000 meters)
            const distance = Number(result.rows[0].distance_meters);
            expect(distance).to.be.greaterThan(500000);
            expect(distance).to.be.lessThan(600000);
        });
    });
});
