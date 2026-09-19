/**
 * Integration Tests for Users Service - Leaderboard Period Results
 *
 * Regression for the 2026-09-19 production failure: `closePeriod` is the one raw
 * `INSERT ... SELECT` in this store, and both table names it interpolates are camelCase.
 * Unquoted, Postgres folded them to lowercase and every close failed with
 * `relation "main.leaderboardperiodresults" does not exist`. The unit test stubs the
 * connection, so only a query that actually reaches Postgres can catch that class of bug.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import bcrypt from 'bcrypt';
import { AccessLevels, BrandVariations } from 'therr-js-utilities/constants';
import UsersStore, { ICreateUserParams } from '../../src/store/UsersStore';
import UserLeaderboardScoresStore from '../../src/store/UserLeaderboardScoresStore';
import LeaderboardPeriodResultsStore from '../../src/store/LeaderboardPeriodResultsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - Leaderboard Period Results', () => {
    const TEST_EMAIL_PREFIX = 'lb-close-test-';
    const TEST_EMAIL_DOMAIN = '@example-test.com';
    // A fixed Monday well in the past, so it never collides with a live period.
    const PERIOD_START = '2020-01-06';
    let usersStore: UsersStore;
    let scoresStore: UserLeaderboardScoresStore;
    let resultsStore: LeaderboardPeriodResultsStore;
    let skipTests = false;
    let createdUserIds: string[] = [];

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
        scoresStore = new UserLeaderboardScoresStore(connection);
        resultsStore = new LeaderboardPeriodResultsStore(connection);
    });

    afterEach(async () => {
        if (skipTests) return;

        await Promise.all(createdUserIds.map(async (userId) => {
            try {
                await cleanupTestData('leaderboardPeriodResults', { userId });
                await cleanupTestData('userLeaderboardScores', { userId });
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

    const createTestUser = async (suffix: string): Promise<any> => {
        const testEmail = `${TEST_EMAIL_PREFIX}${suffix}${TEST_EMAIL_DOMAIN}`;
        const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

        const testUser: ICreateUserParams = {
            email: testEmail,
            password: hashedPassword,
            firstName: `First${suffix}`,
            lastName: `Last${suffix}`,
            userName: `lbcloseuser${suffix}`,
            hasAgreedToTerms: true,
            accessLevels: JSON.stringify([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]),
            verificationCodes: JSON.stringify({ email: {} }),
        };

        const createdUsers = await usersStore.createUser(testUser);
        createdUserIds.push(createdUsers[0].id);
        return createdUsers[0];
    };

    describe('closePeriod', () => {
        it('writes a placement row for each scored participant when the raw INSERT reaches Postgres', async () => {
            if (skipTests) return;

            const leader = await createTestUser('lead');
            const runnerUp = await createTestUser('second');

            await scoresStore.incrementPoints(BrandVariations.HABITS, leader.id, PERIOD_START, 50);
            await scoresStore.incrementPoints(BrandVariations.HABITS, runnerUp.id, PERIOD_START, 20);

            const inserted = await resultsStore.closePeriod(BrandVariations.HABITS, PERIOD_START);
            expect(inserted).to.equal(2);

            const leaderResult = await resultsStore.getForUserAndPeriod(BrandVariations.HABITS, leader.id, PERIOD_START);
            expect(leaderResult).to.not.equal(undefined);
            expect(leaderResult?.placement).to.equal(1);
            expect(leaderResult?.score).to.equal(50);
            expect(leaderResult?.participants).to.equal(2);

            const runnerUpResult = await resultsStore.getForUserAndPeriod(BrandVariations.HABITS, runnerUp.id, PERIOD_START);
            expect(runnerUpResult?.placement).to.equal(2);
            expect(runnerUpResult?.participants).to.equal(2);
        });

        it('inserts nothing on a repeat close of the same period', async () => {
            if (skipTests) return;

            const user = await createTestUser('repeat');
            await scoresStore.incrementPoints(BrandVariations.HABITS, user.id, PERIOD_START, 10);

            const first = await resultsStore.closePeriod(BrandVariations.HABITS, PERIOD_START);
            const second = await resultsStore.closePeriod(BrandVariations.HABITS, PERIOD_START);

            expect(first).to.equal(1);
            expect(second).to.equal(0);
            expect(await resultsStore.hasResultsForPeriod(BrandVariations.HABITS, PERIOD_START)).to.equal(true);
        });
    });
});
