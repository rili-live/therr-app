/**
 * Integration Tests for Users Service - User Interests
 *
 * `incrementUserInterestsByKey` is hand-written raw SQL (INSERT .. SELECT .. ON CONFLICT
 * with positional bindings spread across three clauses). The unit tests assert on the
 * *generated string* and never execute it, so a bindings-order mistake, a wrong conflict
 * target, or a plain syntax error passes every unit test and only fails in production.
 * These tests run the statement against a real Postgres.
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
import UserInterestsStore from '../../src/store/UserInterestsStore';
import {
    getTestConnection,
    closeTestConnection,
    checkConnection,
    cleanupTestData,
} from './testDbConnection';

describe('Integration Tests - User Interests', () => {
    const TEST_EMAIL_PREFIX = 'interests-test-';
    const TEST_EMAIL_DOMAIN = '@example-test.com';
    let usersStore: UsersStore;
    let userInterestsStore: UserInterestsStore;
    let skipTests = false;
    let createdUserIds: string[] = [];
    // Two real rows from main.interests — the upsert joins on displayNameKey, so it cannot
    // be exercised with invented keys.
    let interestKeyA: string;
    let interestKeyB: string;
    let interestIdA: string;

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
        userInterestsStore = new UserInterestsStore(connection);

        const seeded = await connection.read.query('SELECT id, "displayNameKey" FROM main."interests" ORDER BY id LIMIT 2');
        if (seeded.rows.length < 2) {
            console.log('\n⚠️  main.interests is not seeded. Skipping user interest integration tests.\n');
            skipTests = true;
            return;
        }
        interestIdA = seeded.rows[0].id;
        interestKeyA = seeded.rows[0].displayNameKey;
        interestKeyB = seeded.rows[1].displayNameKey;
    });

    afterEach(async () => {
        if (skipTests) return;

        // userInterests rows cascade on user delete, but delete them explicitly so a failed
        // assertion can't leave a row that changes the next test's upsert into an update.
        await Promise.all(createdUserIds.map(async (userId) => {
            try {
                await cleanupTestData('userInterests', { userId });
            } catch {
                // Ignore cleanup errors
            }
        }));
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
        const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

        const testUser: ICreateUserParams = {
            email: `${TEST_EMAIL_PREFIX}${suffix}${TEST_EMAIL_DOMAIN}`,
            password: hashedPassword,
            firstName: `First${suffix}`,
            lastName: `Last${suffix}`,
            userName: `interests${suffix}`,
            hasAgreedToTerms: true,
            accessLevels: JSON.stringify([AccessLevels.DEFAULT, AccessLevels.EMAIL_VERIFIED]),
            verificationCodes: JSON.stringify({ email: {} }),
        };

        const createdUsers = await usersStore.createUser(testUser);
        createdUserIds.push(createdUsers[0].id);
        return createdUsers[0];
    };

    const readRow = async (userId: string, interestId: string) => {
        const connection = getTestConnection();
        const result = await connection.read.query(
            'SELECT * FROM main."userInterests" WHERE "userId" = $1 AND "interestId" = $2',
            [userId, interestId],
        );
        return result.rows[0];
    };

    describe('incrementUserInterestsByKey', () => {
        // The whole statement — bindings order, conflict target, POWER/EXTRACT decay — is
        // only ever proven by executing it.
        it('executes against a real schema and returns the affected rows', async () => {
            if (skipTests) return;

            const user = await createTestUser('exec');

            const rows = await userInterestsStore.incrementUserInterestsByKey(user.id, {
                [interestKeyA]: 3,
                [interestKeyB]: 7,
            });

            expect(rows).to.be.an('array');
            expect(rows.length).to.equal(2);
        });

        // The E2 gap this change exists to close: engagement on an interest the user never
        // declared used to be silently discarded by the UPDATE .. FROM.
        it('creates a discounted, disabled, implicit row for an undeclared interest', async () => {
            if (skipTests) return;

            const user = await createTestUser('discover');

            await userInterestsStore.incrementUserInterestsByKey(user.id, { [interestKeyA]: 10 });

            const row = await readRow(user.id, interestIdA);
            expect(row, 'expected a row to be created').to.not.eq(undefined);
            expect(row.source).to.eq('implicit');
            expect(row.isEnabled).to.eq(false);
            expect(row.engagementCount).to.eq(10);
            // 10 * IMPLICIT_DISCOVERY_DISCOUNT (0.6) — the discount applies only on create.
            expect(row.affinityScore).to.be.closeTo(6, 1e-4);
            expect(row.lastEngagedAt).to.not.eq(null);
        });

        // A row the user actually declared must not be re-flagged implicit or re-disabled,
        // and must take the full undiscounted weight.
        it('adds the undiscounted weight to an existing declared row without disabling it', async () => {
            if (skipTests) return;

            const user = await createTestUser('declared');
            await userInterestsStore.create([{
                userId: user.id,
                interestId: interestIdA,
                isEnabled: true,
                score: 5,
                engagementCount: 4,
            }]);

            await userInterestsStore.incrementUserInterestsByKey(user.id, { [interestKeyA]: 5 });

            const row = await readRow(user.id, interestIdA);
            expect(row.source).to.eq('declared');
            expect(row.isEnabled).to.eq(true);
            expect(row.engagementCount).to.eq(9);
            // Seeded affinityScore was 0 and lastEngagedAt null, so decay is a no-op factor
            // of 1 and the raw (not discounted) weight lands.
            expect(row.affinityScore).to.be.closeTo(5, 1e-4);
        });

        // COALESCE(lastEngagedAt, NOW()) must make the decay factor exactly 1 for a row that
        // has never been engaged — without it, EXTRACT over a NULL yields NULL and the whole
        // affinityScore expression collapses to NULL.
        it('does not null out affinityScore when lastEngagedAt has never been set', async () => {
            if (skipTests) return;

            const user = await createTestUser('nullengaged');
            await userInterestsStore.create([{
                userId: user.id,
                interestId: interestIdA,
                isEnabled: true,
            }]);

            await userInterestsStore.incrementUserInterestsByKey(user.id, { [interestKeyA]: 2 });

            const row = await readRow(user.id, interestIdA);
            expect(row.affinityScore).to.not.eq(null);
            expect(row.affinityScore).to.be.closeTo(2, 1e-4);
        });

        // Decay is applied on write, so a row last engaged one half-life ago keeps half of
        // its stored score before the new weight is added.
        it('halves a stored affinity that is one half-life stale before adding the new weight', async () => {
            if (skipTests) return;

            const connection = getTestConnection();
            const user = await createTestUser('decay');
            await userInterestsStore.create([{
                userId: user.id,
                interestId: interestIdA,
                isEnabled: true,
            }]);
            await connection.write.query(
                `UPDATE main."userInterests"
                    SET "affinityScore" = 40, "lastEngagedAt" = NOW() - INTERVAL '45 days'
                  WHERE "userId" = $1 AND "interestId" = $2`,
                [user.id, interestIdA],
            );

            await userInterestsStore.incrementUserInterestsByKey(user.id, { [interestKeyA]: 1 });

            const row = await readRow(user.id, interestIdA);
            // 40 -> ~20 after one 45-day half-life, + 1 for this engagement.
            expect(row.affinityScore).to.be.closeTo(21, 0.05);
        });

        // Repeated flushes hit the ON CONFLICT branch; the conflict target has to line up
        // with the (userId, interestId) unique constraint or the second call raises.
        it('upserts idempotently across repeated flushes rather than duplicating rows', async () => {
            if (skipTests) return;

            const connection = getTestConnection();
            const user = await createTestUser('repeat');

            await userInterestsStore.incrementUserInterestsByKey(user.id, { [interestKeyA]: 1 });
            await userInterestsStore.incrementUserInterestsByKey(user.id, { [interestKeyA]: 2 });
            await userInterestsStore.incrementUserInterestsByKey(user.id, { [interestKeyA]: 3 });

            const count = await connection.read.query(
                'SELECT COUNT(*)::integer AS total FROM main."userInterests" WHERE "userId" = $1',
                [user.id],
            );
            expect(count.rows[0].total).to.eq(1);

            const row = await readRow(user.id, interestIdA);
            expect(row.engagementCount).to.eq(6);
        });

        // A flush whose keys match no row in main.interests joins to nothing. It must be a
        // clean no-op, not a constraint violation from an INSERT of NULL interestId.
        it('is a no-op when no key matches a known interest', async () => {
            if (skipTests) return;

            const connection = getTestConnection();
            const user = await createTestUser('unknown');

            const rows = await userInterestsStore.incrementUserInterestsByKey(user.id, {
                'interests.notAReal.interestKey': 4,
            });

            expect(rows).to.be.an('array');
            expect(rows.length).to.eq(0);

            const count = await connection.read.query(
                'SELECT COUNT(*)::integer AS total FROM main."userInterests" WHERE "userId" = $1',
                [user.id],
            );
            expect(count.rows[0].total).to.eq(0);
        });

        // Keys arrive from content records and are interpolated into a raw statement.
        it('does not let a quote in an interest key break out of the statement', async () => {
            if (skipTests) return;

            const user = await createTestUser('quoted');

            const rows = await userInterestsStore.incrementUserInterestsByKey(user.id, {
                "');DROP TABLE main.\"userInterests\";--": 1,
                [interestKeyA]: 1,
            });

            // The injected key simply matches no interest; the legitimate one still applies.
            expect(rows.length).to.eq(1);
            const row = await readRow(user.id, interestIdA);
            expect(row.engagementCount).to.eq(1);
        });
    });

    describe('getByUserIds', () => {
        // getTopRankedConnections reads the shadow columns off these rows, so they have to
        // survive the join + formatSQLJoinAsJSON pass.
        it('returns the affinity columns alongside the legacy engagement columns', async () => {
            if (skipTests) return;

            const user = await createTestUser('read');
            await userInterestsStore.create([{
                userId: user.id,
                interestId: interestIdA,
                isEnabled: true,
                engagementCount: 3,
            }]);
            await userInterestsStore.incrementUserInterestsByKey(user.id, { [interestKeyA]: 2 });

            const rows = await userInterestsStore.getByUserIds([user.id], { isEnabled: true }, 'engagementCount');
            const row = rows.find((r) => r.interestId === interestIdA);

            expect(row, 'expected the enabled interest to come back').to.not.eq(undefined);
            expect(row.engagementCount).to.eq(5);
            expect(row.affinityScore).to.be.a('number');
            expect(row.negativeCount).to.eq(0);
            expect(row.lastEngagedAt).to.not.eq(undefined);
        });
    });
});
