import { expect } from 'chai';
import sinon from 'sinon';
import { BrandVariations } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { getStreakByHabit } from '../../src/handlers/streaks';
import { DEFAULT_STARTING_GRACE_PERIOD_DAYS } from '../../src/utilities/streakHelpers';

/**
 * `GET /habits/streaks/habit/:habitGoalId` for a habit with no streak row yet.
 *
 * The ladder is created lazily — on the first check-in, or on pact acceptance —
 * so every habit passes through this state between being created and being done
 * once. The handler answers with a placeholder rather than a 404, which is
 * right, but the placeholder used to carry only the fields the handler itself
 * computed.
 *
 * It omitted `gracePeriodDays` and `graceDaysUsed`, and the mobile habit detail
 * screen renders `gracePeriodDays - graceDaysUsed` straight into its "Streak
 * Freezes Left" tile. `undefined - undefined` is NaN, so a brand-new solo habit
 * told the user "NaN" from the moment they created it until their first
 * check-in. Nothing threw, nothing logged, and the number was wrong only on the
 * screen a new user sees first.
 *
 * So: the placeholder has to carry the same shape a real row does, with the
 * values `StreaksStore.create` is about to write.
 */
describe('getStreakByHabit with no streak row', () => {
    const USER = 'user-1';
    const GOAL = 'goal-1';

    const makeRes = () => {
        const res: any = {
            statusCode: undefined,
            body: undefined,
            status(code: number) {
                res.statusCode = code;
                return res;
            },
            send(payload: any) {
                res.body = payload;
                return res;
            },
        };
        return res;
    };

    const makeReq = () => ({
        headers: {
            'x-userid': USER,
            'x-localecode': 'en-us',
            'x-brand-variation': BrandVariations.HABITS,
        },
        params: { habitGoalId: GOAL },
        query: {},
        body: {},
    });

    afterEach(() => {
        sinon.restore();
    });

    it('carries the grace-day fields so a client cannot compute NaN', async () => {
        sinon.stub(Store.streaks, 'getByUserAndHabit').resolves(undefined as any);

        const res = makeRes();
        await getStreakByHabit(makeReq() as any, res, (() => {}) as any);

        expect(res.statusCode).to.equal(200);
        expect(res.body.gracePeriodDays).to.be.a('number');
        expect(res.body.graceDaysUsed).to.be.a('number');
        expect(res.body.gracePeriodDays - res.body.graceDaysUsed).to.not.be.NaN;
    });

    it('reports the freeze allowance a new streak actually starts with', async () => {
        // Not merely non-NaN: a habit with no check-ins does start with one
        // freeze, and the number the user is shown before their first check-in
        // has to be the one they will still have after it.
        sinon.stub(Store.streaks, 'getByUserAndHabit').resolves(undefined as any);

        const res = makeRes();
        await getStreakByHabit(makeReq() as any, res, (() => {}) as any);

        expect(res.body.gracePeriodDays).to.equal(DEFAULT_STARTING_GRACE_PERIOD_DAYS);
        expect(res.body.graceDaysUsed).to.equal(0);
    });

    it('identifies which habit it is describing, and says the streak is not running', async () => {
        sinon.stub(Store.streaks, 'getByUserAndHabit').resolves(undefined as any);

        const res = makeRes();
        await getStreakByHabit(makeReq() as any, res, (() => {}) as any);

        expect(res.body.userId).to.equal(USER);
        expect(res.body.habitGoalId).to.equal(GOAL);
        expect(res.body.currentStreak).to.equal(0);
        expect(res.body.longestStreak).to.equal(0);
        expect(res.body.isActive).to.equal(false);
        expect(res.body.lastCompletedDate).to.equal(null);
    });

    it('still passes a real row through untouched', async () => {
        sinon.stub(Store.streaks, 'getByUserAndHabit').resolves({
            id: 'streak-1',
            userId: USER,
            habitGoalId: GOAL,
            currentStreak: 9,
            longestStreak: 12,
            gracePeriodDays: 2,
            graceDaysUsed: 1,
            lastCompletedDate: '2026-09-18',
            isActive: true,
        } as any);

        const res = makeRes();
        await getStreakByHabit(makeReq() as any, res, (() => {}) as any);

        expect(res.body.currentStreak).to.equal(9);
        expect(res.body.gracePeriodDays).to.equal(2);
        expect(res.body.graceDaysUsed).to.equal(1);
        expect(res.body.riskLevel).to.be.a('string');
    });
});
