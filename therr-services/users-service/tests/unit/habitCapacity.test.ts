import { expect } from 'chai';
import sinon from 'sinon';
import {
    AccessLevels,
    BrandVariations,
    HABITS_FREE_HABIT_LIMIT,
    HABITS_FREE_HABIT_STARTS_PER_WINDOW,
    HABITS_FREE_HABIT_START_WINDOW_DAYS,
} from 'therr-js-utilities/constants';
import Store from '../../src/store';
import {
    checkHabitCapacity,
    getHabitCapacityFailOpenCount,
    getHabitCapacityStatus,
    getStartWindowSince,
    isHabitCapExempt,
    resetHabitCapacityFailOpenCount,
} from '../../src/handlers/helpers/habitCapacity';

/**
 * The Friends with Habits free-tier gate.
 *
 * These exercise the real helper rather than a mirrored copy of its decision
 * tree, because the failure modes worth guarding are all about *what it reads*:
 * which access levels exempt, which brands are in scope, and what it does when
 * the database is unavailable. A mirrored implementation would agree with
 * itself and prove none of that.
 */
describe('Habit capacity (HABITS free-tier gate)', () => {
    let findUserStub: sinon.SinonStub;
    let countActiveStub: sinon.SinonStub;
    let countStartedStub: sinon.SinonStub;

    beforeEach(() => {
        findUserStub = sinon.stub(Store.users, 'findUser');
        countActiveStub = sinon.stub(Store.userHabits, 'countActiveByUser');
        // Default: nothing started recently, so only the active cap is in play
        // unless a case says otherwise.
        countStartedStub = sinon.stub(Store.userHabits, 'countStartedSinceByUser').resolves(0);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('isHabitCapExempt', () => {
        it('exempts every non-HABITS brand', () => {
            expect(isHabitCapExempt(BrandVariations.THERR, [])).to.equal(true);
            expect(isHabitCapExempt(BrandVariations.TEEM, [])).to.equal(true);
            expect(isHabitCapExempt(undefined, [])).to.equal(true);
        });

        it('does not exempt a free HABITS account', () => {
            expect(isHabitCapExempt(BrandVariations.HABITS, [AccessLevels.EMAIL_VERIFIED])).to.equal(false);
        });

        it('exempts a lifetime founder', () => {
            expect(isHabitCapExempt(
                BrandVariations.HABITS,
                [AccessLevels.EMAIL_VERIFIED, AccessLevels.HABITS_LIFETIME],
            )).to.equal(true);
        });

        it('exempts a premium subscriber and a super admin', () => {
            expect(isHabitCapExempt(BrandVariations.HABITS, [AccessLevels.HABITS_PREMIUM])).to.equal(true);
            expect(isHabitCapExempt(BrandVariations.HABITS, [AccessLevels.SUPER_ADMIN])).to.equal(true);
        });

        it('treats a missing accessLevels array as not entitled', () => {
            // The dangerous direction: a caller that forgot to select the JSONB
            // column must produce a paywall, never free premium for everyone.
            expect(isHabitCapExempt(BrandVariations.HABITS, undefined)).to.equal(false);
        });
    });

    describe('checkHabitCapacity', () => {
        it('allows a free user below the limit', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT - 1);

            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            });

            expect(denial).to.equal(null);
        });

        it('denies a free user at the limit, with paywall metadata', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            });

            expect(denial).to.not.equal(null);
            expect(denial?.error).to.equal('habit-limit-reached');
            expect(denial?.limit).to.equal(HABITS_FREE_HABIT_LIMIT);
            expect(denial?.activeHabitCount).to.equal(HABITS_FREE_HABIT_LIMIT);
            expect(denial?.upgradeRequired).to.equal(true);
            expect(denial?.message).to.be.a('string').and.not.empty;
        });

        it('allows a lifetime founder who is over the limit', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.HABITS_LIFETIME] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT + 20);

            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            });

            expect(denial).to.equal(null);
            // Entitled accounts should not even pay for the count queries.
            expect(countActiveStub.called).to.equal(false);
            expect(countStartedStub.called).to.equal(false);
        });

        it('denies a free user who has started too many habits this window, even with slots free', async () => {
            // The loop this closes: archive one, start another, forever. Active
            // count stays under the cap the whole time.
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT - 1);
            countStartedStub.resolves(HABITS_FREE_HABIT_STARTS_PER_WINDOW);

            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            });

            expect(denial?.error).to.equal('habit-start-limit-reached');
            expect(denial?.startLimit).to.equal(HABITS_FREE_HABIT_STARTS_PER_WINDOW);
            expect(denial?.startWindowDays).to.equal(HABITS_FREE_HABIT_START_WINDOW_DAYS);
            expect(denial?.recentStartCount).to.equal(HABITS_FREE_HABIT_STARTS_PER_WINDOW);
            // The active cap still rides along: the client renders it either way.
            expect(denial?.limit).to.equal(HABITS_FREE_HABIT_LIMIT);
            expect(denial?.upgradeRequired).to.equal(true);
            expect(denial?.message).to.be.a('string').and.not.empty;
        });

        it('allows a start under both caps', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT - 1);
            countStartedStub.resolves(HABITS_FREE_HABIT_STARTS_PER_WINDOW - 1);

            expect(await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            })).to.equal(null);
        });

        it('reports the active cap first when both are hit', async () => {
            // Archiving something is the remedy the user has in hand right now;
            // the window is not.
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);
            countStartedStub.resolves(HABITS_FREE_HABIT_STARTS_PER_WINDOW);

            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            });

            expect(denial?.error).to.equal('habit-limit-reached');
        });

        it('counts starts from the beginning of the rolling window', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(0);

            const before = Date.now();
            await checkHabitCapacity({ userId: 'user-1', brandVariation: BrandVariations.HABITS });

            const since: Date = countStartedStub.firstCall.args[1];
            const windowMs = HABITS_FREE_HABIT_START_WINDOW_DAYS * 24 * 60 * 60 * 1000;
            expect(countStartedStub.firstCall.args[0]).to.equal('user-1');
            expect(since.getTime()).to.be.within(before - windowMs - 1000, Date.now() - windowMs + 1000);
            expect(getStartWindowSince(windowMs).getTime()).to.equal(0);
        });

        it('fails OPEN when the start count throws', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(0);
            countStartedStub.rejects(new Error('connection terminated'));

            expect(await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            })).to.equal(null);
        });

        it('short-circuits for non-HABITS brands without touching the database', async () => {
            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.THERR,
                locale: 'en-us',
            });

            expect(denial).to.equal(null);
            expect(findUserStub.called).to.equal(false);
            expect(countActiveStub.called).to.equal(false);
        });

        it('fails OPEN when the count query throws', async () => {
            // A transient database error must not be the reason someone cannot
            // start a habit. The cap is a commercial limit, not an integrity
            // constraint, so the worst case here is one extra free habit.
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.rejects(new Error('connection terminated'));

            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            });

            expect(denial).to.equal(null);
        });

        it('fails OPEN when the user lookup throws', async () => {
            findUserStub.rejects(new Error('connection terminated'));

            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            });

            expect(denial).to.equal(null);
        });

        it('still resolves a message when no locale is supplied', async () => {
            findUserStub.resolves([{ accessLevels: [] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const denial = await checkHabitCapacity({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
            });

            expect(denial?.message).to.be.a('string').and.not.empty;
        });
    });

    /**
     * The reporting path behind GET /habits/user-habits/eligibility. It is how
     * the client learns the numbers, so what matters is that the limits are
     * present whenever they apply and absent — not zero — when they do not.
     */
    describe('getHabitCapacityStatus', () => {
        it('reports both caps and both counts for a free HABITS account under the limits', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(2);
            countStartedStub.resolves(3);

            const status = await getHabitCapacityStatus({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
                locale: 'en-us',
            });

            expect(status).to.deep.include({
                isExempt: false,
                limit: HABITS_FREE_HABIT_LIMIT,
                startLimit: HABITS_FREE_HABIT_STARTS_PER_WINDOW,
                startWindowDays: HABITS_FREE_HABIT_START_WINDOW_DAYS,
                activeHabitCount: 2,
                recentStartCount: 3,
                denial: null,
            });
        });

        it('carries the denial when a cap is hit', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const status = await getHabitCapacityStatus({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
            });

            expect(status.denial?.error).to.equal('habit-limit-reached');
        });

        it('marks an entitled account exempt but still reports its counts', async () => {
            // The dashboard reads activeHabitCount as "is anything tracked yet".
            findUserStub.resolves([{ accessLevels: [AccessLevels.HABITS_LIFETIME] }]);
            countActiveStub.resolves(9);

            const status = await getHabitCapacityStatus({
                userId: 'user-1',
                brandVariation: BrandVariations.HABITS,
            });

            expect(status.isExempt).to.equal(true);
            expect(status.denial).to.equal(null);
            expect(status.activeHabitCount).to.equal(9);
        });

        it('marks another brand exempt without looking the user up', async () => {
            countActiveStub.resolves(1);

            const status = await getHabitCapacityStatus({
                userId: 'user-1',
                brandVariation: BrandVariations.THERR,
            });

            expect(status.isExempt).to.equal(true);
            expect(findUserStub.called).to.equal(false);
        });

        it('throws rather than failing open, because it reports state', async () => {
            resetHabitCapacityFailOpenCount();
            findUserStub.resolves([{ accessLevels: [] }]);
            countActiveStub.rejects(new Error('connection terminated'));

            let thrown: any = null;
            try {
                await getHabitCapacityStatus({ userId: 'user-1', brandVariation: BrandVariations.HABITS });
            } catch (err) {
                thrown = err;
            }
            expect(thrown).to.not.equal(null);
            expect(getHabitCapacityFailOpenCount()).to.equal(0);
        });
    });

    /**
     * Failing open is the right behaviour and is not what these guard. What they
     * guard is that it is *visible*: a cap that has silently stopped enforcing
     * looks exactly like a cap that is working, which is why #2923 — a user at 8
     * active habits against a limit of 5 — could not be explained from the code.
     * The tally is what separates one transient blip from a gate that has been
     * off for days.
     */
    describe('fail-open reporting', () => {
        beforeEach(() => {
            resetHabitCapacityFailOpenCount();
        });

        afterEach(() => {
            resetHabitCapacityFailOpenCount();
        });

        it('does not count a successful evaluation', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.resolves(1);

            await checkHabitCapacity({ userId: 'user-1', brandVariation: BrandVariations.HABITS });

            expect(getHabitCapacityFailOpenCount()).to.equal(0);
        });

        it('does not count a denial', async () => {
            findUserStub.resolves([{ accessLevels: [] }]);
            countActiveStub.resolves(HABITS_FREE_HABIT_LIMIT);

            const denial = await checkHabitCapacity({ userId: 'user-1', brandVariation: BrandVariations.HABITS });

            expect(denial).to.not.equal(null);
            expect(getHabitCapacityFailOpenCount()).to.equal(0);
        });

        it('accumulates across repeated failures, so a sustained fail-open is distinguishable from a blip', async () => {
            findUserStub.resolves([{ accessLevels: [AccessLevels.EMAIL_VERIFIED] }]);
            countActiveStub.rejects(new Error('connection terminated'));

            await checkHabitCapacity({ userId: 'user-1', brandVariation: BrandVariations.HABITS });
            expect(getHabitCapacityFailOpenCount()).to.equal(1);

            await checkHabitCapacity({ userId: 'user-2', brandVariation: BrandVariations.HABITS });
            await checkHabitCapacity({ userId: 'user-3', brandVariation: BrandVariations.HABITS });

            expect(getHabitCapacityFailOpenCount()).to.equal(3);
        });

        it('counts a failing user lookup too', async () => {
            // The more serious of the two: with findUser down, nobody can be
            // recognised as entitled either, so paying customers are also going
            // through unevaluated.
            findUserStub.rejects(new Error('connection terminated'));

            await checkHabitCapacity({ userId: 'user-1', brandVariation: BrandVariations.HABITS });

            expect(getHabitCapacityFailOpenCount()).to.equal(1);
        });

        it('does not count a short-circuited non-HABITS request', async () => {
            findUserStub.rejects(new Error('connection terminated'));

            await checkHabitCapacity({ userId: 'user-1', brandVariation: BrandVariations.THERR });

            expect(getHabitCapacityFailOpenCount()).to.equal(0);
        });
    });
});
