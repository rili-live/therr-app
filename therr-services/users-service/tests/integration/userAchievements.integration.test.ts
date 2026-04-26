/**
 * Integration Tests for Users Service - User Achievements
 *
 * Phase 6 verification scenario 5: achievement isolation per brand.
 * A user enrolled in Therr and Habits must see only the achievements
 * they earned in the brand whose context they are reading from.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import bcrypt from 'bcrypt';
import { AccessLevels } from 'therr-js-utilities/constants';
import UsersStore, { ICreateUserParams } from '../../src/store/UsersStore';
import UserAchievementsStore from '../../src/store/UserAchievementsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - User Achievements', () => {
    const TEST_EMAIL_PREFIX = 'ach-test-';
    const TEST_EMAIL_DOMAIN = '@example-test.com';
    let usersStore: UsersStore;
    let userAchievementsStore: UserAchievementsStore;
    let skipTests = false;
    let createdUserIds: string[] = [];
    let createdAchievementIds: string[] = [];

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
        userAchievementsStore = new UserAchievementsStore(connection);
    });

    afterEach(async () => {
        if (skipTests) return;

        await Promise.all(createdAchievementIds.map(async (id) => {
            try {
                await cleanupTestData('userAchievements', { id });
            } catch {
                // Ignore cleanup errors
            }
        }));
        createdAchievementIds = [];

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

    const createTestUser = async (suffix: string): Promise<any> => {
        const testEmail = `${TEST_EMAIL_PREFIX}${suffix}${TEST_EMAIL_DOMAIN}`;
        const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

        const testUser: ICreateUserParams = {
            email: testEmail,
            password: hashedPassword,
            firstName: `First${suffix}`,
            lastName: `Last${suffix}`,
            userName: `achuser${suffix}`,
            hasAgreedToTerms: true,
            accessLevels: JSON.stringify([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]),
            verificationCodes: JSON.stringify({ email: {} }),
        };

        const createdUsers = await usersStore.createUser(testUser);
        createdUserIds.push(createdUsers[0].id);
        return createdUsers[0];
    };

    describe('Brand Isolation (Phase 6 scenario 5)', () => {
        it('returns only same-brand achievements when the user is enrolled in two brands', async () => {
            if (skipTests) return;

            const user = await createTestUser('iso-1');

            const therrCreated = await userAchievementsStore.create('therr', [{
                userId: user.id,
                achievementId: 'explorer_1_1',
                achievementClass: 'explorer',
                achievementTier: '1_1',
                progressCount: 1,
            }]);
            createdAchievementIds.push(therrCreated[0].id);

            const habitsCreated = await userAchievementsStore.create('habits', [{
                userId: user.id,
                achievementId: 'habitBuilder_1_1',
                achievementClass: 'habitBuilder',
                achievementTier: '1_1',
                progressCount: 1,
            }]);
            createdAchievementIds.push(habitsCreated[0].id);

            const therrList = await userAchievementsStore.get('therr', { userId: user.id });
            const habitsList = await userAchievementsStore.get('habits', { userId: user.id });

            const therrIds = therrList.map((a) => a.id);
            const habitsIds = habitsList.map((a) => a.id);

            expect(therrIds).to.include(therrCreated[0].id);
            expect(therrIds).to.not.include(habitsCreated[0].id);
            expect(habitsIds).to.include(habitsCreated[0].id);
            expect(habitsIds).to.not.include(therrCreated[0].id);
        });

        it('stamps brandVariation on insert and excludes the row under a different brand context', async () => {
            if (skipTests) return;

            const user = await createTestUser('iso-2');

            const created = await userAchievementsStore.create('habits', [{
                userId: user.id,
                achievementId: 'consistency_1_1',
                achievementClass: 'consistency',
                achievementTier: '1_1',
                progressCount: 1,
            }]);
            createdAchievementIds.push(created[0].id);

            expect(created[0].brandVariation).to.equal('habits');

            const reread = await userAchievementsStore.getById('habits', created[0].id);
            expect(reread).to.not.equal(undefined);
            expect(reread.brandVariation).to.equal('habits');

            // Wrong-brand context must not surface the row.
            const wrongBrand = await userAchievementsStore.getById('therr', created[0].id);
            expect(wrongBrand).to.equal(undefined);
        });
    });
});
