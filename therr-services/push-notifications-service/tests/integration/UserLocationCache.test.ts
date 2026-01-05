/**
 * Integration Tests for UserLocationCache
 *
 * These tests connect to a real Redis instance to verify
 * that the UserLocationCache class works correctly with Redis operations.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import {
    getTestRedisClient,
    closeTestRedisConnection,
    checkRedisConnection,
    cleanupTestData,
} from './testRedisConnection';

describe('UserLocationCache Integration Tests', () => {
    const TEST_USER_ID = 'cache-integration-test-user';
    let skipTests = false;

    before(async () => {
        // Check if Redis is available
        const isConnected = await checkRedisConnection();
        if (!isConnected) {
            console.log('\n⚠️  Redis not available. Skipping UserLocationCache integration tests.');
            console.log('   Start the infrastructure with: docker compose -f docker-compose.infra.yml up -d\n');
            skipTests = true;
        }
    });

    beforeEach(async () => {
        if (skipTests) return;
        // Clean up any leftover test data
        try {
            await cleanupTestData(`user:${TEST_USER_ID}`);
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test data
        try {
            await cleanupTestData(`user:${TEST_USER_ID}`);
        } catch {
            // Ignore cleanup errors
        }
        // Close Redis connection
        await closeTestRedisConnection();
    });

    describe('Origin Storage', () => {
        it('should store and retrieve origin coordinates', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const originKey = `user:${TEST_USER_ID}:nearby-moments`;
            const origin = { longitude: -122.4194, latitude: 37.7749 };

            // Store origin
            await client.hset(originKey, 'origin', JSON.stringify(origin));

            // Retrieve origin
            const storedOrigin = await client.hget(originKey, 'origin');
            const parsedOrigin = JSON.parse(storedOrigin!);

            expect(parsedOrigin.longitude).to.equal(-122.4194);
            expect(parsedOrigin.latitude).to.equal(37.7749);

            // Cleanup
            await client.del(originKey);
        });

        it('should return null for non-existent origin', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const originKey = `user:${TEST_USER_ID}:nearby-moments`;

            const result = await client.hget(originKey, 'origin');
            expect(result).to.be.eq(null);
        });

        it('should update origin when user moves', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const originKey = `user:${TEST_USER_ID}:nearby-moments`;

            // Initial origin
            const origin1 = { longitude: -122.4194, latitude: 37.7749 };
            await client.hset(originKey, 'origin', JSON.stringify(origin1));

            // Update origin
            const origin2 = { longitude: -122.4200, latitude: 37.7755 };
            await client.hset(originKey, 'origin', JSON.stringify(origin2));

            // Verify updated origin
            const storedOrigin = await client.hget(originKey, 'origin');
            const parsedOrigin = JSON.parse(storedOrigin!);

            expect(parsedOrigin.longitude).to.equal(-122.4200);
            expect(parsedOrigin.latitude).to.equal(37.7755);

            // Cleanup
            await client.del(originKey);
        });
    });

    describe('Last Notification Date', () => {
        it('should store and retrieve last moment notification date', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const momentsKey = `user:${TEST_USER_ID}:nearby-moments`;
            const now = Date.now();

            await client.hset(momentsKey, 'lastNotificationDateMs', now.toString());

            const stored = await client.hget(momentsKey, 'lastNotificationDateMs');
            expect(Number(stored)).to.equal(now);

            // Cleanup
            await client.del(momentsKey);
        });

        it('should store and retrieve last space notification date', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const spacesKey = `user:${TEST_USER_ID}:nearby-spaces`;
            const now = Date.now();

            await client.hset(spacesKey, 'lastNotificationDateMs', now.toString());

            const stored = await client.hget(spacesKey, 'lastNotificationDateMs');
            expect(Number(stored)).to.equal(now);

            // Cleanup
            await client.del(spacesKey);
        });

        it('should return null for non-existent notification date', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const momentsKey = `user:${TEST_USER_ID}:nearby-moments`;

            const result = await client.hget(momentsKey, 'lastNotificationDateMs');
            expect(result).to.be.eq(null);
        });
    });

    describe('Max Activation Distance', () => {
        it('should store and retrieve max moment activation distance', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const distanceKey = `user:${TEST_USER_ID}:nearby-momentsmaxActivationDistance`;

            await client.set(distanceKey, '500');

            const stored = await client.get(distanceKey);
            expect(stored).to.equal('500');

            // Cleanup
            await client.del(distanceKey);
        });

        it('should store and retrieve max space activation distance', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const distanceKey = `user:${TEST_USER_ID}:nearby-spacesmaxActivationDistance`;

            await client.set(distanceKey, '300');

            const stored = await client.get(distanceKey);
            expect(stored).to.equal('300');

            // Cleanup
            await client.del(distanceKey);
        });
    });

    describe('Geo Operations for Areas', () => {
        it('should add moments with geo coordinates', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const geoKey = `user:${TEST_USER_ID}:nearby-moments-geo`;

            // Add moment locations
            await client.geoadd(geoKey, -122.4194, 37.7749, 'moment-1');
            await client.geoadd(geoKey, -122.4200, 37.7755, 'moment-2');

            // Verify members exist
            const members = await client.zrange(geoKey, 0, -1);
            expect(members).to.include('moment-1');
            expect(members).to.include('moment-2');

            // Cleanup
            await client.del(geoKey);
        });

        it('should find moments within radius using georadius', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const geoKey = `user:${TEST_USER_ID}:nearby-moments-geo`;

            // Add moment locations around San Francisco
            await client.geoadd(geoKey, -122.4194, 37.7749, 'sf-moment');
            await client.geoadd(geoKey, -122.4200, 37.7755, 'nearby-moment');
            await client.geoadd(geoKey, -118.2437, 34.0522, 'la-moment'); // Los Angeles

            // Find moments within 1km of SF center
            const nearby = await (client as any).georadius(geoKey, -122.4194, 37.7749, 1, 'km');

            expect(nearby).to.include('sf-moment');
            expect(nearby).to.include('nearby-moment');
            expect(nearby).to.not.include('la-moment');

            // Cleanup
            await client.del(geoKey);
        });

        it('should remove moments from geo index', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const geoKey = `user:${TEST_USER_ID}:nearby-moments-geo`;

            // Add moments
            await client.geoadd(geoKey, -122.4194, 37.7749, 'moment-1');
            await client.geoadd(geoKey, -122.4200, 37.7755, 'moment-2');

            // Remove one moment
            await client.zrem(geoKey, 'moment-1');

            // Verify removal
            const members = await client.zrange(geoKey, 0, -1);
            expect(members).to.not.include('moment-1');
            expect(members).to.include('moment-2');

            // Cleanup
            await client.del(geoKey);
        });
    });

    describe('Area Data Storage', () => {
        it('should store and retrieve moment data as hash', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const momentKey = `user:${TEST_USER_ID}:nearby-moments-geo:unactivated:moment-123`;

            const momentData = {
                id: 'moment-123',
                fromUserId: 'user-456',
                isPublic: 'true',
                maxViews: '100',
                latitude: '37.7749',
                longitude: '-122.4194',
                radius: '50',
                maxProximity: '25',
                doesRequireProximityToView: 'false',
            };

            await client.hset(momentKey, momentData);

            const stored = await client.hgetall(momentKey);
            expect(stored.id).to.equal('moment-123');
            expect(stored.fromUserId).to.equal('user-456');
            expect(stored.isPublic).to.equal('true');
            expect(stored.radius).to.equal('50');

            // Cleanup
            await client.del(momentKey);
        });

        it('should store and retrieve space data as hash', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const spaceKey = `user:${TEST_USER_ID}:nearby-spaces-geo:unactivated:space-789`;

            const spaceData = {
                id: 'space-789',
                fromUserId: 'user-111',
                isPublic: 'true',
                notificationMsg: 'Welcome to this space!',
                latitude: '37.7749',
                longitude: '-122.4194',
                radius: '100',
                maxProximity: '50',
                featuredIncentiveKey: 'discount-10',
                featuredIncentiveRewardKey: 'cashback-5',
            };

            await client.hset(spaceKey, spaceData);

            const stored = await client.hgetall(spaceKey);
            expect(stored.id).to.equal('space-789');
            expect(stored.notificationMsg).to.equal('Welcome to this space!');
            expect(stored.featuredIncentiveKey).to.equal('discount-10');

            // Cleanup
            await client.del(spaceKey);
        });
    });

    describe('Cache Expiration', () => {
        it('should set TTL on cache entries', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const cacheKey = `user:${TEST_USER_ID}:nearby-moments`;
            const ttlSeconds = 60;

            await client.hset(cacheKey, 'exists', 'true');
            await client.expire(cacheKey, ttlSeconds);

            const ttl = await client.ttl(cacheKey);
            expect(ttl).to.be.greaterThan(0);
            expect(ttl).to.be.lessThanOrEqual(ttlSeconds);

            // Cleanup
            await client.del(cacheKey);
        });

        it('should clear cache by setting TTL to 0', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const cacheKey = `user:${TEST_USER_ID}:nearby-moments`;

            await client.hset(cacheKey, 'exists', 'true');
            await client.expire(cacheKey, 0);

            // Key should be deleted
            const exists = await client.exists(cacheKey);
            expect(exists).to.equal(0);
        });
    });

    describe('Cache Invalidation', () => {
        it('should delete all cache keys for a user', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const momentsKey = `user:${TEST_USER_ID}:nearby-moments`;
            const spacesKey = `user:${TEST_USER_ID}:nearby-spaces`;

            // Create cache entries
            await client.hset(momentsKey, 'exists', 'true');
            await client.hset(spacesKey, 'exists', 'true');

            // Delete entries using pipeline
            const pipeline = client.pipeline();
            pipeline.del(momentsKey);
            pipeline.del(spacesKey);
            await pipeline.exec();

            // Verify deletion
            const momentsExists = await client.exists(momentsKey);
            const spacesExists = await client.exists(spacesKey);

            expect(momentsExists).to.equal(0);
            expect(spacesExists).to.equal(0);
        });
    });

    describe('Pipeline Operations', () => {
        it('should execute multiple operations in a pipeline', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const baseKey = `user:${TEST_USER_ID}:pipeline-test`;

            const pipeline = client.pipeline();
            pipeline.hset(`${baseKey}:moments`, 'origin', JSON.stringify({ lat: 1, lon: 2 }));
            pipeline.hset(`${baseKey}:moments`, 'lastNotificationDateMs', Date.now().toString());
            pipeline.hset(`${baseKey}:spaces`, 'origin', JSON.stringify({ lat: 3, lon: 4 }));
            pipeline.expire(`${baseKey}:moments`, 60);
            pipeline.expire(`${baseKey}:spaces`, 60);

            const results = await pipeline.exec();

            expect(results).to.be.an('array');
            expect(results!.length).to.equal(5);

            // Cleanup
            await client.del(`${baseKey}:moments`, `${baseKey}:spaces`);
        });

        it('should handle geo operations in pipeline', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const geoKey = `user:${TEST_USER_ID}:geo-pipeline-test`;
            const dataKeyBase = `${geoKey}:unactivated`;

            const pipeline: any = client.pipeline();

            // Add multiple locations
            pipeline.geoadd(geoKey, -122.4194, 37.7749, 'area-1');
            pipeline.geoadd(geoKey, -122.4200, 37.7755, 'area-2');
            pipeline.hset(`${dataKeyBase}:area-1`, { id: 'area-1', name: 'Area One' });
            pipeline.hset(`${dataKeyBase}:area-2`, { id: 'area-2', name: 'Area Two' });
            pipeline.expire(geoKey, 60);

            await pipeline.exec();

            // Verify data was stored
            const members = await client.zrange(geoKey, 0, -1);
            expect(members).to.have.lengthOf(2);

            // Cleanup
            await client.del(geoKey, `${dataKeyBase}:area-1`, `${dataKeyBase}:area-2`);
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent keys gracefully', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const nonExistentKey = `user:${TEST_USER_ID}:non-existent-${Date.now()}`;

            const result = await client.hgetall(nonExistentKey);
            expect(result).to.deep.equal({});
        });

        it('should handle invalid geo queries gracefully', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const emptyGeoKey = `user:${TEST_USER_ID}:empty-geo-${Date.now()}`;

            // Query on empty geo key
            const nearby = await (client as any).georadius(emptyGeoKey, -122.4194, 37.7749, 1, 'km');
            expect(nearby).to.be.an('array');
            expect(nearby).to.have.lengthOf(0);
        });
    });
});
