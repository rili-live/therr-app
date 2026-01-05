/**
 * Integration Tests for Redis Session Management
 *
 * These tests verify that the Redis session management layer works correctly.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import {
    getTestRedisPub,
    closeTestRedisConnection,
    checkRedisConnection,
    cleanupTestData,
} from './testRedisConnection';

describe('Redis Session Management - Integration', () => {
    const TEST_USER_ID = 'session-test-user-id';
    const TEST_SOCKET_ID = 'session-test-socket-id';
    const TEST_USER_ID_2 = 'session-test-user-id-2';
    const TEST_SOCKET_ID_2 = 'session-test-socket-id-2';
    let skipTests = false;

    before(async () => {
        const isConnected = await checkRedisConnection();
        if (!isConnected) {
            console.log('\n⚠️  Redis not available. Skipping Redis session integration tests.');
            console.log('   Start the infrastructure with: docker compose -f docker-compose.infra.yml up -d\n');
            skipTests = true;
        }
    });

    beforeEach(async () => {
        if (skipTests) return;
        try {
            await cleanupTestData(`userSockets:${TEST_SOCKET_ID}`);
            await cleanupTestData(`users:${TEST_USER_ID}`);
            await cleanupTestData(`userSockets:${TEST_SOCKET_ID_2}`);
            await cleanupTestData(`users:${TEST_USER_ID_2}`);
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        try {
            await cleanupTestData(`userSockets:${TEST_SOCKET_ID}`);
            await cleanupTestData(`users:${TEST_USER_ID}`);
            await cleanupTestData(`userSockets:${TEST_SOCKET_ID_2}`);
            await cleanupTestData(`users:${TEST_USER_ID_2}`);
        } catch {
            // Ignore cleanup errors
        }
        await closeTestRedisConnection();
    });

    describe('User Session Storage', () => {
        it('should store user session data in Redis', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const userData = {
                id: TEST_USER_ID,
                socketId: TEST_SOCKET_ID,
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                status: 'active',
            };

            // Store user data as JSON string
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(userData));

            // Retrieve and verify
            const storedData = await pub.get(`users:${TEST_USER_ID}`);
            const parsedData = JSON.parse(storedData as string);

            expect(parsedData.id).to.equal(TEST_USER_ID);
            expect(parsedData.socketId).to.equal(TEST_SOCKET_ID);
            expect(parsedData.userName).to.equal('testuser');
            expect(parsedData.status).to.equal('active');
        });

        it('should store socket-to-user mapping', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();

            // Store socket-to-user mapping
            await pub.setex(`userSockets:${TEST_SOCKET_ID}`, 1800, TEST_USER_ID);

            // Retrieve and verify
            const userId = await pub.get(`userSockets:${TEST_SOCKET_ID}`);
            expect(userId).to.equal(TEST_USER_ID);
        });

        it('should support looking up user by socket ID', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const userData = {
                id: TEST_USER_ID,
                socketId: TEST_SOCKET_ID,
                userName: 'testuser',
            };

            // Store both mappings
            await pub.setex(`userSockets:${TEST_SOCKET_ID}`, 1800, TEST_USER_ID);
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(userData));

            // Lookup by socket ID
            const userId = await pub.get(`userSockets:${TEST_SOCKET_ID}`);
            const userDataStr = await pub.get(`users:${userId}`);
            const user = JSON.parse(userDataStr as string);

            expect(user.id).to.equal(TEST_USER_ID);
            expect(user.socketId).to.equal(TEST_SOCKET_ID);
        });
    });

    describe('Session TTL Management', () => {
        it('should set 30 minute TTL on session data', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const ttl = 1800; // 30 minutes in seconds

            await pub.setex(`users:${TEST_USER_ID}`, ttl, JSON.stringify({ id: TEST_USER_ID }));

            const actualTtl = await pub.ttl(`users:${TEST_USER_ID}`);
            expect(actualTtl).to.be.greaterThan(1790);
            expect(actualTtl).to.be.lessThanOrEqual(1800);
        });

        it('should allow refreshing TTL on session update', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();

            // Create session with short TTL
            await pub.setex(`users:${TEST_USER_ID}`, 60, JSON.stringify({ id: TEST_USER_ID }));

            // Wait a bit
            await new Promise((resolve) => { setTimeout(resolve, 100); });

            // Refresh with new TTL
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify({ id: TEST_USER_ID }));

            const ttl = await pub.ttl(`users:${TEST_USER_ID}`);
            expect(ttl).to.be.greaterThan(1790);
        });
    });

    describe('Session Update on Page Refresh', () => {
        it('should update socket ID while preserving user data', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const oldSocketId = TEST_SOCKET_ID;
            const newSocketId = `${TEST_SOCKET_ID}-new`;

            // Initial session
            const userData = {
                id: TEST_USER_ID,
                socketId: oldSocketId,
                userName: 'testuser',
                firstName: 'Test',
                lastName: 'User',
            };

            await pub.setex(`userSockets:${oldSocketId}`, 1800, TEST_USER_ID);
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(userData));

            // Simulate page refresh - update socket ID
            await pub.del(`userSockets:${oldSocketId}`);
            await pub.setex(`userSockets:${newSocketId}`, 1800, TEST_USER_ID);

            const updatedUserData = {
                ...userData,
                socketId: newSocketId,
                previousSocketId: oldSocketId,
            };
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(updatedUserData));

            // Verify old socket mapping removed
            const oldMapping = await pub.get(`userSockets:${oldSocketId}`);
            expect(oldMapping).to.be.eq(null);

            // Verify new socket mapping exists
            const newMapping = await pub.get(`userSockets:${newSocketId}`);
            expect(newMapping).to.equal(TEST_USER_ID);

            // Verify user data has new socket ID
            const storedUserData = await pub.get(`users:${TEST_USER_ID}`);
            const user = JSON.parse(storedUserData as string);
            expect(user.socketId).to.equal(newSocketId);
            expect(user.previousSocketId).to.equal(oldSocketId);

            // Cleanup
            await pub.del(`userSockets:${newSocketId}`);
        });
    });

    describe('Session Removal', () => {
        it('should remove both user and socket mappings on logout', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();

            // Create session
            await pub.setex(`userSockets:${TEST_SOCKET_ID}`, 1800, TEST_USER_ID);
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify({ id: TEST_USER_ID }));

            // Remove session (simulating logout)
            await pub.del(`userSockets:${TEST_SOCKET_ID}`);
            await pub.del(`users:${TEST_USER_ID}`);

            // Verify removal
            const socketMapping = await pub.get(`userSockets:${TEST_SOCKET_ID}`);
            const userData = await pub.get(`users:${TEST_USER_ID}`);

            expect(socketMapping).to.be.eq(null);
            expect(userData).to.be.eq(null);
        });
    });

    describe('User Status Updates', () => {
        it('should update user status to AWAY', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const userData = {
                id: TEST_USER_ID,
                socketId: TEST_SOCKET_ID,
                status: 'active',
            };

            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(userData));

            // Update status to away
            const updatedUserData = { ...userData, status: 'away' };
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(updatedUserData));

            const storedData = await pub.get(`users:${TEST_USER_ID}`);
            const user = JSON.parse(storedData as string);

            expect(user.status).to.equal('away');
        });

        it('should update user status to ACTIVE', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const userData = {
                id: TEST_USER_ID,
                socketId: TEST_SOCKET_ID,
                status: 'away',
            };

            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(userData));

            // Update status to active
            const updatedUserData = { ...userData, status: 'active' };
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(updatedUserData));

            const storedData = await pub.get(`users:${TEST_USER_ID}`);
            const user = JSON.parse(storedData as string);

            expect(user.status).to.equal('active');
        });
    });

    describe('Batch User Lookup', () => {
        it('should retrieve multiple users by ID using pipeline', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();

            // Store multiple users
            const user1 = { id: TEST_USER_ID, socketId: TEST_SOCKET_ID, userName: 'user1' };
            const user2 = { id: TEST_USER_ID_2, socketId: TEST_SOCKET_ID_2, userName: 'user2' };

            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(user1));
            await pub.setex(`users:${TEST_USER_ID_2}`, 1800, JSON.stringify(user2));

            // Batch retrieve using pipeline
            const pipeline = pub.pipeline();
            pipeline.get(`users:${TEST_USER_ID}`);
            pipeline.get(`users:${TEST_USER_ID_2}`);

            const results = await pipeline.exec();

            expect(results).to.have.lengthOf(2);
            expect(JSON.parse(results![0][1] as string).userName).to.equal('user1');
            expect(JSON.parse(results![1][1] as string).userName).to.equal('user2');
        });

        it('should handle missing users in batch lookup', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();

            // Store only one user
            const user1 = { id: TEST_USER_ID, userName: 'user1' };
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(user1));

            // Try to retrieve both (one exists, one doesn't)
            const pipeline = pub.pipeline();
            pipeline.get(`users:${TEST_USER_ID}`);
            pipeline.get('users:nonexistent-user');

            const results = await pipeline.exec();

            expect(results).to.have.lengthOf(2);
            expect(JSON.parse(results![0][1] as string).userName).to.equal('user1');
            expect(results![1][1]).to.be.eq(null);
        });
    });

    describe('Notification Throttling', () => {
        it('should set DM notification throttle key with 20 minute TTL', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const toUserId = TEST_USER_ID;
            const fromUserId = TEST_USER_ID_2;
            const key = `dmNotificationThrottles:${toUserId}:${fromUserId}`;
            const ttl = 60 * 20; // 20 minutes

            await pub.setex(key, ttl, '1');

            const exists = await pub.get(key);
            const actualTtl = await pub.ttl(key);

            expect(exists).to.equal('1');
            expect(actualTtl).to.be.greaterThan(1190);
            expect(actualTtl).to.be.lessThanOrEqual(1200);

            // Cleanup
            await pub.del(key);
        });

        it('should set reaction notification throttle key with 60 second TTL', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const toUserId = TEST_USER_ID;
            const fromUserId = TEST_USER_ID_2;
            const key = `reactionNotificationThrottles:${toUserId}:${fromUserId}`;
            const ttl = 60; // 60 seconds

            await pub.setex(key, ttl, '1');

            const exists = await pub.get(key);
            const actualTtl = await pub.ttl(key);

            expect(exists).to.equal('1');
            expect(actualTtl).to.be.greaterThan(55);
            expect(actualTtl).to.be.lessThanOrEqual(60);

            // Cleanup
            await pub.del(key);
        });

        it('should return false when throttle key exists', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const key = `dmNotificationThrottles:${TEST_USER_ID}:${TEST_USER_ID_2}`;

            // Set throttle key
            await pub.setex(key, 1200, '1');

            // Check if key exists (should indicate throttled)
            const doesLockExist = await pub.get(key);
            const shouldCreateNotification = !doesLockExist;

            expect(shouldCreateNotification).to.be.eq(false);

            // Cleanup
            await pub.del(key);
        });

        it('should return true when throttle key does not exist', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const key = `dmNotificationThrottles:${TEST_USER_ID}:nonexistent`;

            // Ensure key doesn't exist
            await pub.del(key);

            // Check if key exists
            const doesLockExist = await pub.get(key);
            const shouldCreateNotification = !doesLockExist;

            expect(shouldCreateNotification).to.be.eq(true);
        });
    });

    describe('Online Presence Tracking', () => {
        it('should track user as online when session exists', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();
            const userData = {
                id: TEST_USER_ID,
                socketId: TEST_SOCKET_ID,
                status: 'active',
            };

            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify(userData));

            const storedData = await pub.get(`users:${TEST_USER_ID}`);
            const isOnline = storedData !== null;

            expect(isOnline).to.be.eq(true);
        });

        it('should track user as offline when session does not exist', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();

            // Ensure no session exists
            await pub.del(`users:${TEST_USER_ID}`);

            const storedData = await pub.get(`users:${TEST_USER_ID}`);
            const isOnline = storedData !== null;

            expect(isOnline).to.be.eq(false);
        });

        it('should support checking multiple users presence at once', async () => {
            if (skipTests) return;

            const pub = getTestRedisPub();

            // One user online, one offline
            await pub.setex(`users:${TEST_USER_ID}`, 1800, JSON.stringify({ id: TEST_USER_ID, status: 'active' }));
            await pub.del(`users:${TEST_USER_ID_2}`);

            const pipeline = pub.pipeline();
            pipeline.get(`users:${TEST_USER_ID}`);
            pipeline.get(`users:${TEST_USER_ID_2}`);

            const results = await pipeline.exec();

            const user1Online = results![0][1] !== null;
            const user2Online = results![1][1] !== null;

            expect(user1Online).to.be.eq(true);
            expect(user2Online).to.be.eq(false);
        });
    });
});
