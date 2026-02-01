/**
 * Integration Tests for Direct Messages
 *
 * These tests verify the complete direct messaging workflow against a real database.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import DirectMessagesStore, { ICreateDirectMessageParams } from '../../src/store/DirectMessagesStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - Direct Messages', () => {
    const TEST_USER_1 = '94880a23-2920-407f-babe-f83a066905dd';
    const TEST_USER_2 = '517f61a7-b8e2-49ec-a885-7e81beec456b';
    const TEST_USER_3 = '912f44e9-b37a-4a05-a021-809b9e123038';
    let directMessagesStore: DirectMessagesStore;
    let skipTests = false;

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
        directMessagesStore = new DirectMessagesStore(connection);
    });

    beforeEach(async () => {
        if (skipTests) return;
        // Clean up any leftover test data
        try {
            await cleanupTestData('directMessages', { fromUserId: TEST_USER_1 });
            await cleanupTestData('directMessages', { fromUserId: TEST_USER_2 });
            await cleanupTestData('directMessages', { fromUserId: TEST_USER_3 });
            await cleanupTestData('directMessages', { toUserId: TEST_USER_1 });
            await cleanupTestData('directMessages', { toUserId: TEST_USER_2 });
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test data
        try {
            await cleanupTestData('directMessages', { fromUserId: TEST_USER_1 });
            await cleanupTestData('directMessages', { fromUserId: TEST_USER_2 });
            await cleanupTestData('directMessages', { fromUserId: TEST_USER_3 });
        } catch {
            // Ignore cleanup errors
        }
        await closeTestConnection();
    });

    describe('Create Direct Message', () => {
        it('should create a new direct message in the database', async () => {
            if (skipTests) return;

            const testMessage: ICreateDirectMessageParams = {
                message: 'Hello from integration test!',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            };

            const createdMessages = await directMessagesStore.createDirectMessage(testMessage);

            expect(createdMessages).to.be.an('array');
            expect(createdMessages.length).to.equal(1);
            expect(createdMessages[0].id).to.be.a('string');
            expect(createdMessages[0].updatedAt).to.not.be.eq(undefined);
        });

        it('should create message with unread flag set to false', async () => {
            if (skipTests) return;

            const testMessage: ICreateDirectMessageParams = {
                message: 'Already read message',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: false,
                locale: 'en-us',
            };

            const createdMessages = await directMessagesStore.createDirectMessage(testMessage);

            expect(createdMessages).to.be.an('array');
            expect(createdMessages[0].id).to.be.a('string');
        });

        it('should create message with different locale', async () => {
            if (skipTests) return;

            const testMessage: ICreateDirectMessageParams = {
                message: 'Bonjour!',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'fr-fr',
            };

            const createdMessages = await directMessagesStore.createDirectMessage(testMessage);

            expect(createdMessages).to.be.an('array');
            expect(createdMessages[0].id).to.be.a('string');
        });
    });

    describe('Search Direct Messages', () => {
        it('should search for direct messages by user', async () => {
            if (skipTests) return;

            // Create test messages
            await directMessagesStore.createDirectMessage({
                message: 'Search test message 1',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });
            await directMessagesStore.createDirectMessage({
                message: 'Search test message 2',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });

            // Search for messages
            const foundMessages = await directMessagesStore.searchDirectMessages(
                TEST_USER_2,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: TEST_USER_1,
                },
                ['*'],
            );

            expect(foundMessages).to.be.an('array');
            expect(foundMessages.length).to.be.greaterThanOrEqual(2);
            expect(foundMessages[0].fromUserId).to.equal(TEST_USER_1);
        });

        it('should paginate results correctly', async () => {
            if (skipTests) return;

            // Create 5 test messages
            await Promise.all([0, 1, 2, 3, 4].map((i) => directMessagesStore.createDirectMessage({
                message: `Pagination test message ${i}`,
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            })));

            // Get first page
            const page1 = await directMessagesStore.searchDirectMessages(
                TEST_USER_2,
                {
                    pagination: { itemsPerPage: 2, pageNumber: 1 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: TEST_USER_1,
                },
                ['*'],
            );

            // Get second page
            const page2 = await directMessagesStore.searchDirectMessages(
                TEST_USER_2,
                {
                    pagination: { itemsPerPage: 2, pageNumber: 2 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: TEST_USER_1,
                },
                ['*'],
            );

            expect(page1.length).to.equal(2);
            expect(page2.length).to.equal(2);
            expect(page1[0].id).to.not.equal(page2[0].id);
        });

        it('should search with reverse direction check', async () => {
            if (skipTests) return;

            // Create messages in both directions
            await directMessagesStore.createDirectMessage({
                message: 'From user 1 to user 2',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });
            await directMessagesStore.createDirectMessage({
                message: 'From user 2 to user 1',
                toUserId: TEST_USER_1,
                fromUserId: TEST_USER_2,
                isUnread: true,
                locale: 'en-us',
            });

            // Search with reverse check
            const foundMessages = await directMessagesStore.searchDirectMessages(
                TEST_USER_1,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: TEST_USER_2,
                },
                ['*'],
                'true',
            );

            expect(foundMessages).to.be.an('array');
            expect(foundMessages.length).to.be.greaterThanOrEqual(2);
        });
    });

    describe('Search Latest DMs', () => {
        it('should return unique conversation threads', async () => {
            if (skipTests) return;

            // Create conversation with user 2
            await directMessagesStore.createDirectMessage({
                message: 'First message to user 2',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });
            await directMessagesStore.createDirectMessage({
                message: 'Second message to user 2',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });

            // Create conversation with user 3
            await directMessagesStore.createDirectMessage({
                message: 'Message to user 3',
                toUserId: TEST_USER_3,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });

            // Search latest DMs - should group by conversation
            const latestDMs = await directMessagesStore.searchLatestDMs(TEST_USER_1, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            });

            expect(latestDMs).to.be.an('array');
            // Should have 2 unique conversations (with user 2 and user 3)
            expect(latestDMs.length).to.be.greaterThanOrEqual(2);
        });

        it('should return most recent message per conversation', async () => {
            if (skipTests) return;

            // Create multiple messages in same conversation
            await directMessagesStore.createDirectMessage({
                message: 'Older message',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });

            // Small delay to ensure different timestamps
            await new Promise((resolve) => { setTimeout(resolve, 100); });

            await directMessagesStore.createDirectMessage({
                message: 'Newest message',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });

            const latestDMs = await directMessagesStore.searchLatestDMs(TEST_USER_1, {
                pagination: { itemsPerPage: 10, pageNumber: 1 },
            });

            const conversationWithUser2 = latestDMs.find(
                (dm) => (dm.toUserId === TEST_USER_2 || dm.fromUserId === TEST_USER_2),
            );

            expect(conversationWithUser2).to.not.be.eq(undefined);
            expect(conversationWithUser2.message).to.equal('Newest message');
        });
    });

    describe('Count Records', () => {
        it('should count direct message records', async () => {
            if (skipTests) return;

            // Create test messages
            await directMessagesStore.createDirectMessage({
                message: 'Count test message',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });

            const countResult = await directMessagesStore.countRecords({
                filterBy: 'fromUserId',
                query: TEST_USER_1,
            });

            expect(countResult).to.be.an('array');
            expect(countResult.length).to.equal(1);
            expect(Number(countResult[0].count)).to.be.greaterThanOrEqual(1);
        });

        it('should count unread messages', async () => {
            if (skipTests) return;

            // Create unread message
            await directMessagesStore.createDirectMessage({
                message: 'Unread message',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: true,
                locale: 'en-us',
            });

            // Create read message
            await directMessagesStore.createDirectMessage({
                message: 'Read message',
                toUserId: TEST_USER_2,
                fromUserId: TEST_USER_1,
                isUnread: false,
                locale: 'en-us',
            });

            const unreadCount = await directMessagesStore.countRecords({
                filterBy: 'isUnread',
                query: true,
            });

            expect(Number(unreadCount[0].count)).to.be.greaterThanOrEqual(1);
        });
    });
});
