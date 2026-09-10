import { expect } from 'chai';
import sinon from 'sinon';
import { AccessLevels, BrandVariations, HABITS_FREE_HABIT_LIMIT } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { checkHabitCapacity, isHabitCapExempt } from '../../src/handlers/helpers/habitCapacity';

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

    beforeEach(() => {
        findUserStub = sinon.stub(Store.users, 'findUser');
        countActiveStub = sinon.stub(Store.userHabits, 'countActiveByUser');
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
            // Entitled accounts should not even pay for the count query.
            expect(countActiveStub.called).to.equal(false);
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
});
