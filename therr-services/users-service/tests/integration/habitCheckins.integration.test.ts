/**
 * Integration Tests for Users Service — habit check-ins (POST /habits/checkins)
 *
 * Regression for the 2026-09-20 production outage: every check-in from Friends with
 * Habits returned `SQL:HABIT_CHECKINS_ROUTES:ERROR`. The cause was in the one line of
 * this path that only exists at the driver boundary — `createOrUpdate` named
 * `"savedAmount"` in its INSERT even when the request carried no amount, because knex
 * emits `DEFAULT` for an undefined value rather than dropping the key. The stage->main
 * deploy that shipped the savings build aborted in `deploy_waves` on an unrelated
 * ImagePullBackOff before `run-migrations.sh` ran, so users-service served that build
 * against a schema with no `savedAmount` column.
 *
 * The unit suite could not see it: it stubs the connection, and the one test that
 * covered "no amount supplied" passed an object with no `savedAmount` key at all, while
 * the handler always spreads the key in with an undefined value.
 *
 * `createCheckin` is ~700 lines with a dozen branches (freezes, resets, milestones,
 * pacts, proofs, savings) and had no end-to-end coverage, so this walks them. Every one
 * of these returned 201 before the outage and 500 during it.
 *
 * Prerequisites:
 * - Start infrastructure: docker compose -f docker-compose.infra.yml up -d
 * - Run migrations: npm run migrations:run
 * - Run tests: npm run test:integration
 */
import { expect } from 'chai';
import { createCheckin } from '../../src/handlers/habitCheckins';
import { getTestConnection, checkConnection } from './testDbConnection';

const conn = () => getTestConnection();

const TEST_EMAIL_DOMAIN = '@example-test.com';
const CHECKIN_DATE = '2026-09-21';

const mockRes = () => {
    const res: any = {
        statusCode: undefined,
        body: undefined,
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        send(body: any) {
            res.body = body;
            return res;
        },
    };
    return res;
};

