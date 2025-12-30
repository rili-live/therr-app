/**
 * Integration Tests for WebSocket Service
 *
 * These tests connect to a real Redis instance to verify
 * that the pub/sub and session management layer works correctly.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import {
    getTestRedisPub,
    getTestRedisSub,
    closeTestRedisConnection,
    checkRedisConnection,
    cleanupTestData,
} from './testRedisConnection';

describe('Integration Tests', () => {
    const TEST_USER_ID = 'integration-test-user-id';
    const TEST_SOCKET_ID = 'integration-test-socket-id';
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
            await cleanupTestData(`session:${TEST_SOCKET_ID}`);
            await cleanupTestData(`user:${TEST_USER_ID}`);
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test data
        try {
            await cleanupTestData(`session:${TEST_SOCKET_ID}`);
            await cleanupTestData(`user:${TEST_USER_ID}`);
        } catch {
            // Ignore cleanup errors
        }
        // Close Redis connections
        await closeTestRedisConnection();
    });

    describe('Redis Pub/Sub - Integration', () => {
        it('should connect to Redis and respond to ping', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const result = await pub.ping();

            expect(result).to.equal('PONG');
        });

        it('should store and retrieve session data', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const sessionKey = `session:${TEST_SOCKET_ID}`;
            const sessionData = {
                id: TEST_USER_ID,
                socketId: TEST_SOCKET_ID,
                status: 'active',
                app: 'therr-mobile',
                ip: '127.0.0.1',
            };

            // Store session as hash
            await pub.hset(sessionKey, sessionData);

            // Retrieve session
            const retrievedSession = await pub.hgetall(sessionKey);

            expect(retrievedSession).to.deep.equal(sessionData);

            // Cleanup
            await pub.del(sessionKey);
        });

        it('should handle session expiration with TTL', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const sessionKey = `session:${TEST_SOCKET_ID}:ttl`;
            const sessionData = {
                id: TEST_USER_ID,
                status: 'active',
            };

            // Store session with TTL
            await pub.hset(sessionKey, sessionData);
            await pub.expire(sessionKey, 60); // 60 second TTL

            // Verify TTL was set
            const ttl = await pub.ttl(sessionKey);
            expect(ttl).to.be.greaterThan(0);
            expect(ttl).to.be.lessThanOrEqual(60);

            // Cleanup
            await pub.del(sessionKey);
        });

        it('should map user ID to socket ID', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const userSocketKey = `user:${TEST_USER_ID}:socket`;

            // Store user-to-socket mapping
            await pub.set(userSocketKey, TEST_SOCKET_ID);

            // Retrieve socket ID by user ID
            const socketId = await pub.get(userSocketKey);

            expect(socketId).to.equal(TEST_SOCKET_ID);

            // Cleanup
            await pub.del(userSocketKey);
        });

        it('should publish and subscribe to channels', async function testPubSub(this: Mocha.Context) {
            if (skipTests) return;
            this.timeout(5000); // Increase timeout for pub/sub test

            const pub = getTestRedisPub();
            const sub = getTestRedisSub();

            const channelName = `test:channel:${TEST_USER_ID}`;
            const testMessage = JSON.stringify({ type: 'test', data: 'hello' });

            return new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Pub/Sub test timed out'));
                }, 4000);

                // Subscribe to channel
                sub.subscribe(channelName, (err) => {
                    if (err) {
                        clearTimeout(timeout);
                        reject(err);
                        return;
                    }

                    // Publish message after subscription is confirmed
                    setTimeout(() => {
                        pub.publish(channelName, testMessage);
                    }, 100);
                });

                // Handle incoming messages
                sub.on('message', (channel, message) => {
                    if (channel === channelName) {
                        clearTimeout(timeout);
                        try {
                            expect(message).to.equal(testMessage);
                            sub.unsubscribe(channelName);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    }
                });
            });
        });

        it('should track multiple socket connections per user', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const userSocketsKey = `user:${TEST_USER_ID}:sockets`;
            const socketIds = ['socket-1', 'socket-2', 'socket-3'];

            // Add multiple socket IDs for same user
            await pub.sadd(userSocketsKey, ...socketIds);

            // Get all socket IDs for user
            const retrievedSockets = await pub.smembers(userSocketsKey);

            expect(retrievedSockets).to.have.members(socketIds);
            expect(retrievedSockets.length).to.equal(3);

            // Remove one socket
            await pub.srem(userSocketsKey, 'socket-2');
            const remainingSockets = await pub.smembers(userSocketsKey);

            expect(remainingSockets.length).to.equal(2);
            expect(remainingSockets).to.not.include('socket-2');

            // Cleanup
            await pub.del(userSocketsKey);
        });
    });
});
