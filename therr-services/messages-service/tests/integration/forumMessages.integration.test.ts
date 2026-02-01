/**
 * Integration Tests for Forum Messages
 *
 * These tests verify forum message operations against a real database.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import ForumsStore, { ICreateForumParams } from '../../src/store/ForumsStore';
import ForumMessagesStore, { ICreateForumMessageParams } from '../../src/store/ForumMessagesStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - Forum Messages', () => {
    // Use valid UUID format for test user IDs
    const TEST_USER_1 = '686800b1-8383-42cb-bbf2-7e9e460a7f76';
    const TEST_USER_2 = 'ecbfe38f-ac0e-4dfa-835b-720666d91a80';
    let forumsStore: ForumsStore;
    let forumMessagesStore: ForumMessagesStore;
    let skipTests = false;
    let testForumId: number | null = null;

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
        forumsStore = new ForumsStore(connection);
        forumMessagesStore = new ForumMessagesStore(connection);

        // Check if categories table has data
        let validCategoryTag = 'general';
        try {
            const categoryResult = await connection.read.query('SELECT tag FROM main.categories LIMIT 1');
            if (categoryResult.rows.length === 0) {
                console.log('\n⚠️  No categories found in database. Skipping forum messages integration tests.');
                console.log('   Run seed scripts to populate categories.\n');
                skipTests = true;
                return;
            }
            validCategoryTag = categoryResult.rows[0].tag;
        } catch (err) {
            console.log('\n⚠️  Error checking categories. Skipping forum messages integration tests.');
            skipTests = true;
            return;
        }

        // Create a test forum for all message tests
        try {
            const testForum: ICreateForumParams = {
                authorId: TEST_USER_1,
                authorLocale: 'en-us',
                administratorIds: TEST_USER_1,
                categoryTags: [validCategoryTag],
                title: ['Forum Messages Test Forum'],
                subtitle: ['Test'],
                description: 'Forum for testing messages',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
                isPublic: true,
            };

            const createdForums = await forumsStore.createForum(testForum);
            testForumId = Number(createdForums[0].id);
        } catch (err) {
            console.log('\n⚠️  Error creating test forum. Skipping forum messages integration tests.');
            skipTests = true;
        }
    });

    beforeEach(async () => {
        if (skipTests || !testForumId) return;
        // Clean up forum messages before each test
        try {
            await cleanupTestData('forumMessages', { forumId: testForumId });
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test forum and its messages
        if (testForumId) {
            try {
                await cleanupTestData('forumMessages', { forumId: testForumId });
                await cleanupTestData('forumCategories', { forumId: testForumId });
                await cleanupTestData('forums', { id: testForumId });
            } catch {
                // Ignore cleanup errors
            }
        }
        await closeTestConnection();
    });

    describe('Create Forum Message', () => {
        it('should create a new message in a forum', async () => {
            if (skipTests || !testForumId) return;

            const testMessage: ICreateForumMessageParams = {
                forumId: testForumId,
                message: 'Hello forum! This is my first message.',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            };

            const createdMessages = await forumMessagesStore.createForumMessage(testMessage);

            expect(createdMessages).to.be.an('array');
            expect(createdMessages.length).to.equal(1);
            expect(createdMessages[0].id).to.be.a('number');
            expect(createdMessages[0].updatedAt).to.not.be.eq(undefined);
        });

        it('should create an announcement message', async () => {
            if (skipTests || !testForumId) return;

            const testMessage: ICreateForumMessageParams = {
                forumId: testForumId,
                message: 'Important announcement for all members!',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: true,
            };

            const createdMessages = await forumMessagesStore.createForumMessage(testMessage);

            expect(createdMessages).to.be.an('array');
            expect(createdMessages[0].id).to.be.a('number');
        });

        it('should create message with different locale', async () => {
            if (skipTests || !testForumId) return;

            const testMessage: ICreateForumMessageParams = {
                forumId: testForumId,
                message: 'Message with different locale',
                fromUserId: TEST_USER_1,
                fromUserLocale: 2, // Different locale code
            };

            const createdMessages = await forumMessagesStore.createForumMessage(testMessage);

            expect(createdMessages).to.be.an('array');
            expect(createdMessages[0].id).to.be.a('number');
        });

        it('should create messages from multiple users', async () => {
            if (skipTests || !testForumId) return;

            const message1 = await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Message from user 1',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
            });

            const message2 = await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Message from user 2',
                fromUserId: TEST_USER_2,
                fromUserLocale: 1,
            });

            expect(message1[0].id).to.not.equal(message2[0].id);
        });
    });

    describe('Search Forum Messages', () => {
        it('should search messages in a forum with pagination', async () => {
            if (skipTests || !testForumId) return;

            // Create test messages
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Search test message 1',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            });
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Search test message 2',
                fromUserId: TEST_USER_2,
                fromUserLocale: 1,
                isAnnouncement: false,
            });

            // Search messages
            const foundMessages = await forumMessagesStore.searchForumMessages(
                testForumId,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                },
                [],
            );

            expect(foundMessages).to.be.an('array');
            expect(foundMessages.length).to.be.greaterThanOrEqual(2);
        });

        it('should exclude announcements by default', async () => {
            if (skipTests || !testForumId) return;

            // Create regular message
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Regular message',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            });

            // Create announcement
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Announcement message',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: true,
            });

            // Search messages (should exclude announcements)
            const foundMessages = await forumMessagesStore.searchForumMessages(
                testForumId,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                },
                [],
            );

            const announcementInResults = foundMessages.find((m: any) => m.message === 'Announcement message');
            expect(announcementInResults).to.be.eq(undefined);
        });

        it('should paginate results correctly', async () => {
            if (skipTests || !testForumId) return;

            // Create 5 test messages
            await Promise.all([0, 1, 2, 3, 4].map(async (i) => {
                await forumMessagesStore.createForumMessage({
                    forumId: testForumId as number,
                    message: `Pagination test message ${i}`,
                    fromUserId: TEST_USER_1,
                    fromUserLocale: 1,
                    isAnnouncement: false,
                });
            }));

            // Get first page
            const page1 = await forumMessagesStore.searchForumMessages(
                testForumId,
                {
                    pagination: { itemsPerPage: 2, pageNumber: 1 },
                },
                [],
            );

            // Get second page
            const page2 = await forumMessagesStore.searchForumMessages(
                testForumId,
                {
                    pagination: { itemsPerPage: 2, pageNumber: 2 },
                },
                [],
            );

            expect(page1.length).to.equal(2);
            expect(page2.length).to.equal(2);
            expect(page1[0].id).to.not.equal(page2[0].id);
        });

        it('should order by createdAt descending', async () => {
            if (skipTests || !testForumId) return;

            // Create messages with small delays
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'First message',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            });

            await new Promise((resolve) => { setTimeout(resolve, 100); });

            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Second message',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            });

            // Search messages
            const foundMessages = await forumMessagesStore.searchForumMessages(
                testForumId,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                },
                [],
            );

            // Most recent should be first (descending order)
            expect(foundMessages[0].message).to.equal('Second message');
        });

        it('should filter messages by fromUserId', async () => {
            if (skipTests || !testForumId) return;

            // Create messages from different users
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Message from user 1',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            });
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Message from user 2',
                fromUserId: TEST_USER_2,
                fromUserLocale: 1,
                isAnnouncement: false,
            });

            // Filter by user 1
            const foundMessages = await forumMessagesStore.searchForumMessages(
                testForumId,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: TEST_USER_1,
                },
                [],
            );

            expect(foundMessages.every((m: any) => m.fromUserId === TEST_USER_1)).to.be.eq(true);
        });
    });

    describe('Count Records', () => {
        it('should count forum messages', async () => {
            if (skipTests || !testForumId) return;

            // Create test messages
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Count test message 1',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            });
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Count test message 2',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            });

            const countResult = await forumMessagesStore.countRecords({
                filterBy: 'forumId',
                query: testForumId,
            });

            expect(countResult).to.be.an('array');
            expect(countResult.length).to.equal(1);
            expect(Number(countResult[0].count)).to.be.greaterThanOrEqual(2);
        });

        it('should count only announcement messages', async () => {
            if (skipTests || !testForumId) return;

            // Create regular and announcement messages
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Regular message',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: false,
            });
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Announcement 1',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: true,
            });
            await forumMessagesStore.createForumMessage({
                forumId: testForumId,
                message: 'Announcement 2',
                fromUserId: TEST_USER_1,
                fromUserLocale: 1,
                isAnnouncement: true,
            });

            const announcementCount = await forumMessagesStore.countRecords({
                filterBy: 'isAnnouncement',
                query: true,
            });

            expect(Number(announcementCount[0].count)).to.be.greaterThanOrEqual(2);
        });
    });

    describe('Multiple Forums', () => {
        it('should keep messages separate between forums', async () => {
            if (skipTests || !testForumId) return;

            // Get a valid category tag
            const connection = getTestConnection();
            const categoryResult = await connection.read.query('SELECT tag FROM main.categories LIMIT 1');
            const validCategoryTag = categoryResult.rows[0]?.tag || 'general';

            // Create a second forum
            const secondForum = await forumsStore.createForum({
                authorId: TEST_USER_1,
                authorLocale: 'en-us',
                administratorIds: TEST_USER_1,
                categoryTags: [validCategoryTag],
                title: ['Second Test Forum'],
                subtitle: ['Test'],
                description: 'Second forum for testing',
                iconGroup: 'default',
                iconId: 'forum',
                iconColor: '#000',
                isPublic: true,
            });
            const secondForumId = Number(secondForum[0].id);

            try {
                // Create message in first forum
                await forumMessagesStore.createForumMessage({
                    forumId: testForumId,
                    message: 'Message in first forum',
                    fromUserId: TEST_USER_1,
                    fromUserLocale: 1,
                    isAnnouncement: false,
                });

                // Create message in second forum
                await forumMessagesStore.createForumMessage({
                    forumId: secondForumId,
                    message: 'Message in second forum',
                    fromUserId: TEST_USER_1,
                    fromUserLocale: 1,
                    isAnnouncement: false,
                });

                // Search first forum
                const firstForumMessages = await forumMessagesStore.searchForumMessages(
                    testForumId,
                    {
                        pagination: { itemsPerPage: 10, pageNumber: 1 },
                    },
                    [],
                );

                // Search second forum
                const secondForumMessages = await forumMessagesStore.searchForumMessages(
                    secondForumId,
                    {
                        pagination: { itemsPerPage: 10, pageNumber: 1 },
                    },
                    [],
                );

                // Verify messages are in correct forums
                expect(firstForumMessages.every((m: any) => m.forumId === testForumId)).to.be.eq(true);
                expect(secondForumMessages.every((m: any) => m.forumId === secondForumId)).to.be.eq(true);
            } finally {
                // Clean up second forum
                await cleanupTestData('forumMessages', { forumId: secondForumId });
                await cleanupTestData('forumCategories', { forumId: secondForumId });
                await cleanupTestData('forums', { id: secondForumId });
            }
        });
    });
});
