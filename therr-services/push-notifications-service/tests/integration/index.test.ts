/**
 * Integration Tests for Push Notifications Service
 *
 * These tests connect to a real Redis instance to verify
 * that the caching layer works correctly.
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

describe('Integration Tests', () => {
    const TEST_USER_ID = 'integration-test-user-id';
    let skipTests = false;

    before(async () => {
        // Check if Redis is available
        const isConnected = await checkRedisConnection();
        if (!isConnected) {
            console.log('\n⚠️  Redis not available. Skipping integration tests.');
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

    describe('Redis Connection - Integration', () => {
        it('should connect to Redis and respond to ping', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const result = await client.ping();

            expect(result).to.equal('PONG');
        });

        it('should set and get a simple string value', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const testKey = `user:${TEST_USER_ID}:test-string`;
            const testValue = 'integration-test-value';

            await client.set(testKey, testValue);
            const result = await client.get(testKey);

            expect(result).to.equal(testValue);

            // Cleanup
            await client.del(testKey);
        });

        it('should set and get hash values', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const testKey = `user:${TEST_USER_ID}:test-hash`;
            const testData = {
                origin: JSON.stringify({ longitude: -122.4194, latitude: 37.7749 }),
                lastNotificationDateMs: Date.now().toString(),
            };

            await client.hset(testKey, testData);
            const origin = await client.hget(testKey, 'origin');

            expect(origin).to.equal(testData.origin);

            const parsedOrigin = JSON.parse(origin!);
            expect(parsedOrigin.longitude).to.equal(-122.4194);
            expect(parsedOrigin.latitude).to.equal(37.7749);

            // Cleanup
            await client.del(testKey);
        });

        it('should handle TTL (expiration)', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const testKey = `user:${TEST_USER_ID}:test-ttl`;
            const testValue = 'expires-soon';

            // Set with 60 second TTL
            await client.set(testKey, testValue, 'EX', 60);

            // Verify TTL was set
            const ttl = await client.ttl(testKey);
            expect(ttl).to.be.greaterThan(0);
            expect(ttl).to.be.lessThanOrEqual(60);

            // Cleanup
            await client.del(testKey);
        });

        it('should use geo commands for location-based caching', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const testKey = `user:${TEST_USER_ID}:test-geo`;

            // Add locations (San Francisco, Los Angeles, Seattle)
            await client.geoadd(testKey, -122.4194, 37.7749, 'san-francisco');
            await client.geoadd(testKey, -118.2437, 34.0522, 'los-angeles');
            await client.geoadd(testKey, -122.3321, 47.6062, 'seattle');

            // Find locations within 1000km of San Francisco
            const nearby = await (client as any).georadius(testKey, -122.4194, 37.7749, 1000, 'km');

            expect(nearby).to.be.an('array');
            expect(nearby).to.include('san-francisco');
            expect(nearby).to.include('los-angeles');
            // Seattle is ~1094km away, so it might not be included

            // Cleanup
            await client.del(testKey);
        });

        it('should handle pipeline operations', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const testKeyBase = `user:${TEST_USER_ID}:test-pipeline`;

            // Execute multiple commands in a pipeline
            const pipeline = client.pipeline();
            pipeline.set(`${testKeyBase}:1`, 'value1');
            pipeline.set(`${testKeyBase}:2`, 'value2');
            pipeline.set(`${testKeyBase}:3`, 'value3');
            pipeline.get(`${testKeyBase}:1`);
            pipeline.get(`${testKeyBase}:2`);

            const results = await pipeline.exec();

            expect(results).to.be.an('array');
            expect(results!.length).to.equal(5);
            // Last two results should be the GET values
            expect(results![3][1]).to.equal('value1');
            expect(results![4][1]).to.equal('value2');

            // Cleanup
            await client.del(`${testKeyBase}:1`, `${testKeyBase}:2`, `${testKeyBase}:3`);
        });
    });
});
