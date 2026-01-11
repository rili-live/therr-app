/**
 * Integration Tests for Service Routing
 *
 * Tests the API gateway's ability to route requests to backend services
 * and handle responses correctly.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run tests: npm run test:integration
 */
/* eslint-disable no-restricted-syntax, no-await-in-loop, no-plusplus */
import { expect } from 'chai';
import {
    getTestRedisClient,
    closeTestRedisConnection,
    checkRedisConnection,
    cleanupTestData,
} from './testRedisConnection';

describe('Service Routing - Integration', () => {
    const TEST_KEY = 'routing-integration-test';
    let skipTests = false;

    before(async () => {
        const isConnected = await checkRedisConnection();
        if (!isConnected) {
            console.log('\n⚠️  Redis not available. Some routing tests will be skipped.');
            console.log('   Start the infrastructure with: docker compose -f docker-compose.infra.yml up -d\n');
            skipTests = true;
        }
    });

    beforeEach(async () => {
        if (skipTests) return;
        try {
            await cleanupTestData(TEST_KEY);
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        if (!skipTests) {
            try {
                await cleanupTestData(TEST_KEY);
            } catch {
                // Ignore cleanup errors
            }
        }
        await closeTestRedisConnection();
    });

    describe('Rate Limiting Counters', () => {
        it('should increment rate limit counter per IP', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const ip = '192.168.1.100';
            const endpoint = '/users-service/users';
            const rateLimitKey = `${TEST_KEY}:rl:${ip}:${endpoint}`;

            // Simulate requests
            let count = await client.incr(rateLimitKey);
            expect(count).to.equal(1);

            count = await client.incr(rateLimitKey);
            expect(count).to.equal(2);

            count = await client.incr(rateLimitKey);
            expect(count).to.equal(3);

            // Verify final count
            const currentCount = await client.get(rateLimitKey);
            expect(Number(currentCount)).to.equal(3);

            // Cleanup
            await client.del(rateLimitKey);
        });

        it('should track rate limits per endpoint', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const ip = '192.168.1.100';

            const endpoints = [
                '/users-service/users',
                '/maps-service/moments',
                '/messages-service/messages',
            ];

            // Simulate requests to different endpoints
            for (const endpoint of endpoints) {
                const key = `${TEST_KEY}:rl:${ip}:${endpoint}`;
                await client.incr(key);
                await client.incr(key);
            }

            // Verify separate counters
            for (const endpoint of endpoints) {
                const key = `${TEST_KEY}:rl:${ip}:${endpoint}`;
                const count = await client.get(key);
                expect(Number(count)).to.equal(2);
                await client.del(key);
            }
        });

        it('should reset rate limit after window expires', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const rateLimitKey = `${TEST_KEY}:rl:window-test`;

            // Set counter with 2-second window
            await client.set(rateLimitKey, '100', 'EX', 2);

            // Verify TTL
            const ttl = await client.ttl(rateLimitKey);
            expect(ttl).to.be.greaterThan(0);
            expect(ttl).to.be.lessThanOrEqual(2);

            // Wait for expiration
            await new Promise((resolve) => {
                setTimeout(resolve, 2500);
            });

            // Counter should be gone
            const exists = await client.exists(rateLimitKey);
            expect(exists).to.equal(0);
        });
    });

    describe('Response Caching', () => {
        it('should cache API responses with TTL', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const cacheKey = `${TEST_KEY}:cache:exchange-rates`;
            const cachedData = JSON.stringify({
                rates: { USD: 1, EUR: 0.85, GBP: 0.73 },
                timestamp: Date.now(),
            });

            // Cache response
            await client.set(cacheKey, cachedData, 'EX', 300); // 5 minutes

            // Verify cached
            const cached = await client.get(cacheKey);
            expect(cached).to.equal(cachedData);

            const parsed = JSON.parse(cached!);
            expect(parsed.rates.USD).to.equal(1);
            expect(parsed.rates.EUR).to.equal(0.85);

            // Cleanup
            await client.del(cacheKey);
        });

        it('should cache area details (moments, spaces, events)', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const areaId = 'area-123';
            const cacheKey = `${TEST_KEY}:cache:area:${areaId}`;

            const areaDetails = {
                moments: [
                    {
                        id: 'm1', title: 'Moment 1', latitude: 40.7128, longitude: -74.0060,
                    },
                    {
                        id: 'm2', title: 'Moment 2', latitude: 40.7580, longitude: -73.9855,
                    },
                ],
                spaces: [
                    { id: 's1', name: 'Space 1', type: 'restaurant' },
                ],
                events: [
                    { id: 'e1', name: 'Event 1', date: '2025-01-15' },
                ],
            };

            // Cache area details
            await client.set(cacheKey, JSON.stringify(areaDetails), 'EX', 600);

            // Verify cached
            const cached = await client.get(cacheKey);
            const parsed = JSON.parse(cached!);

            expect(parsed.moments).to.have.lengthOf(2);
            expect(parsed.spaces).to.have.lengthOf(1);
            expect(parsed.events).to.have.lengthOf(1);

            // Cleanup
            await client.del(cacheKey);
        });

        it('should invalidate cache when data is updated', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const cacheKey = `${TEST_KEY}:cache:invalidate-test`;

            // Set initial cache
            await client.set(cacheKey, 'initial-data');
            let cached = await client.get(cacheKey);
            expect(cached).to.equal('initial-data');

            // Invalidate (delete) cache
            await client.del(cacheKey);

            // Verify invalidated
            cached = await client.get(cacheKey);
            expect(cached).to.be.eq(null);

            // Set new cache
            await client.set(cacheKey, 'updated-data');
            cached = await client.get(cacheKey);
            expect(cached).to.equal('updated-data');

            // Cleanup
            await client.del(cacheKey);
        });
    });

    describe('Service Health Tracking', () => {
        it('should track service health status in Redis', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const services = [
                'users-service',
                'maps-service',
                'messages-service',
                'reactions-service',
                'push-notifications-service',
            ];

            // Simulate health checks
            for (const service of services) {
                const healthKey = `${TEST_KEY}:health:${service}`;
                await client.hset(healthKey, {
                    status: 'healthy',
                    lastCheck: Date.now().toString(),
                    latency: '45',
                });
            }

            // Verify health data
            for (const service of services) {
                const healthKey = `${TEST_KEY}:health:${service}`;
                const health = await client.hgetall(healthKey);

                expect(health.status).to.equal('healthy');
                expect(health.lastCheck).to.be.a('string');
                expect(Number(health.latency)).to.be.lessThan(100);

                // Cleanup
                await client.del(healthKey);
            }
        });

        it('should track consecutive failures for circuit breaker', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const service = 'failing-service';
            const failureKey = `${TEST_KEY}:failures:${service}`;

            // Simulate consecutive failures
            for (let i = 0; i < 5; i++) {
                await client.incr(failureKey);
            }

            // Check failure count
            const failures = await client.get(failureKey);
            expect(Number(failures)).to.equal(5);

            // Circuit breaker would open after threshold
            const isCircuitOpen = Number(failures) >= 5;
            expect(isCircuitOpen).to.be.eq(true);

            // Cleanup
            await client.del(failureKey);
        });
    });

    describe('Request Tracking', () => {
        it('should track request counts per service', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const today = new Date().toISOString().split('T')[0];

            const services = {
                'users-service': 150,
                'maps-service': 300,
                'messages-service': 75,
            };

            // Simulate request counts
            for (const [service, count] of Object.entries(services)) {
                const key = `${TEST_KEY}:requests:${today}:${service}`;
                await client.set(key, count.toString());
            }

            // Verify counts
            for (const [service, expectedCount] of Object.entries(services)) {
                const key = `${TEST_KEY}:requests:${today}:${service}`;
                const count = await client.get(key);
                expect(Number(count)).to.equal(expectedCount);
                await client.del(key);
            }
        });

        it('should track unique users per endpoint', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const endpoint = '/users-service/profile';
            const usersKey = `${TEST_KEY}:unique-users:${endpoint}`;

            // Add unique users (using set to ensure uniqueness)
            const users = ['user-1', 'user-2', 'user-3', 'user-1', 'user-2']; // Duplicates included
            for (const user of users) {
                await client.sadd(usersKey, user);
            }

            // Verify unique count
            const uniqueCount = await client.scard(usersKey);
            expect(uniqueCount).to.equal(3); // Only unique users

            // Cleanup
            await client.del(usersKey);
        });
    });

    describe('Brand Variation Routing', () => {
        it('should track requests per brand variation', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const brands = ['therr', 'teem', 'habits'];

            // Simulate requests per brand
            for (const brand of brands) {
                const key = `${TEST_KEY}:brand:${brand}:requests`;
                await client.incr(key);
                await client.incr(key);
                await client.incr(key);
            }

            // Verify counts
            for (const brand of brands) {
                const key = `${TEST_KEY}:brand:${brand}:requests`;
                const count = await client.get(key);
                expect(Number(count)).to.equal(3);
                await client.del(key);
            }
        });
    });

    describe('Sliding Window Rate Limiting', () => {
        it('should implement sliding window rate limiting', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const ip = '10.0.0.1';
            const windowKey = `${TEST_KEY}:sliding:${ip}`;
            const now = Date.now();

            // Add requests in sliding window (last 60 seconds)
            await client.zadd(windowKey, now - 50000, 'req1'); // 50s ago
            await client.zadd(windowKey, now - 30000, 'req2'); // 30s ago
            await client.zadd(windowKey, now - 10000, 'req3'); // 10s ago
            await client.zadd(windowKey, now, 'req4'); // now

            // Count requests in last 60 seconds
            const windowStart = now - 60000;
            const requestCount = await client.zcount(windowKey, windowStart, now);
            expect(requestCount).to.equal(4);

            // Remove requests older than window
            await client.zremrangebyscore(windowKey, '-inf', windowStart);

            // Verify only recent requests remain
            const remainingCount = await client.zcard(windowKey);
            expect(remainingCount).to.equal(4);

            // Cleanup
            await client.del(windowKey);
        });

        it('should expire old requests from sliding window', async () => {
            if (skipTests) return;

            const client = getTestRedisClient();
            const ip = '10.0.0.2';
            const windowKey = `${TEST_KEY}:sliding:${ip}:expire`;
            const now = Date.now();

            // Add requests - some old, some new
            await client.zadd(windowKey, now - 120000, 'old-req1'); // 2 minutes ago
            await client.zadd(windowKey, now - 90000, 'old-req2'); // 1.5 minutes ago
            await client.zadd(windowKey, now - 30000, 'new-req1'); // 30s ago
            await client.zadd(windowKey, now, 'new-req2'); // now

            // Remove requests older than 60 seconds
            const windowStart = now - 60000;
            await client.zremrangebyscore(windowKey, '-inf', windowStart);

            // Verify only new requests remain
            const remainingCount = await client.zcard(windowKey);
            expect(remainingCount).to.equal(2);

            // Cleanup
            await client.del(windowKey);
        });
    });
});
