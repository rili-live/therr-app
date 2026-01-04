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
import SpaceReactionsStore, { ICreateSpaceReactionParams } from '../../src/store/SpaceReactionsStore';
import EventReactionsStore, { ICreateEventReactionParams } from '../../src/store/EventReactionsStore';
import ThoughtReactionsStore, { ICreateThoughtReactionParams } from '../../src/store/ThoughtReactionsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests', () => {
    const TEST_USER_ID = '4514f6f0-0b56-4553-a727-0cf842cafb0c';
    const TEST_USER_ID_2 = '5625f7f1-1c67-5664-b838-1da953dac11d';
    const TEST_MOMENT_ID = '98af2d0f-ec9f-4d7d-89dd-719d1505ff7b';
    const TEST_SPACE_ID = 'a9bf3e1f-fd0a-5e8e-9aee-820e2616aa8c';
    const TEST_EVENT_ID = 'b0c04f2a-ae1b-6f9f-0bff-931f3727bb9d';
    const TEST_THOUGHT_ID = 'c1d15a3b-bf2c-7a0a-1caa-042a4838cc0e';

    let momentReactionsStore: MomentReactionsStore;
    let spaceReactionsStore: SpaceReactionsStore;
    let eventReactionsStore: EventReactionsStore;
    let thoughtReactionsStore: ThoughtReactionsStore;
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

        // Initialize stores with real connection
        const connection = getTestConnection();
        momentReactionsStore = new MomentReactionsStore(connection);
        spaceReactionsStore = new SpaceReactionsStore(connection);
        eventReactionsStore = new EventReactionsStore(connection);
        thoughtReactionsStore = new ThoughtReactionsStore(connection);
    });

    beforeEach(async () => {
        if (skipTests) return;
        // Clean up any leftover test data
        try {
            await cleanupTestData('momentReactions', { userId: TEST_USER_ID });
            await cleanupTestData('momentReactions', { userId: TEST_USER_ID_2 });
            await cleanupTestData('spaceReactions', { userId: TEST_USER_ID });
            await cleanupTestData('spaceReactions', { userId: TEST_USER_ID_2 });
            await cleanupTestData('eventReactions', { userId: TEST_USER_ID });
            await cleanupTestData('eventReactions', { userId: TEST_USER_ID_2 });
            await cleanupTestData('thoughtReactions', { userId: TEST_USER_ID });
            await cleanupTestData('thoughtReactions', { userId: TEST_USER_ID_2 });
        } catch {
            // Ignore cleanup errors
        }
    });

    after(async () => {
        // Clean up test data
        try {
            await cleanupTestData('momentReactions', { userId: TEST_USER_ID });
            await cleanupTestData('momentReactions', { userId: TEST_USER_ID_2 });
            await cleanupTestData('spaceReactions', { userId: TEST_USER_ID });
            await cleanupTestData('spaceReactions', { userId: TEST_USER_ID_2 });
            await cleanupTestData('eventReactions', { userId: TEST_USER_ID });
            await cleanupTestData('eventReactions', { userId: TEST_USER_ID_2 });
            await cleanupTestData('thoughtReactions', { userId: TEST_USER_ID });
            await cleanupTestData('thoughtReactions', { userId: TEST_USER_ID_2 });
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

        it('should create batch moment reactions', async () => {
            if (skipTests) return;

            const testReactions: ICreateMomentReactionParams[] = [
                { momentId: TEST_MOMENT_ID, userId: TEST_USER_ID, userLocale: 'en-us' },
                { momentId: TEST_MOMENT_ID, userId: TEST_USER_ID_2, userLocale: 'en-us' },
            ];

            const createdReactions = await momentReactionsStore.create(testReactions);

            expect(createdReactions).to.be.an('array');
            expect(createdReactions.length).to.equal(2);
        });
    });

    describe('SpaceReactionsStore - Database Integration', () => {
        it('should create a new space reaction in the database', async () => {
            if (skipTests) return;

            const testReaction: ICreateSpaceReactionParams = {
                spaceId: TEST_SPACE_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: false,
                userHasSuperLiked: false,
                userHasDisliked: false,
                userHasReported: false,
                userHasSuperDisliked: false,
                userLocale: 'en-us',
                rating: 4,
            };

            const createdReactions = await spaceReactionsStore.create(testReaction);

            expect(createdReactions).to.be.an('array');
            expect(createdReactions.length).to.equal(1);
            expect(createdReactions[0].spaceId).to.equal(TEST_SPACE_ID);
            expect(createdReactions[0].rating).to.equal(4);
        });

        it('should get reactions by space id', async () => {
            if (skipTests) return;

            const testReaction: ICreateSpaceReactionParams = {
                spaceId: TEST_SPACE_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userLocale: 'en-us',
            };
            await spaceReactionsStore.create(testReaction);

            const foundReactions = await spaceReactionsStore.getBySpaceId({
                spaceId: TEST_SPACE_ID,
            });

            expect(foundReactions).to.be.an('array');
            expect(foundReactions.length).to.be.greaterThan(0);
            expect(foundReactions[0].spaceId).to.equal(TEST_SPACE_ID);
        });

        it('should update a space reaction', async () => {
            if (skipTests) return;

            const testReaction: ICreateSpaceReactionParams = {
                spaceId: TEST_SPACE_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: false,
                userLocale: 'en-us',
                rating: 3,
            };
            await spaceReactionsStore.create(testReaction);

            const updatedReactions = await spaceReactionsStore.update(
                { spaceId: TEST_SPACE_ID, userId: TEST_USER_ID },
                { userHasLiked: true, rating: 5 },
            );

            expect(updatedReactions).to.be.an('array');
            expect(updatedReactions.length).to.equal(1);
            expect(updatedReactions[0].userHasLiked).to.equal(true);
            expect(updatedReactions[0].rating).to.equal(5);
        });

        it('should get ratings by space id', async () => {
            if (skipTests) return;

            // Create multiple reactions with ratings
            await spaceReactionsStore.create([
                {
                    spaceId: TEST_SPACE_ID, userId: TEST_USER_ID, rating: 5, userLocale: 'en-us',
                },
                {
                    spaceId: TEST_SPACE_ID, userId: TEST_USER_ID_2, rating: 4, userLocale: 'en-us',
                },
            ]);

            const ratings = await spaceReactionsStore.getRatingsBySpaceId({ spaceId: TEST_SPACE_ID });

            expect(ratings).to.be.an('array');
            expect(ratings.length).to.equal(2);
            expect(ratings.every((r) => r.rating >= 4)).to.be.eq(true);
        });

        it('should get reaction counts', async () => {
            if (skipTests) return;

            const testReaction: ICreateSpaceReactionParams = {
                spaceId: TEST_SPACE_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userLocale: 'en-us',
            };
            await spaceReactionsStore.create(testReaction);

            const counts = await spaceReactionsStore.getCounts(
                [TEST_SPACE_ID],
                {},
                'userHasLiked',
            );

            expect(counts).to.be.an('array');
            expect(counts.length).to.be.greaterThan(0);
            expect(counts[0].spaceId).to.equal(TEST_SPACE_ID);
            expect(Number(counts[0].count)).to.be.greaterThanOrEqual(1);
        });

        it('should delete reactions by user id', async () => {
            if (skipTests) return;

            const testReaction: ICreateSpaceReactionParams = {
                spaceId: TEST_SPACE_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userLocale: 'en-us',
            };
            await spaceReactionsStore.create(testReaction);

            await spaceReactionsStore.delete(TEST_USER_ID);

            const foundReactions = await spaceReactionsStore.getBySpaceId({
                spaceId: TEST_SPACE_ID,
                userId: TEST_USER_ID,
            });

            expect(foundReactions).to.be.an('array');
            expect(foundReactions.length).to.equal(0);
        });
    });

    describe('EventReactionsStore - Database Integration', () => {
        it('should create a new event reaction in the database', async () => {
            if (skipTests) return;

            const testReaction: ICreateEventReactionParams = {
                eventId: TEST_EVENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: false,
                userHasSuperLiked: false,
                userHasDisliked: false,
                userHasReported: false,
                userHasSuperDisliked: false,
                userLocale: 'en-us',
                rating: 5,
            };

            const createdReactions = await eventReactionsStore.create(testReaction);

            expect(createdReactions).to.be.an('array');
            expect(createdReactions.length).to.equal(1);
            expect(createdReactions[0].eventId).to.equal(TEST_EVENT_ID);
            expect(createdReactions[0].rating).to.equal(5);
        });

        it('should get reactions by event id', async () => {
            if (skipTests) return;

            const testReaction: ICreateEventReactionParams = {
                eventId: TEST_EVENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userLocale: 'en-us',
            };
            await eventReactionsStore.create(testReaction);

            const foundReactions = await eventReactionsStore.getByEventId({
                eventId: TEST_EVENT_ID,
            });

            expect(foundReactions).to.be.an('array');
            expect(foundReactions.length).to.be.greaterThan(0);
            expect(foundReactions[0].eventId).to.equal(TEST_EVENT_ID);
        });

        it('should update an event reaction', async () => {
            if (skipTests) return;

            const testReaction: ICreateEventReactionParams = {
                eventId: TEST_EVENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: false,
                userLocale: 'en-us',
                rating: 3,
            };
            await eventReactionsStore.create(testReaction);

            const updatedReactions = await eventReactionsStore.update(
                { eventId: TEST_EVENT_ID, userId: TEST_USER_ID },
                { userHasLiked: true, rating: 5 },
            );

            expect(updatedReactions).to.be.an('array');
            expect(updatedReactions.length).to.equal(1);
            expect(updatedReactions[0].userHasLiked).to.equal(true);
            expect(updatedReactions[0].rating).to.equal(5);
        });

        it('should get ratings by event id', async () => {
            if (skipTests) return;

            await eventReactionsStore.create([
                {
                    eventId: TEST_EVENT_ID, userId: TEST_USER_ID, rating: 5, userLocale: 'en-us',
                },
                {
                    eventId: TEST_EVENT_ID, userId: TEST_USER_ID_2, rating: 4, userLocale: 'en-us',
                },
            ]);

            const ratings = await eventReactionsStore.getRatingsByEventId({ eventId: TEST_EVENT_ID });

            expect(ratings).to.be.an('array');
            expect(ratings.length).to.equal(2);
            expect(ratings.every((r) => r.rating >= 4)).to.be.eq(true);
        });

        it('should get reaction counts', async () => {
            if (skipTests) return;

            const testReaction: ICreateEventReactionParams = {
                eventId: TEST_EVENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userLocale: 'en-us',
            };
            await eventReactionsStore.create(testReaction);

            const counts = await eventReactionsStore.getCounts(
                [TEST_EVENT_ID],
                {},
                'userHasLiked',
            );

            expect(counts).to.be.an('array');
            expect(counts.length).to.be.greaterThan(0);
            expect(counts[0].eventId).to.equal(TEST_EVENT_ID);
            expect(Number(counts[0].count)).to.be.greaterThanOrEqual(1);
        });

        it('should delete reactions by user id', async () => {
            if (skipTests) return;

            const testReaction: ICreateEventReactionParams = {
                eventId: TEST_EVENT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userLocale: 'en-us',
            };
            await eventReactionsStore.create(testReaction);

            await eventReactionsStore.delete(TEST_USER_ID);

            const foundReactions = await eventReactionsStore.getByEventId({
                eventId: TEST_EVENT_ID,
                userId: TEST_USER_ID,
            });

            expect(foundReactions).to.be.an('array');
            expect(foundReactions.length).to.equal(0);
        });
    });

    describe('ThoughtReactionsStore - Database Integration', () => {
        it('should create a new thought reaction in the database', async () => {
            if (skipTests) return;

            const testReaction: ICreateThoughtReactionParams = {
                thoughtId: TEST_THOUGHT_ID,
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

            const createdReactions = await thoughtReactionsStore.create(testReaction);

            expect(createdReactions).to.be.an('array');
            expect(createdReactions.length).to.equal(1);
            expect(createdReactions[0].thoughtId).to.equal(TEST_THOUGHT_ID);
        });

        it('should get reactions by thought id', async () => {
            if (skipTests) return;

            const testReaction: ICreateThoughtReactionParams = {
                thoughtId: TEST_THOUGHT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userLocale: 'en-us',
            };
            await thoughtReactionsStore.create(testReaction);

            const foundReactions = await thoughtReactionsStore.getByThoughtId({
                thoughtId: TEST_THOUGHT_ID,
            });

            expect(foundReactions).to.be.an('array');
            expect(foundReactions.length).to.be.greaterThan(0);
            expect(foundReactions[0].thoughtId).to.equal(TEST_THOUGHT_ID);
        });

        it('should update a thought reaction', async () => {
            if (skipTests) return;

            const testReaction: ICreateThoughtReactionParams = {
                thoughtId: TEST_THOUGHT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: false,
                userLocale: 'en-us',
            };
            await thoughtReactionsStore.create(testReaction);

            const updatedReactions = await thoughtReactionsStore.update(
                { thoughtId: TEST_THOUGHT_ID, userId: TEST_USER_ID },
                { userHasLiked: true },
            );

            expect(updatedReactions).to.be.an('array');
            expect(updatedReactions.length).to.equal(1);
            expect(updatedReactions[0].userHasLiked).to.equal(true);
        });

        it('should get reaction counts', async () => {
            if (skipTests) return;

            const testReaction: ICreateThoughtReactionParams = {
                thoughtId: TEST_THOUGHT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userHasLiked: true,
                userLocale: 'en-us',
            };
            await thoughtReactionsStore.create(testReaction);

            const counts = await thoughtReactionsStore.getCounts(
                [TEST_THOUGHT_ID],
                {},
                'userHasLiked',
            );

            expect(counts).to.be.an('array');
            expect(counts.length).to.be.greaterThan(0);
            expect(counts[0].thoughtId).to.equal(TEST_THOUGHT_ID);
            expect(Number(counts[0].count)).to.be.greaterThanOrEqual(1);
        });

        it('should delete reactions by user id', async () => {
            if (skipTests) return;

            const testReaction: ICreateThoughtReactionParams = {
                thoughtId: TEST_THOUGHT_ID,
                userId: TEST_USER_ID,
                userViewCount: 1,
                userHasActivated: true,
                userLocale: 'en-us',
            };
            await thoughtReactionsStore.create(testReaction);

            await thoughtReactionsStore.delete(TEST_USER_ID);

            const foundReactions = await thoughtReactionsStore.getByThoughtId({
                thoughtId: TEST_THOUGHT_ID,
                userId: TEST_USER_ID,
            });

            expect(foundReactions).to.be.an('array');
            expect(foundReactions.length).to.equal(0);
        });

        it('should create batch thought reactions', async () => {
            if (skipTests) return;

            const testReactions: ICreateThoughtReactionParams[] = [
                { thoughtId: TEST_THOUGHT_ID, userId: TEST_USER_ID, userLocale: 'en-us' },
                { thoughtId: TEST_THOUGHT_ID, userId: TEST_USER_ID_2, userLocale: 'en-us' },
            ];

            const createdReactions = await thoughtReactionsStore.create(testReactions);

            expect(createdReactions).to.be.an('array');
            expect(createdReactions.length).to.equal(2);
        });
    });
});
