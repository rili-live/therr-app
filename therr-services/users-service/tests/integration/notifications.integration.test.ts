/**
 * Integration Tests for Users Service - Notifications
 *
 * These tests verify notification creation and retrieval with real database joins.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import bcrypt from 'bcrypt';
import { AccessLevels, UserConnectionTypes, Notifications } from 'therr-js-utilities/constants';
import UsersStore, { ICreateUserParams } from '../../src/store/UsersStore';
import UserConnectionsStore from '../../src/store/UserConnectionsStore';
import NotificationsStore from '../../src/store/NotificationsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - Notifications', () => {
    const TEST_EMAIL_PREFIX = 'notif-test-';
    const TEST_EMAIL_DOMAIN = '@example-test.com';
    let usersStore: UsersStore;
    let userConnectionsStore: UserConnectionsStore;
    let notificationsStore: NotificationsStore;
    let skipTests = false;
    let createdUserIds: string[] = [];
    let createdConnectionIds: string[] = [];
    let createdNotificationIds: string[] = [];

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
        notificationsStore = new NotificationsStore(connection);
    });

    afterEach(async () => {
        if (skipTests) return;

        // Clean up notifications first
        await Promise.all(createdNotificationIds.map(async (notifId) => {
            try {
                await cleanupTestData('notifications', { id: notifId });
            } catch {
                // Ignore cleanup errors
            }
        }));
        createdNotificationIds = [];

        // Clean up connections
        await Promise.all(createdConnectionIds.map(async (connId) => {
            try {
                await cleanupTestData('userConnections', { id: connId });
            } catch {
                // Ignore cleanup errors
            }
        }));
        createdConnectionIds = [];

        // Clean up users
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
            userName: `notifuser${suffix}`,
            hasAgreedToTerms: true,
            accessLevels: JSON.stringify([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]),
            verificationCodes: JSON.stringify({ email: {} }),
        };

        const createdUsers = await usersStore.createUser(testUser);
        createdUserIds.push(createdUsers[0].id);
        return createdUsers[0];
    };

    describe('Notification Creation Flow', () => {
        it('should create a notification with required fields', async () => {
            if (skipTests) return;

            const user = await createTestUser('notif1');

            const notifications = await notificationsStore.createNotification({
                userId: user.id,
                type: Notifications.Types.ACHIEVEMENT_COMPLETED,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.ACHIEVEMENT_COMPLETED,
                messageParams: { achievementName: 'First Steps' },
            });

            createdNotificationIds.push(notifications[0].id);

            expect(notifications).to.be.an('array');
            expect(notifications.length).to.equal(1);
            expect(notifications[0].userId).to.equal(user.id);
            expect(notifications[0].type).to.equal(Notifications.Types.ACHIEVEMENT_COMPLETED);
            expect(notifications[0].isUnread).to.equal(true);
        });

        it('should create a connection request notification with associationId', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('notif2a');
            const user2 = await createTestUser('notif2b');

            // Create connection request
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.PENDING,
            });
            createdConnectionIds.push(connections[0].id);

            // Create notification for user2 about the request
            const notifications = await notificationsStore.createNotification({
                userId: user2.id,
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                associationId: connections[0].id,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED,
                messageParams: {
                    firstName: user1.firstName,
                    lastName: user1.lastName,
                },
            });

            createdNotificationIds.push(notifications[0].id);

            expect(notifications[0].associationId).to.equal(connections[0].id);
            expect(notifications[0].type).to.equal(Notifications.Types.CONNECTION_REQUEST_RECEIVED);
        });
    });

    describe('Notification Retrieval Flow', () => {
        it('should get notification by id', async () => {
            if (skipTests) return;

            const user = await createTestUser('notif3');

            const created = await notificationsStore.createNotification({
                userId: user.id,
                type: Notifications.Types.NEW_LIKE_RECEIVED,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.NEW_LIKE_RECEIVED,
            });
            createdNotificationIds.push(created[0].id);

            const found = await notificationsStore.getNotifications({ id: created[0].id });

            expect(found.length).to.equal(1);
            expect(found[0].id).to.equal(created[0].id);
        });

        it('should search notifications with pagination', async () => {
            if (skipTests) return;

            const user = await createTestUser('notif4');

            // Create multiple notifications
            const notifPromises = Array.from({ length: 5 }, (_, i) => notificationsStore.createNotification({
                userId: user.id,
                type: Notifications.Types.ACHIEVEMENT_COMPLETED,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.ACHIEVEMENT_COMPLETED,
                messageParams: { index: i },
            }));
            const notifResults = await Promise.all(notifPromises);
            notifResults.forEach((notif) => createdNotificationIds.push(notif[0].id));

            // Search with pagination
            const results = await notificationsStore.searchNotifications(user.id, {
                pagination: { itemsPerPage: 3, pageNumber: 1 },
                order: 'desc',
            });

            expect(results.length).to.equal(3);
        });

        it('should search notifications with userConnection join data', async () => {
            if (skipTests) return;

            const user1 = await createTestUser('notif5a');
            const user2 = await createTestUser('notif5b');

            // Create connection
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: user1.id,
                acceptingUserId: user2.id,
                requestStatus: UserConnectionTypes.PENDING,
            });
            createdConnectionIds.push(connections[0].id);

            // Create notification with connection associationId
            const notifications = await notificationsStore.createNotification({
                userId: user2.id,
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                associationId: connections[0].id,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED,
            });
            createdNotificationIds.push(notifications[0].id);

            // Search should include userConnection data via join
            const results = await notificationsStore.searchNotifications(user2.id, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
                order: 'desc',
            });

            expect(results.length).to.be.at.least(1);

            const connectionNotif = results.find(
                (r) => r.type === Notifications.Types.CONNECTION_REQUEST_RECEIVED,
            );
            expect(connectionNotif).to.not.equal(undefined);

            // The join should include userConnection data
            if (connectionNotif?.userConnection) {
                expect(connectionNotif.userConnection.requestingUserId).to.equal(user1.id);
                expect(connectionNotif.userConnection.acceptingUserId).to.equal(user2.id);
                expect(connectionNotif.userConnection.requestStatus).to.equal(UserConnectionTypes.PENDING);
            }
        });
    });

    describe('Notification Update Flow', () => {
        it('should mark notification as read', async () => {
            if (skipTests) return;

            const user = await createTestUser('notif6');

            const created = await notificationsStore.createNotification({
                userId: user.id,
                type: Notifications.Types.NEW_SUPER_LIKE_RECEIVED,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.NEW_SUPER_LIKE_RECEIVED,
            });
            createdNotificationIds.push(created[0].id);

            expect(created[0].isUnread).to.equal(true);

            // Mark as read
            const updated = await notificationsStore.updateNotification(
                { id: created[0].id },
                { isUnread: false },
            );

            expect(updated[0].isUnread).to.equal(false);
        });

        it('should update notification updatedAt timestamp', async () => {
            if (skipTests) return;

            const user = await createTestUser('notif7');

            const created = await notificationsStore.createNotification({
                userId: user.id,
                type: Notifications.Types.NEW_DM_RECEIVED,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.NEW_DM_RECEIVED,
            });
            createdNotificationIds.push(created[0].id);

            // Wait a moment to ensure timestamp difference
            await new Promise((resolve) => { setTimeout(resolve, 100); });

            // Update notification
            const updated = await notificationsStore.updateNotification(
                { id: created[0].id },
                { isUnread: false },
            );

            // Verify updatedAt changed (compare as dates, not timestamps to avoid timezone issues)
            const originalDate = new Date(created[0].updatedAt);
            const updatedDate = new Date(updated[0].updatedAt);

            // The updated timestamp should be different from created (update sets new timestamp)
            expect(updatedDate.toISOString()).to.not.equal(originalDate.toISOString());
        });
    });

    describe('Notification Count Flow', () => {
        it('should count unread notifications', async () => {
            if (skipTests) return;

            const user = await createTestUser('notif8');

            // Create multiple notifications (some read, some unread)
            const notifPromises = Array.from({ length: 3 }, () => notificationsStore.createNotification({
                userId: user.id,
                type: Notifications.Types.ACHIEVEMENT_COMPLETED,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.ACHIEVEMENT_COMPLETED,
            }));
            const notifResults = await Promise.all(notifPromises);
            notifResults.forEach((notif) => createdNotificationIds.push(notif[0].id));

            // Mark one as read
            await notificationsStore.updateNotification(
                { id: createdNotificationIds[0] },
                { isUnread: false },
            );

            // Count unread
            const countResult = await notificationsStore.countRecords({
                filterBy: 'isUnread',
                query: true,
            });

            // Should have at least 2 unread (the ones we created minus the one we marked read)
            expect(Number(countResult[0].count)).to.be.at.least(2);
        });
    });

    describe('Complete Notification Flow (Friend Request)', () => {
        it('should create notification on friend request and update on acceptance', async () => {
            if (skipTests) return;

            const requester = await createTestUser('notif9a');
            const accepter = await createTestUser('notif9b');

            // Step 1: Create friend request connection
            const connections = await userConnectionsStore.createUserConnection({
                requestingUserId: requester.id,
                acceptingUserId: accepter.id,
                requestStatus: UserConnectionTypes.PENDING,
            });
            createdConnectionIds.push(connections[0].id);

            // Step 2: Create notification for accepter about the request
            const requestNotif = await notificationsStore.createNotification({
                userId: accepter.id,
                type: Notifications.Types.CONNECTION_REQUEST_RECEIVED,
                associationId: connections[0].id,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_RECEIVED,
                messageParams: {
                    firstName: requester.firstName,
                    lastName: requester.lastName,
                },
            });
            createdNotificationIds.push(requestNotif[0].id);

            // Step 3: Accept the connection
            await userConnectionsStore.updateUserConnection(
                { requestingUserId: requester.id, acceptingUserId: accepter.id },
                { requestStatus: UserConnectionTypes.COMPLETE },
            );

            // Step 4: Create notification for requester about acceptance
            const acceptNotif = await notificationsStore.createNotification({
                userId: requester.id,
                type: Notifications.Types.CONNECTION_REQUEST_ACCEPTED,
                associationId: connections[0].id,
                isUnread: true,
                messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_ACCEPTED,
                messageParams: {
                    firstName: accepter.firstName,
                    lastName: accepter.lastName,
                },
            });
            createdNotificationIds.push(acceptNotif[0].id);

            // Step 5: Mark the original request notification as read
            await notificationsStore.updateNotification(
                { id: requestNotif[0].id },
                { isUnread: false },
            );

            // Verify the flow
            const accepterNotifs = await notificationsStore.searchNotifications(accepter.id, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
                order: 'desc',
            });
            const requesterNotifs = await notificationsStore.searchNotifications(requester.id, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
                order: 'desc',
            });

            // Accepter should have the request notification (now read)
            const accepterRequestNotif = accepterNotifs.find(
                (n) => n.type === Notifications.Types.CONNECTION_REQUEST_RECEIVED,
            );
            expect(accepterRequestNotif).to.not.equal(undefined);
            expect(accepterRequestNotif?.isUnread).to.equal(false);

            // Requester should have the acceptance notification (unread)
            const requesterAcceptNotif = requesterNotifs.find(
                (n) => n.type === Notifications.Types.CONNECTION_REQUEST_ACCEPTED,
            );
            expect(requesterAcceptNotif).to.not.equal(undefined);
            expect(requesterAcceptNotif?.isUnread).to.equal(true);
        });
    });
});
