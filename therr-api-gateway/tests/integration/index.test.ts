/**
 * Integration Tests for API Gateway
 *
 * These tests connect to a real Redis instance to verify
 * that caching and rate limiting works correctly.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import {
    getTestRedisClient,
    getTestRedisEphemeralClient,
    closeTestRedisConnection,
    checkRedisConnection,
    cleanupTestData,
} from './testRedisConnection';

describe('Integration Tests', () => {
    const TEST_KEY = 'integration-test';
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
            await cleanupTestData(TEST_KEY);
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Only clean up if tests weren't skipped (Redis was available)
        if (!skipTests) {
            try {
                await cleanupTestData(TEST_KEY);
            } catch {
                // Ignore cleanup errors
            }
        }
        // Close Redis connections
        await closeTestRedisConnection();
    });

    describe('Redis Connection - Integration', () => {
        it('should connect to Redis and respond to ping', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const result = await client.ping();

            expect(result).to.equal('PONG');
        });

        it('should connect to ephemeral Redis', async () => {
            if (skipTests) return;

            const ephemeralClient = getTestRedisEphemeralClient();
            await ephemeralClient.connect();
            const result = await ephemeralClient.ping();

            expect(result).to.equal('PONG');
        });
    });

    describe('Rate Limiting - Integration', () => {
        it('should implement rate limiting counter', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const rateLimitKey = `${TEST_KEY}:rl:127.0.0.1:/api/test`;

            // Simulate rate limit tracking
            let count = await client.incr(rateLimitKey);
            expect(count).to.equal(1);

            count = await client.incr(rateLimitKey);
            expect(count).to.equal(2);

            count = await client.incr(rateLimitKey);
            expect(count).to.equal(3);

            // Verify count
            const currentCount = await client.get(rateLimitKey);
            expect(Number(currentCount)).to.equal(3);

            // Cleanup
            await client.del(rateLimitKey);
        });

        it('should expire rate limit keys automatically', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const rateLimitKey = `${TEST_KEY}:rl:expire-test`;

            // Set counter with 60 second TTL
            await client.set(rateLimitKey, '1', 'EX', 60);

            // Verify TTL was set
            const ttl = await client.ttl(rateLimitKey);
            expect(ttl).to.be.greaterThan(0);
            expect(ttl).to.be.lessThanOrEqual(60);

            // Cleanup
            await client.del(rateLimitKey);
        });

        it('should track requests per IP using sliding window', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const windowKey = `${TEST_KEY}:sliding:127.0.0.1`;
            const now = Date.now();

            // Add timestamps for requests in the sliding window
            await client.zadd(windowKey, now - 1000, 'req1');
            await client.zadd(windowKey, now - 500, 'req2');
            await client.zadd(windowKey, now, 'req3');

            // Count requests in last 2 seconds
            const windowStart = now - 2000;
            const requestCount = await client.zcount(windowKey, windowStart, now);

            expect(requestCount).to.equal(3);

            // Remove old requests (outside 2 second window)
            await client.zremrangebyscore(windowKey, '-inf', windowStart);

            // Cleanup
            await client.del(windowKey);
        });
    });

    describe('Session/Token Caching - Integration', () => {
        it('should cache and retrieve token data', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const tokenKey = `${TEST_KEY}:token:abc123`;
            const tokenData = JSON.stringify({
                userId: 'user-123',
                email: 'test@example.com',
                accessLevels: ['user.default'],
                createdAt: Date.now(),
            });

            // Cache token with TTL
            await client.set(tokenKey, tokenData, 'EX', 3600); // 1 hour

            // Retrieve cached token
            const cachedToken = await client.get(tokenKey);
            expect(cachedToken).to.equal(tokenData);

            const parsed = JSON.parse(cachedToken!);
            expect(parsed.userId).to.equal('user-123');
            expect(parsed.email).to.equal('test@example.com');

            // Cleanup
            await client.del(tokenKey);
        });

        it('should invalidate cached tokens', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const tokenKey = `${TEST_KEY}:token:invalidate`;

            // Cache token
            await client.set(tokenKey, 'token-data');

            // Verify it exists
            let exists = await client.exists(tokenKey);
            expect(exists).to.equal(1);

            // Invalidate (delete) the token
            await client.del(tokenKey);

            // Verify it's gone
            exists = await client.exists(tokenKey);
            expect(exists).to.equal(0);
        });
    });

    describe('Ephemeral Cache - Integration', () => {
        it('should store short-lived cache entries', async () => {
            if (skipTests) return;

            const ephemeralClient = getTestRedisEphemeralClient();
            const cacheKey = `${TEST_KEY}:ephemeral:short-lived`;
            const cacheData = 'temporary-value';

            // Store with short TTL
            await ephemeralClient.set(cacheKey, cacheData, 'EX', 10);

            // Retrieve
            const cached = await ephemeralClient.get(cacheKey);
            expect(cached).to.equal(cacheData);

            // Verify TTL
            const ttl = await ephemeralClient.ttl(cacheKey);
            expect(ttl).to.be.greaterThan(0);
            expect(ttl).to.be.lessThanOrEqual(10);

            // Cleanup
            await ephemeralClient.del(cacheKey);
        });
    });
});
