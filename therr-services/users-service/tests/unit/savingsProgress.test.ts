import { expect } from 'chai';
import { HabitGoalTypes, SavingsTargetScopes } from 'therr-js-utilities/constants';
import {
    buildSavingsProgress,
    isSavingsGoal,
    resolveSavingsTargetScope,
    validateSavingsTargetInput,
} from '../../src/utilities/savingsProgress';

/**
 * "The goal is reached when the total is equal or more" is one sentence with two
 * readings, and a savings pact completes on a different day depending on which one is
 * meant. These pin both, plus the edge cases a query alone would not show: a member who
 * left mid-cycle, a pact with nobody in it, and an open-ended habit with no target.
 */
describe('buildSavingsProgress', () => {
    const SAVINGS_GOAL = {
        id: 'goal-1',
        goalType: HabitGoalTypes.SAVINGS_GOAL,
        currencyCode: 'USD',
    };

    const member = (userId: string, totalSaved: number) => ({
        userId,
        totalSaved,
        contributionCount: totalSaved > 0 ? 1 : 0,
    });

    it('defaults to per-member scope when none is recorded', () => {
        expect(resolveSavingsTargetScope(null)).to.equal(SavingsTargetScopes.PER_MEMBER);
        expect(resolveSavingsTargetScope(undefined)).to.equal(SavingsTargetScopes.PER_MEMBER);
        expect(resolveSavingsTargetScope('nonsense')).to.equal(SavingsTargetScopes.PER_MEMBER);
        expect(resolveSavingsTargetScope('group')).to.equal(SavingsTargetScopes.GROUP);
    });

    it('reports the group total and each member alongside it, whatever the scope', () => {
        const progress = buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: 500 },
            memberTotals: [member('a', 100), member('b', 250)],
            viewerUserId: 'a',
        });

        expect(progress.totalSaved).to.equal(350);
        expect(progress.viewerTotalSaved).to.equal(100);
        // Ordered by amount so the detail view does not have to sort.
        expect(progress.members.map((m) => m.userId)).to.deep.equal(['b', 'a']);
    });

    it('under per-member scope, is reached only when EVERY counted member is there', () => {
        const base = {
            goal: { ...SAVINGS_GOAL, targetAmount: 200, savingsTargetScope: 'per_member' },
            viewerUserId: 'a',
        };

        // One member finished, one short: the pact is not done. Completing it here would
        // end the cycle out from under the member still saving.
        expect(buildSavingsProgress({
            ...base,
            memberTotals: [member('a', 200), member('b', 50)],
        }).isGoalReached).to.equal(false);

        expect(buildSavingsProgress({
            ...base,
            memberTotals: [member('a', 200), member('b', 200)],
        }).isGoalReached).to.equal(true);
    });

    it('under group scope, is reached on the combined pot regardless of who put in what', () => {
        const progress = buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: 300, savingsTargetScope: 'group' },
            memberTotals: [member('a', 250), member('b', 50)],
            viewerUserId: 'a',
        });

        expect(progress.isGoalReached).to.equal(true);
        // No individual "reached" badge under group scope — the target is the pact's,
        // and flagging one member as done next to a half-empty pot would misread.
        expect(progress.members.every((m) => m.hasReachedTarget === false)).to.equal(true);
    });

    it('ignores a departed member when deciding completion but keeps their money', () => {
        // Someone who left after saving $300 still saved it, so the total must include
        // them; they can no longer check in, so holding the goal open on them would
        // strand the group forever.
        const progress = buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: 200, savingsTargetScope: 'per_member' },
            memberTotals: [member('a', 200), member('gone', 300), member('b', 200)],
            activeUserIds: ['a', 'b'],
            viewerUserId: 'a',
        });

        expect(progress.totalSaved).to.equal(700);
        expect(progress.isGoalReached).to.equal(true);
    });

    it('is never reached when nobody is counted', () => {
        // Array.every is vacuously true on an empty array, which would otherwise
        // complete an empty pact the moment it was created.
        expect(buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: 100 },
            memberTotals: [],
            activeUserIds: [],
        }).isGoalReached).to.equal(false);
    });

    it('is never reached for an open-ended savings habit', () => {
        const progress = buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: null },
            memberTotals: [member('a', 5000)],
            viewerUserId: 'a',
        });

        expect(progress.isGoalReached).to.equal(false);
        expect(progress.targetAmount).to.equal(null);
        // Nothing remaining to report when there is no finish line — distinct from 0,
        // which would render as "you're done".
        expect(progress.remainingAmount).to.equal(null);
        // The total is still worth showing; an open-ended habit tracks, it just does
        // not complete.
        expect(progress.totalSaved).to.equal(5000);
    });

    it('treats a zero or negative target as no target at all', () => {
        expect(buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: 0 },
            memberTotals: [member('a', 0)],
            viewerUserId: 'a',
        }).isGoalReached).to.equal(false);
    });

    it('reports what is left, floored at zero, from the scope\'s perspective', () => {
        const perMember = buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: 100, savingsTargetScope: 'per_member' },
            memberTotals: [member('a', 40), member('b', 90)],
            viewerUserId: 'a',
        });
        expect(perMember.remainingAmount).to.equal(60);

        const group = buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: 100, savingsTargetScope: 'group' },
            memberTotals: [member('a', 40), member('b', 90)],
            viewerUserId: 'a',
        });
        // Overshooting is worth celebrating, not reporting as negative remaining.
        expect(group.remainingAmount).to.equal(0);
    });

    it('accepts the numeric strings node-postgres returns for a target', () => {
        const progress = buildSavingsProgress({
            goal: { ...SAVINGS_GOAL, targetAmount: '100.00' },
            memberTotals: [member('a', 100)],
            viewerUserId: 'a',
        });
        expect(progress.isGoalReached).to.equal(true);
    });

    it('falls back to a display currency rather than leaving one undefined', () => {
        const progress = buildSavingsProgress({
            goal: { id: 'g', goalType: HabitGoalTypes.SAVINGS_GOAL, targetAmount: 10 },
            memberTotals: [member('a', 10)],
        });
        expect(progress.currencyCode).to.equal('USD');
    });

    it('recognizes savings goals by type, not by whether a target happens to be set', () => {
        expect(isSavingsGoal({ goalType: HabitGoalTypes.SAVINGS_GOAL })).to.equal(true);
        // An open-ended savings habit is still a savings habit.
        expect(isSavingsGoal({ goalType: HabitGoalTypes.SAVINGS_GOAL, targetAmount: null })).to.equal(true);
        // And a stray target on an ordinary habit does not make it one.
        expect(isSavingsGoal({ goalType: 'build_good', targetAmount: 100 })).to.equal(false);
        expect(isSavingsGoal(null)).to.equal(false);
    });
});

