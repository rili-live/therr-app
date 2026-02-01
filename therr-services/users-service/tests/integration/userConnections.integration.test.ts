/**
 * Integration Tests for Users Service - User Connections
 *
 * These tests verify the friend request / connection lifecycle against a real database.
 * Critical for the Habits app pacts feature.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import bcrypt from 'bcrypt';
import { AccessLevels, UserConnectionTypes } from 'therr-js-utilities/constants';
import UsersStore, { ICreateUserParams } from '../../src/store/UsersStore';
import UserConnectionsStore from '../../src/store/UserConnectionsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - User Connections', () => {
    const TEST_EMAIL_PREFIX = 'conn-test-';
    const TEST_EMAIL_DOMAIN = '@example-test.com';
    let usersStore: UsersStore;
    let userConnectionsStore: UserConnectionsStore;
    let skipTests = false;
    let createdUserIds: string[] = [];
    let createdConnectionIds: string[] = [];

    before(async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.');
            console.log('   Start the database with: docker compose -f docker-compose.infra.yml up -d');
            console.log('   Run migrations with: npm run migrations:run\n');
            skipTests = true;
            return;
        }

        const connection = getTestConnection();
        usersStore = new UsersStore(connection);
        userConnectionsStore = new UserConnectionsStore(connection);
    });

    afterEach(async () => {
        if (skipTests) return;

        // Clean up connections first (foreign key constraint)
        await Promise.all(createdConnectionIds.map(async (connId) => {
            try {
                await cleanupTestData('userConnections', { id: connId });
            } catch {
                // Ignore cleanup errors
            }
        }));
        createdConnectionIds = [];

        // Then clean up users
        await Promise.all(createdUserIds.map(async (userId) => {
            try {
                await cleanupTestData('users', { id: userId });
            } catch {
                // Ignore cleanup errors
            }
        }));
        createdUserIds = [];
    });

    after(async () => {
        await closeTestConnection();
    });

    // Helper to create a test user
    const createTestUser = async (suffix: string): Promise<any> => {
        const testEmail = `${TEST_EMAIL_PREFIX}${suffix}${TEST_EMAIL_DOMAIN}`;
        const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

        const testUser: ICreateUserParams = {
            email: testEmail,
            password: hashedPassword,
            firstName: `First${suffix}`,
            lastName: `Last${suffix}`,
            userName: `user${suffix}`,
            hasAgreedToTerms: true,
            accessLevels: JSON.stringify([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]),
            verificationCodes: JSON.stringify({ email: {} }),
        };

        const createdUsers = await usersStore.createUser(testUser);
        createdUserIds.push(createdUsers[0].id);
        return createdUsers[0];
    };

    describe('Connection Request Flow', () => {
        it('should create a pending connection between two users', async () => {
            if (skipTests) return;

            // Create two users
            const user1 = await createTestUser('conn1a');
            const user2 = await createTestUser('conn1b');

            // Create connection request
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.PENDING,
            });

            createdConnectionIds.push(connections[0].id);

            expect(connections).to.be.an('array');
            expect(connections.length).to.equal(1);
            expect(connections[0].requestingUserId).to.equal(user1.id);
            expect(connections[0].acceptingUserId).to.equal(user2.id);
            expect(connections[0].requestStatus).to.equal(UserConnectionTypes.PENDING);
            expect(connections[0].isConnectionBroken).to.equal(false);
        });

        it('should accept a pending connection request', async () => {
            if (skipTests) return;

            // Create two users
            const user1 = await createTestUser('conn2a');
            const user2 = await createTestUser('conn2b');

            // Create pending connection
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.PENDING,
            });
            createdConnectionIds.push(connections[0].id);

            // Accept connection
            const updatedConnections = await userConnectionsStore.updateUserConnection(
                {
                    requestingUserId: user1.id,
                    acceptingUserId: user2.id,
                },
                {
                    requestStatus: UserConnectionTypes.COMPLETE,
                },
            );

            expect(updatedConnections.length).to.equal(1);
            expect(updatedConnections[0].requestStatus).to.equal(UserConnectionTypes.COMPLETE);
        });

        it('should deny a pending connection request', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn3a');
            const user2 = await createTestUser('conn3b');

            // Create pending connection
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.PENDING,
            });
            createdConnectionIds.push(connections[0].id);

            // Deny connection
            const updatedConnections = await userConnectionsStore.updateUserConnection(
                {
                    requestingUserId: user1.id,
                    acceptingUserId: user2.id,
                },
                {
                    requestStatus: UserConnectionTypes.DENIED,
                },
            );

            expect(updatedConnections[0].requestStatus).to.equal(UserConnectionTypes.DENIED);
        });

        it('should block a user connection', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn4a');
            const user2 = await createTestUser('conn4b');

            // Create connection
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.PENDING,
            });
            createdConnectionIds.push(connections[0].id);

            // Block user
            const updatedConnections = await userConnectionsStore.updateUserConnection(
                {
                    requestingUserId: user1.id,
                    acceptingUserId: user2.id,
                },
                {
                    requestStatus: UserConnectionTypes.BLOCKED,
                },
            );

            expect(updatedConnections[0].requestStatus).to.equal(UserConnectionTypes.BLOCKED);
        });
    });

    describe('Connection Retrieval Flow', () => {
        it('should get connection between two specific users', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn5a');
            const user2 = await createTestUser('conn5b');

            // Create connection
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.COMPLETE,
            });
            createdConnectionIds.push(connections[0].id);

            // Get connection (forward direction)
            const foundConnections = await userConnectionsStore.getUserConnections({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
            });

            expect(foundConnections.length).to.equal(1);
            expect(foundConnections[0].requestingUserId).to.equal(user1.id);
        });

        it('should find connection in reverse direction with shouldCheckReverse', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn6a');
            const user2 = await createTestUser('conn6b');

            // Create connection (user1 -> user2)
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.COMPLETE,
            });
            createdConnectionIds.push(connections[0].id);

            // Get connection in reverse (user2 -> user1) with shouldCheckReverse
            const foundConnections = await userConnectionsStore.getUserConnections(
                {
                    requestingUserId: user2.id,
                    acceptingUserId: user1.id,
                },
                true, // shouldCheckReverse
            );

            expect(foundConnections.length).to.equal(1);
        });

        it('should return empty when no connection exists', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn7a');
            const user2 = await createTestUser('conn7b');

            // Don't create any connection
            const foundConnections = await userConnectionsStore.getUserConnections({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
            });

            expect(foundConnections.length).to.equal(0);
        });
    });

    describe('Connection Update Flow', () => {
        it('should increment interaction count', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn8a');
            const user2 = await createTestUser('conn8b');

            // Create connection with initial interaction count
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.COMPLETE,
                interactionCount: 0,
            });
            createdConnectionIds.push(connections[0].id);

            // Increment interaction count
            const updatedConnections = await userConnectionsStore.incrementUserConnection(
                user2.id,
                user1.id,
                5,
            );

            expect(updatedConnections.length).to.equal(1);
            expect(updatedConnections[0].interactionCount).to.be.at.least(5);
        });

        it('should break and restore a connection', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn9a');
            const user2 = await createTestUser('conn9b');

            // Create complete connection
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.COMPLETE,
            });
            createdConnectionIds.push(connections[0].id);

            // Break connection (unfriend)
            const brokenConnections = await userConnectionsStore.updateUserConnection(
                {
                    requestingUserId: user1.id,
                    acceptingUserId: user2.id,
                },
                {
                    isConnectionBroken: true,
                },
            );

            expect(brokenConnections[0].isConnectionBroken).to.be.eq(true);

            // Restore connection (re-friend)
            const restoredConnections = await userConnectionsStore.updateUserConnection(
                {
                    requestingUserId: user1.id,
                    acceptingUserId: user2.id,
                },
                {
                    isConnectionBroken: false,
                    requestStatus: UserConnectionTypes.PENDING,
                },
            );

            expect(restoredConnections[0].isConnectionBroken).to.be.eq(false);
            expect(restoredConnections[0].requestStatus).to.equal(UserConnectionTypes.PENDING);
        });
    });

    describe('Batch Connection Flow', () => {
        it('should create multiple connections at once', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn10a');
            const user2 = await createTestUser('conn10b');
            const user3 = await createTestUser('conn10c');

            // Create multiple connections
            const connections = await userConnectionsStore.createUserConnections(
                user1.id,
                [user2.id, user3.id],
            );

            connections.forEach((conn) => createdConnectionIds.push(conn.id));

            expect(connections.length).to.equal(2);
            expect(connections.every((c) => c.requestingUserId === user1.id)).to.be.eq(true);
            expect(connections.map((c) => c.acceptingUserId)).to.include(user2.id);
            expect(connections.map((c) => c.acceptingUserId)).to.include(user3.id);
        });

        it('should find connections between user and multiple others', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn11a');
            const user2 = await createTestUser('conn11b');
            const user3 = await createTestUser('conn11c');

            // Create connections
            const connections = await userConnectionsStore.createUserConnections(
                user1.id,
                [user2.id, user3.id],
            );
            connections.forEach((conn) => createdConnectionIds.push(conn.id));

            // Find connections
            const foundConnections = await userConnectionsStore.findUserConnections(
                user1.id,
                [user2.id, user3.id],
            );

            expect(foundConnections.length).to.equal(2);
        });
    });

    describe('Connection Count Flow', () => {
        it('should count user connections', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn12a');
            const user2 = await createTestUser('conn12b');
            const user3 = await createTestUser('conn12c');

            // Create connections
            const connections = await userConnectionsStore.createUserConnections(
                user1.id,
                [user2.id, user3.id],
            );
            connections.forEach((conn) => createdConnectionIds.push(conn.id));

            // Accept connections
            await userConnectionsStore.updateUserConnection(
                { requestingUserId: user1.id, acceptingUserId: user2.id },
                { requestStatus: UserConnectionTypes.COMPLETE },
            );
            await userConnectionsStore.updateUserConnection(
                { requestingUserId: user1.id, acceptingUserId: user3.id },
                { requestStatus: UserConnectionTypes.COMPLETE },
            );

            // Count connections
            const countResult = await userConnectionsStore.countUserConnections(user1.id, {
                requestStatus: UserConnectionTypes.COMPLETE,
            });

            expect(Number(countResult[0].count)).to.be.at.least(2);
        });
    });

    describe('MIGHT_KNOW Connection Flow (People You May Know)', () => {
        it('should create MIGHT_KNOW connections for suggested users', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn13a');
            const user2 = await createTestUser('conn13b');

            // Create MIGHT_KNOW connection (from contact sync)
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.MIGHT_KNOW,
            });
            createdConnectionIds.push(connections[0].id);

            expect(connections[0].requestStatus).to.equal(UserConnectionTypes.MIGHT_KNOW);
        });

        it('should upgrade MIGHT_KNOW to PENDING when user sends friend request', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn14a');
            const user2 = await createTestUser('conn14b');

            // Create MIGHT_KNOW connection
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.MIGHT_KNOW,
            });
            createdConnectionIds.push(connections[0].id);

            // Upgrade to PENDING
            const updatedConnections = await userConnectionsStore.updateUserConnection(
                {
                    requestingUserId: user1.id,
                    acceptingUserId: user2.id,
                },
                {
                    requestStatus: UserConnectionTypes.PENDING,
                },
            );

            expect(updatedConnections[0].requestStatus).to.equal(UserConnectionTypes.PENDING);
        });

        it('should use createIfNotExist for batch MIGHT_KNOW connections', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('conn15a');
            const user2 = await createTestUser('conn15b');
            const user3 = await createTestUser('conn15c');

            const mightKnowConnections = [
                {
                    requestingUserId: user1.id,
                    acceptingUserId: user2.id,
                    requestStatus: UserConnectionTypes.MIGHT_KNOW,
                },
                {
                    requestingUserId: user1.id,
                    acceptingUserId: user3.id,
                    requestStatus: UserConnectionTypes.MIGHT_KNOW,
                },
            ];

            const connections = await userConnectionsStore.createIfNotExist(mightKnowConnections);
            connections.forEach((conn) => createdConnectionIds.push(conn.id));

            expect(connections.length).to.equal(2);
        });
    });
});
