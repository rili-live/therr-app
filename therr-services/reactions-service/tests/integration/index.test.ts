/**
 * Integration Tests for Reactions Service
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
import MomentReactionsStore, { ICreateMomentReactionParams } from '../../src/store/MomentReactionsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests', () => {
    const TEST_USER_ID = '4514f6f0-0b56-4553-a727-0cf842cafb0c';
    const TEST_MOMENT_ID = '98af2d0f-ec9f-4d7d-89dd-719d1505ff7b';
    let momentReactionsStore: MomentReactionsStore;
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
        momentReactionsStore = new MomentReactionsStore(connection);
    });

    beforeEach(async () => {
        if (skipTests) return;
        // Clean up any leftover test data
        try {
            await cleanupTestData('momentReactions', { userId: TEST_USER_ID });
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test data
        try {
            await cleanupTestData('momentReactions', { userId: TEST_USER_ID });
        } catch {
            // Ignore cleanup errors
        }
        // Close database connections
        await closeTestConnection();
    });

    describe('MomentReactionsStore - Database Integration', () => {
        it('should create a new moment reaction in the database', async () => {
            if (skipTests) return;

            const testReaction: ICreateMomentReactionParams = {
                momentId: TEST_MOMENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: false,
                userHasSuperLiked: false,
                userHasDisliked: false,
                userHasReported: false,
                userHasSuperDisliked: false,
                userLocale: 'en-us',
            };

            // Create the reaction
            const createdReactions = await momentReactionsStore.create(testReaction);

            // Verify the reaction was created
            expect(createdReactions).to.be.an('array');
            expect(createdReactions.length).to.equal(1);

            const createdReaction = createdReactions[0];
            expect(createdReaction.momentId).to.equal(TEST_MOMENT_ID);
            expect(createdReaction.userId).to.equal(TEST_USER_ID);
            expect(createdReaction.userHasActivated).to.equal(true);
        });

        it('should get reactions by moment id', async () => {
            if (skipTests) return;

            // First create a reaction
            const testReaction: ICreateMomentReactionParams = {
                momentId: TEST_MOMENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userLocale: 'en-us',
            };
            await momentReactionsStore.create(testReaction);

            // Get reactions by moment id
            const foundReactions = await momentReactionsStore.getByMomentId({
                momentId: TEST_MOMENT_ID,
            });

            expect(foundReactions).to.be.an('array');
            expect(foundReactions.length).to.be.greaterThan(0);
            expect(foundReactions[0].momentId).to.equal(TEST_MOMENT_ID);
        });

        it('should update a moment reaction', async () => {
            if (skipTests) return;

            // First create a reaction
            const testReaction: ICreateMomentReactionParams = {
                momentId: TEST_MOMENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: false,
                userLocale: 'en-us',
            };
            await momentReactionsStore.create(testReaction);

            // Update the reaction
            const updatedReactions = await momentReactionsStore.update(
                { momentId: TEST_MOMENT_ID, userId: TEST_USER_ID },
                { userHasLiked: true },
            );

            expect(updatedReactions).to.be.an('array');
            expect(updatedReactions.length).to.equal(1);
            expect(updatedReactions[0].userHasLiked).to.equal(true);
        });

        it('should get reaction counts', async () => {
            if (skipTests) return;

            // First create a reaction with a like
            const testReaction: ICreateMomentReactionParams = {
                momentId: TEST_MOMENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userLocale: 'en-us',
            };
            await momentReactionsStore.create(testReaction);

            // Get counts
            const counts = await momentReactionsStore.getCounts(
                [TEST_MOMENT_ID],
                {},
                'userHasLiked',
            );

            expect(counts).to.be.an('array');
            expect(counts.length).to.be.greaterThan(0);
            expect(counts[0].momentId).to.equal(TEST_MOMENT_ID);
            expect(Number(counts[0].count)).to.be.greaterThanOrEqual(1);
        });

        it('should delete reactions by user id', async () => {
            if (skipTests) return;

            // First create a reaction
            const testReaction: ICreateMomentReactionParams = {
                momentId: TEST_MOMENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userLocale: 'en-us',
            };
            await momentReactionsStore.create(testReaction);

            // Delete reactions
            await momentReactionsStore.delete(TEST_USER_ID);

            // Verify deletion
            const foundReactions = await momentReactionsStore.getByMomentId({
                momentId: TEST_MOMENT_ID,
                userId: TEST_USER_ID,
            });

            expect(foundReactions).to.be.an('array');
            expect(foundReactions.length).to.equal(0);
        });
    });
});