describe('validateSavingsTargetInput', () => {
    it('leaves absent keys absent, so a rename cannot wipe a target', () => {
        // The store drops undefined keys from both insert and update; that is what makes
        // a partial edit safe, and it only works if validation preserves absence.
        expect(validateSavingsTargetInput({ name: 'New name' }).params).to.deep.equal({});
    });

    it('turns an explicitly empty target into null, to clear it', () => {
        expect(validateSavingsTargetInput({ targetAmount: null }).params).to.deep.equal({ targetAmount: null });
        expect(validateSavingsTargetInput({ targetAmount: '' }).params).to.deep.equal({ targetAmount: null });
    });

    it('rejects a bad amount with the shared message key', () => {
        expect(validateSavingsTargetInput({ targetAmount: -5 }).errorKey)
            .to.equal('errorMessages.savings.amountNegative');
        expect(validateSavingsTargetInput({ targetAmount: 'abc' }).errorKey)
            .to.equal('errorMessages.savings.amountNotANumber');
    });

    it('normalizes a currency code and rejects a malformed one', () => {
        expect(validateSavingsTargetInput({ currencyCode: 'usd' }).params)
            .to.deep.equal({ currencyCode: 'USD' });
        expect(validateSavingsTargetInput({ currencyCode: 'DOLLARS' }).errorKey)
            .to.equal('errorMessages.savings.invalidCurrencyCode');
    });

    it('rejects an unknown scope rather than silently defaulting it', () => {
        expect(validateSavingsTargetInput({ savingsTargetScope: 'group' }).params)
            .to.deep.equal({ savingsTargetScope: 'group' });
        expect(validateSavingsTargetInput({ savingsTargetScope: 'everyone' }).errorKey)
            .to.equal('errorMessages.savings.invalidTargetScope');
    });
});
