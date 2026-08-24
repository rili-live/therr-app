/**
 * Integration Tests for Users Service - Pact resolution from a habit goal
 *
 * `PactsStore.getActiveByUserAndHabitGoal` is how a check-in finds the pacts it counts
 * toward — clients log a check-in against a habit goal, never a pact. Getting its
 * predicate wrong silently mis-attributes check-ins and mis-fires partner notifications,
 * and the predicate mixes a LEFT JOIN with an OR fallback, which is exactly the shape a
 * query-string assertion cannot verify. So it runs against a real database here.
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
import PactsStore from '../../src/store/PactsStore';
import PactMembersStore from '../../src/store/PactMembersStore';
import HabitGoalsStore from '../../src/store/HabitGoalsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - Pact resolution from a habit goal', () => {
    const TEST_EMAIL_PREFIX = 'pact-res-';
    const TEST_EMAIL_DOMAIN = '@example-test.com';

    let usersStore: UsersStore;
    let pactsStore: PactsStore;
    let pactMembersStore: PactMembersStore;
    let habitGoalsStore: HabitGoalsStore;
    let skipTests = false;

    let createdUserIds: string[] = [];
    let createdGoalIds: string[] = [];
    let createdPactIds: string[] = [];

    before(async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.\n');
            skipTests = true;
            return;
        }

        const connection = getTestConnection();
        usersStore = new UsersStore(connection);
        pactsStore = new PactsStore(connection);
        pactMembersStore = new PactMembersStore(connection);
        habitGoalsStore = new HabitGoalsStore(connection);
    });

    afterEach(async () => {
        if (skipTests) return;

        const connection = getTestConnection();

        // pact_members -> pacts -> habit_goals -> users (FK order)
        await Promise.all(createdPactIds.map((pactId) => connection.write
            .query('DELETE FROM "habits"."pact_members" WHERE "pactId" = $1', [pactId])
            .catch(() => null)));
        await Promise.all(createdPactIds.map((pactId) => connection.write
            .query('DELETE FROM "habits"."pacts" WHERE "id" = $1', [pactId])
            .catch(() => null)));
        await Promise.all(createdGoalIds.map((goalId) => connection.write
            .query('DELETE FROM "habits"."habit_goals" WHERE "id" = $1', [goalId])
            .catch(() => null)));
        await Promise.all(createdUserIds.map(async (userId) => {
            try {
                await cleanupTestData('users', { id: userId });
            } catch {
                // Ignore cleanup errors
            }
        }));

        createdPactIds = [];
        createdGoalIds = [];
        createdUserIds = [];
    });

    after(async () => {
        await closeTestConnection();
    });

    const createTestUser = async (suffix: string): Promise<any> => {
        const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
        const testUser: ICreateUserParams = {
            email: `${TEST_EMAIL_PREFIX}${suffix}${TEST_EMAIL_DOMAIN}`,
            password: hashedPassword,
            firstName: `First${suffix}`,
            lastName: `Last${suffix}`,
            userName: `pactres${suffix}`,
            hasAgreedToTerms: true,
            accessLevels: JSON.stringify([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]),
            verificationCodes: JSON.stringify({ email: {} }),
        };

        const createdUsers = await usersStore.createUser(testUser);
        createdUserIds.push(createdUsers[0].id);
        return createdUsers[0];
    };

    const createGoal = async (creatorUserId: string) => {
        const goal = await habitGoalsStore.create({
            name: 'Pact resolution test goal',
            frequencyType: 'daily',
            createdByUserId: creatorUserId,
        });
        createdGoalIds.push(goal.id);
        return goal;
    };

    const createActivePact = async (creatorUserId: string, partnerUserId: string, habitGoalId: string) => {
        const pact = await pactsStore.create({
            creatorUserId,
            partnerUserId,
            habitGoalId,
            startDate: new Date(),
            durationDays: 30,
        });
        createdPactIds.push(pact.id);
        await pactsStore.update(pact.id, { status: 'active' });
        return pact;
    };

    it('resolves an active pact for a member whose membership is active', async () => {
        if (skipTests) return;

        const creator = await createTestUser('a1');
        const partner = await createTestUser('a2');
        const goal = await createGoal(creator.id);
        const pact = await createActivePact(creator.id, partner.id, goal.id);

        await pactMembersStore.create({
            pactId: pact.id, userId: creator.id, role: 'creator', status: 'active',
        });
        await pactMembersStore.create({
            pactId: pact.id, userId: partner.id, role: 'partner', status: 'active',
        });

        const forPartner = await pactsStore.getActiveByUserAndHabitGoal(partner.id, goal.id);

        expect(forPartner.map((p: any) => p.id)).to.deep.equal([pact.id]);
    });

    // The regression: declining an already-active 1:1 pact marks the member `left` but
    // leaves `pacts.partnerUserId` pointing at them. Treating that column as an
    // alternative to membership went on crediting their check-ins to the pact they left,
    // and pushing "your accountability partner checked in" to the creator.
    it('does not resolve a pact for a member who left it, even though partnerUserId still names them', async () => {
        if (skipTests) return;

        const creator = await createTestUser('b1');
        const partner = await createTestUser('b2');
        const goal = await createGoal(creator.id);
        const pact = await createActivePact(creator.id, partner.id, goal.id);

        await pactMembersStore.create({
            pactId: pact.id, userId: creator.id, role: 'creator', status: 'active',
        });
        await pactMembersStore.create({
            pactId: pact.id, userId: partner.id, role: 'partner', status: 'left',
        });

        const forPartner = await pactsStore.getActiveByUserAndHabitGoal(partner.id, goal.id);
        expect(forPartner).to.deep.equal([]);

        // The creator is unaffected — the pact keeps running for everyone else.
        const forCreator = await pactsStore.getActiveByUserAndHabitGoal(creator.id, goal.id);
        expect(forCreator.map((p: any) => p.id)).to.deep.equal([pact.id]);
    });

    it('does not resolve a pact for an invitee who has not accepted yet', async () => {
        if (skipTests) return;

        const creator = await createTestUser('c1');
        const partner = await createTestUser('c2');
        const goal = await createGoal(creator.id);
        const pact = await createActivePact(creator.id, partner.id, goal.id);

        await pactMembersStore.create({
            pactId: pact.id, userId: creator.id, role: 'creator', status: 'active',
        });
        await pactMembersStore.create({
            pactId: pact.id, userId: partner.id, role: 'partner', status: 'pending',
        });

        const forPartner = await pactsStore.getActiveByUserAndHabitGoal(partner.id, goal.id);

        expect(forPartner).to.deep.equal([]);
    });

    // Pacts created before habits.pact_members existed have no member rows at all, so the
    // creator/partner columns are the only record of who is in them.
    it('falls back to the creator/partner columns when the pact has no member rows', async () => {
        if (skipTests) return;

        const creator = await createTestUser('d1');
        const partner = await createTestUser('d2');
        const goal = await createGoal(creator.id);
        const pact = await createActivePact(creator.id, partner.id, goal.id);

        const forCreator = await pactsStore.getActiveByUserAndHabitGoal(creator.id, goal.id);
        const forPartner = await pactsStore.getActiveByUserAndHabitGoal(partner.id, goal.id);

        expect(forCreator.map((p: any) => p.id)).to.deep.equal([pact.id]);
        expect(forPartner.map((p: any) => p.id)).to.deep.equal([pact.id]);
    });

    it('does not resolve a pact for someone who is neither a member nor named on it', async () => {
        if (skipTests) return;

        const creator = await createTestUser('e1');
        const partner = await createTestUser('e2');
        const stranger = await createTestUser('e3');
        const goal = await createGoal(creator.id);
        const pact = await createActivePact(creator.id, partner.id, goal.id);

        await pactMembersStore.create({
            pactId: pact.id, userId: creator.id, role: 'creator', status: 'active',
        });

        const forStranger = await pactsStore.getActiveByUserAndHabitGoal(stranger.id, goal.id);

        expect(forStranger).to.deep.equal([]);
    });

    it('returns every active pact a goal backs, earliest start first', async () => {
        if (skipTests) return;

        const creator = await createTestUser('f1');
        const partner = await createTestUser('f2');
        const goal = await createGoal(creator.id);

        const older = await createActivePact(creator.id, partner.id, goal.id);
        const newer = await createActivePact(creator.id, partner.id, goal.id);
        await pactsStore.update(older.id, { startDate: new Date('2026-01-01T00:00:00Z') });
        await pactsStore.update(newer.id, { startDate: new Date('2026-06-01T00:00:00Z') });

        await Promise.all([older, newer].map((p) => pactMembersStore.create({
            pactId: p.id, userId: creator.id, role: 'creator', status: 'active',
        })));

        const resolved = await pactsStore.getActiveByUserAndHabitGoal(creator.id, goal.id);

        expect(resolved.map((p: any) => p.id)).to.deep.equal([older.id, newer.id]);
    });
});