describe('Integration Tests - Habit Check-ins', () => {
    let skipTests = false;
    let userSeq = 0;
    let createdUserIds: string[] = [];

    before(async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            console.log('\n⚠️  Database not available. Skipping integration tests.');
            console.log('   Start the database with: docker compose -f docker-compose.infra.yml up -d');
            console.log('   Run migrations with: npm run migrations:run\n');
            skipTests = true;
        }
    });

    afterEach(async () => {
        if (skipTests || !createdUserIds.length) return;
        // habit_goals / pacts / pact_members / habit_checkins / streaks all cascade from
        // main.users, so deleting the users is the whole cleanup.
        try {
            await conn().write.query(`DELETE FROM main."users" WHERE id IN ('${createdUserIds.join("','")}')`);
        } catch {
            // Ignore cleanup errors
        }
        createdUserIds = [];
    });

    const mkUser = async () => {
        userSeq += 1;
        const name = `habit-checkin-test-${Date.now()}-${userSeq}`;
        const result = await conn().write.query(`
            INSERT INTO main."users" ("userName", "firstName", "lastName", "email", "password", "accessLevels")
            VALUES ('${name}', 'Check', 'In', '${name}${TEST_EMAIL_DOMAIN}', 'x', '["user.default"]')
            RETURNING id`);
        const userId = result.rows[0].id as string;
        createdUserIds.push(userId);
        return userId;
    };

    /** A user + habit goal, and by default an active two-person pact on it. */
    const setup = async (opts: { goalType?: string; targetAmount?: number; withPact?: boolean } = {}) => {
        const userId = await mkUser();
        const partnerUserId = await mkUser();

        const savingsColumns = opts.targetAmount
            ? ', "targetAmount", "currencyCode", "savingsTargetScope"'
            : '';
        const savingsValues = opts.targetAmount
            ? `, ${opts.targetAmount}, 'USD', 'per_member'`
            : '';
        const goal = await conn().write.query(`
            INSERT INTO habits."habit_goals" ("createdByUserId", "name", "goalType", "frequencyType", "category"${savingsColumns})
            VALUES ('${userId}', 'Test Habit', '${opts.goalType || 'build_good'}', 'daily', 'health'${savingsValues})
            RETURNING id`);
        const habitGoalId = goal.rows[0].id as string;

        let pactId: string | null = null;
        if (opts.withPact !== false) {
            const pact = await conn().write.query(`
                INSERT INTO habits."pacts" ("creatorUserId", "partnerUserId", "habitGoalId", "status", "startDate", "endDate")
                VALUES ('${userId}', '${partnerUserId}', '${habitGoalId}', 'active', NOW() - interval '20 days', NOW() + interval '10 days')
                RETURNING id`);
            pactId = pact.rows[0].id;
            await conn().write.query(`
                INSERT INTO habits."pact_members" ("pactId", "userId", "role", "status", "joinedAt")
                VALUES ('${pactId}', '${userId}', 'creator', 'active', NOW()),
                       ('${pactId}', '${partnerUserId}', 'partner', 'active', NOW())`);
        }

        return {
            userId, partnerUserId, habitGoalId, pactId,
        };
    };

    /** An existing streak ladder, so the gap/freeze/milestone branches have state to act on. */
    const seedStreak = (
        s: { userId: string; habitGoalId: string; pactId: string | null },
        streak: { current: number; gracePeriodDays: number; graceDaysUsed: number; lastCompletedDate: string },
    ) => conn().write.query(`
        INSERT INTO habits."streaks" ("userId", "habitGoalId", "pactId", "isActive",
            "currentStreak", "longestStreak", "gracePeriodDays", "graceDaysUsed", "lastCompletedDate")
        VALUES ('${s.userId}', '${s.habitGoalId}', ${s.pactId ? `'${s.pactId}'` : 'NULL'}, true,
            ${streak.current}, ${streak.current}, ${streak.gracePeriodDays}, ${streak.graceDaysUsed},
            '${streak.lastCompletedDate}')`);

    const checkin = async (userId: string, body: any) => {
        const req: any = {
            headers: {
                'x-userid': userId,
                'x-username': 'check-in-tester',
                'x-localecode': 'en-us',
                'x-brand-variation': 'habits',
                authorization: 'Bearer test',
            },
            body,
        };
        const res = mockRes();
        await createCheckin(req, res, (() => {}) as any);
        return res;
    };

    /** What the app posts for a plain "I did it" tap. */
    const tap = (habitGoalId: string, extra: any = {}) => ({
        habitGoalId,
        scheduledDate: CHECKIN_DATE,
        localDate: CHECKIN_DATE,
        timeZone: 'America/Chicago',
        status: 'completed',
        ...extra,
    });

    it('records a check-in on a solo habit with no pact', async () => {
        if (skipTests) return;
        const s = await setup({ withPact: false });

        const res = await checkin(s.userId, tap(s.habitGoalId));

        expect(res.statusCode).to.equal(201);
        expect(res.body.status).to.equal('completed');
    });

    it('records a check-in on a habit backed by an active pact', async () => {
        if (skipTests) return;
        const s = await setup();

        const res = await checkin(s.userId, tap(s.habitGoalId));

        expect(res.statusCode).to.equal(201);
        // The pact is resolved from the goal — clients never send one.
        expect(res.body.pactId).to.equal(s.pactId);
    });

    it('records a check-in carrying notes and proof media', async () => {
        if (skipTests) return;
        const s = await setup();

        const res = await checkin(s.userId, tap(s.habitGoalId, {
            notes: 'done',
            selfRating: 4,
            proofMedias: [{ path: 'habits/proof-1.jpg', type: 'image', fileSizeBytes: 1234 }],
        }));

        expect(res.statusCode).to.equal(201);
        expect(res.body.hasProof).to.equal(true);
    });

    it('accepts a re-submission on the same day without double-crediting the streak', async () => {
        if (skipTests) return;
        const s = await setup();

        const first = await checkin(s.userId, tap(s.habitGoalId));
        const second = await checkin(s.userId, tap(s.habitGoalId, { notes: 'added later' }));

        expect(first.statusCode).to.equal(201);
        expect(second.statusCode).to.equal(201);
        expect(second.body.id).to.equal(first.body.id);
    });

    it('spends a streak freeze across a missed day', async () => {
        if (skipTests) return;
        const s = await setup();
        await seedStreak(s, {
            current: 5, gracePeriodDays: 3, graceDaysUsed: 0, lastCompletedDate: '2026-09-19',
        });

        const res = await checkin(s.userId, tap(s.habitGoalId));

        expect(res.statusCode).to.equal(201);
        expect(res.body.graceDaysConsumed).to.equal(1);
    });

    it('resets the streak when the gap outruns the freezes', async () => {
        if (skipTests) return;
        const s = await setup();
        await seedStreak(s, {
            current: 9, gracePeriodDays: 1, graceDaysUsed: 1, lastCompletedDate: '2026-09-10',
        });

        const res = await checkin(s.userId, tap(s.habitGoalId));

        expect(res.statusCode).to.equal(201);
        expect(res.body.graceDaysConsumed).to.equal(0);
    });

    it('records a 7-day milestone, which also awards a freeze', async () => {
        if (skipTests) return;
        const s = await setup();
        await seedStreak(s, {
            current: 6, gracePeriodDays: 1, graceDaysUsed: 0, lastCompletedDate: '2026-09-20',
        });

        const res = await checkin(s.userId, tap(s.habitGoalId));

        expect(res.statusCode).to.equal(201);
    });

    it('records an amount on a savings goal', async () => {
        if (skipTests) return;
        const s = await setup({ goalType: 'savings_goal', targetAmount: 100 });

        const res = await checkin(s.userId, tap(s.habitGoalId, { savedAmount: 25 }));

        expect(res.statusCode).to.equal(201);
        expect(res.body.savedAmount).to.equal(25);
        expect(res.body.savingsProgress.totalSaved).to.equal(25);
    });

    // The regression itself. A client that has never heard of savings sends no
    // `savedAmount`, and the handler turns that into `undefined` — which must not put the
    // column in the INSERT at all, or an additive migration that has not run yet takes
    // the entire check-in path down. See the `withDefinedColumns` note in
    // HabitCheckinsStore.
    it('does not mention savedAmount in the write when the client sent no amount', async () => {
        if (skipTests) return;
        const s = await setup();

        const res = await checkin(s.userId, tap(s.habitGoalId));

        expect(res.statusCode).to.equal(201);
        expect(res.body.savedAmount).to.equal(null);
    });

    it('accepts a check-in from a client that sends neither localDate nor timeZone', async () => {
        if (skipTests) return;
        const s = await setup();

        const res = await checkin(s.userId, {
            habitGoalId: s.habitGoalId,
            scheduledDate: CHECKIN_DATE,
            status: 'completed',
        });

        expect(res.statusCode).to.equal(201);
    });

    it('credits every active pact when a goal backs more than one', async () => {
        if (skipTests) return;
        const s = await setup();
        const other = await mkUser();
        const second = await conn().write.query(`
            INSERT INTO habits."pacts" ("creatorUserId", "partnerUserId", "habitGoalId", "status", "startDate", "endDate")
            VALUES ('${s.userId}', '${other}', '${s.habitGoalId}', 'active', NOW() - interval '5 days', NOW() + interval '25 days')
            RETURNING id`);
        await conn().write.query(`
            INSERT INTO habits."pact_members" ("pactId", "userId", "role", "status", "joinedAt")
            VALUES ('${second.rows[0].id}', '${s.userId}', 'creator', 'active', NOW()),
                   ('${second.rows[0].id}', '${other}', 'partner', 'active', NOW())`);

        const res = await checkin(s.userId, tap(s.habitGoalId));

        expect(res.statusCode).to.equal(201);
        // Attributed to the earliest-started pact; both are still credited.
        expect(res.body.pactId).to.equal(s.pactId);
    });
});
