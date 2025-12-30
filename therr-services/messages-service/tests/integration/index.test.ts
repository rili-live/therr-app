/**
 * Integration Tests for Messages Service
 *
 * These tests connect to a real PostgreSQL database to verify
 * that the data layer works correctly.
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

describe('Integration Tests', () => {
    const TEST_FROM_USER_ID = '686800b1-8383-42cb-bbf2-7e9e460a7f76';
    const TEST_TO_USER_ID = 'ecbfe38f-ac0e-4dfa-835b-720666d91a80';
    let directMessagesStore: DirectMessagesStore;
    let skipTests = false;

    before(async () => {
        // Check if database is available
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.');
            console.log('   Start the database with: docker compose -f docker-compose.infra.yml up -d');
            console.log('   Run migrations with: npm run migrations:run\n');
            skipTests = true;
            return;
        }

        // Initialize store with real connection
        const connection = getTestConnection();
        directMessagesStore = new DirectMessagesStore(connection);
    });

    beforeEach(async () => {
        if (skipTests) return;
        // Clean up any leftover test data
        try {
            await cleanupTestData('directMessages', { fromUserId: TEST_FROM_USER_ID });
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test data
        try {
            await cleanupTestData('directMessages', { fromUserId: TEST_FROM_USER_ID });
        } catch {
            // Ignore cleanup errors
        }
        // Close database connections
        await closeTestConnection();
    });

    describe('DirectMessagesStore - Database Integration', () => {
        it('should create a new direct message in the database', async () => {
            if (skipTests) return;

            const testMessage: ICreateDirectMessageParams = {
                message: 'Test integration message',
                toUserId: TEST_TO_USER_ID,
                fromUserId: TEST_FROM_USER_ID,
                isUnread: true,
                locale: 'en-us',
            };

            // Create the message
            const createdMessages = await directMessagesStore.createDirectMessage(testMessage);

            // Verify the message was created
            expect(createdMessages).to.be.an('array');
            expect(createdMessages.length).to.equal(1);

            const createdMessage = createdMessages[0];
            expect(createdMessage.id).to.be.a('string');
            expect(createdMessage.updatedAt).to.not.be.undefined;
        });

        it('should search for direct messages by user', async () => {
            if (skipTests) return;

            // First create a message
            const testMessage: ICreateDirectMessageParams = {
                message: 'Test search message',
                toUserId: TEST_TO_USER_ID,
                fromUserId: TEST_FROM_USER_ID,
                isUnread: true,
                locale: 'en-us',
            };
            await directMessagesStore.createDirectMessage(testMessage);

            // Search for messages
            const foundMessages = await directMessagesStore.searchDirectMessages(
                TEST_TO_USER_ID,
                {
                    pagination: { itemsPerPage: 10, pageNumber: 1 },
                    filterBy: 'fromUserId',
                    filterOperator: '=',
                    query: TEST_FROM_USER_ID,
                },
                ['*'],
            );

            expect(foundMessages).to.be.an('array');
            expect(foundMessages.length).to.be.greaterThan(0);
            expect(foundMessages[0].fromUserId).to.equal(TEST_FROM_USER_ID);
        });

        it('should count direct message records', async () => {
            if (skipTests) return;

            // First create a message
            const testMessage: ICreateDirectMessageParams = {
                message: 'Test count message',
                toUserId: TEST_TO_USER_ID,
                fromUserId: TEST_FROM_USER_ID,
                isUnread: true,
                locale: 'en-us',
            };
            await directMessagesStore.createDirectMessage(testMessage);

            // Count records
            const countResult = await directMessagesStore.countRecords({
                fromUserId: TEST_FROM_USER_ID,
            });

            expect(countResult).to.be.an('array');
            expect(countResult.length).to.equal(1);
            expect(Number(countResult[0].count)).to.be.greaterThanOrEqual(1);
        });
    });
});
