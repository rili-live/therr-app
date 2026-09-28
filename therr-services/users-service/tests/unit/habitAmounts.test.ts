import { expect } from 'chai';
import sinon from 'sinon';
import { HabitGoalTypes } from 'therr-js-utilities/constants';
import Store from '../../src/store';
import { buildAmountProgress, validateAmountTrackingInput } from '../../src/utilities/habitAmounts';
import { attachAmountTotals } from '../../src/handlers/helpers/savings';

/**
 * Measured habits: amount tracking is optional for every goal type except savings, and a
 * measured goal's target is weekly per member. These pin the combinations a PATCH can
 * send one field at a time.
 */
describe('validateAmountTrackingInput', () => {
    it('leaves an ordinary habit alone when no amount fields are sent', () => {
        expect(validateAmountTrackingInput({ name: 'Read' }, undefined)).to.deep.equal({ params: {} });
    });

    it('accepts a listed unit, with or without a weekly target', () => {
        expect(validateAmountTrackingInput({ amountUnit: 'pages' }, undefined).params)
            .to.deep.equal({ amountUnit: 'pages' });
        expect(validateAmountTrackingInput({ amountUnit: 'minutes', targetAmount: 180 }, 180).params)
            .to.deep.equal({ amountUnit: 'minutes' });
    });

    it('rejects a unit that is not on the list', () => {
        expect(validateAmountTrackingInput({ amountUnit: 'furlongs' }, undefined).errorKey)
            .to.equal('errorMessages.habitGoals.invalidAmountUnit');
    });

    it('rejects a unit on a savings goal, which is counted in its currency', () => {
        expect(validateAmountTrackingInput(
            { goalType: HabitGoalTypes.SAVINGS_GOAL, amountUnit: 'minutes' },
            undefined,
        ).errorKey).to.equal('errorMessages.habitGoals.amountUnitOnSavings');
    });

    it('still accepts a savings target without a unit', () => {
        // Savings keeps its own rules: the target is money and needs no unit.
        expect(validateAmountTrackingInput({ goalType: HabitGoalTypes.SAVINGS_GOAL, targetAmount: 500 }, 500))
            .to.deep.equal({ params: {} });
    });

    it('rejects a weekly target on a habit that has no unit', () => {
        expect(validateAmountTrackingInput({ targetAmount: 180 }, 180).errorKey)
            .to.equal('errorMessages.habitGoals.targetNeedsAmountUnit');
    });

    it('lets an edit set a target on a goal that already has a unit', () => {
        const existing = { goalType: HabitGoalTypes.BUILD_GOOD, amountUnit: 'km', targetAmount: null };
        expect(validateAmountTrackingInput({ targetAmount: 20 }, 20, existing).params).to.deep.equal({});
    });

    it('clears the target when an edit turns amount tracking off', () => {
        const existing = { goalType: HabitGoalTypes.BUILD_GOOD, amountUnit: 'km', targetAmount: 20 };
        expect(validateAmountTrackingInput({ amountUnit: null }, undefined, existing).params)
            .to.deep.equal({ amountUnit: null, targetAmount: null });
    });

    it('rejects turning tracking off while setting a new target in the same edit', () => {
        const existing = { goalType: HabitGoalTypes.BUILD_GOOD, amountUnit: 'km', targetAmount: 20 };
        expect(validateAmountTrackingInput({ amountUnit: null, targetAmount: 30 }, 30, existing).errorKey)
            .to.equal('errorMessages.habitGoals.targetNeedsAmountUnit');
    });

    it('lets an edit rename a measured habit without touching its amount fields', () => {
        const existing = { goalType: HabitGoalTypes.BUILD_GOOD, amountUnit: 'km', targetAmount: 20 };
        expect(validateAmountTrackingInput({ name: 'Run more' }, undefined, existing)).to.deep.equal({ params: {} });
    });
});

describe('buildAmountProgress', () => {
    const MEASURED = { goalType: HabitGoalTypes.BUILD_GOOD, amountUnit: 'minutes', targetAmount: 180 };

    it('returns null for a goal that is not measured', () => {
        expect(buildAmountProgress({
            goal: { goalType: HabitGoalTypes.BUILD_GOOD, amountUnit: null },
            memberTotals: [],
            weekStart: '2026-09-21',
        })).to.equal(null);
        expect(buildAmountProgress({
            goal: { goalType: HabitGoalTypes.SAVINGS_GOAL, amountUnit: 'minutes' },
            memberTotals: [],
            weekStart: '2026-09-21',
        })).to.equal(null);
    });

    it('ranks members by this week and flags who reached the weekly target', () => {
        const progress = buildAmountProgress({
            goal: MEASURED,
            memberTotals: [
                { userId: 'a', weekAmount: 90, totalAmount: 900 },
                { userId: 'b', weekAmount: 180, totalAmount: 400 },
            ],
            weekStart: '2026-09-21',
            viewerUserId: 'a',
        });

        expect(progress?.members.map((m) => m.userId)).to.deep.equal(['b', 'a']);
        expect(progress?.members.map((m) => m.hasReachedWeeklyTarget)).to.deep.equal([true, false]);
        expect(progress?.viewerWeekAmount).to.equal(90);
        expect(progress?.viewerTotalAmount).to.equal(900);
        expect(progress?.groupWeekAmount).to.equal(270);
        expect(progress?.weeklyTargetAmount).to.equal(180);
        expect(progress?.amountUnit).to.equal('minutes');
    });

    it('reports no one as having reached a target that does not exist', () => {
        const progress = buildAmountProgress({
            goal: { ...MEASURED, targetAmount: null },
            memberTotals: [{ userId: 'a', weekAmount: 50, totalAmount: 50 }],
            weekStart: '2026-09-21',
        });

        expect(progress?.weeklyTargetAmount).to.equal(null);
        expect(progress?.members[0].hasReachedWeeklyTarget).to.equal(false);
    });
});

describe('attachAmountTotals', () => {
    afterEach(() => sinon.restore());

    const habit = (overrides: any) => ({
        userId: 'user-1',
        habitGoalId: 'goal-1',
        goalType: HabitGoalTypes.BUILD_GOOD,
        amountUnit: null,
        targetAmount: null,
        amountThisWeek: '0',
        ...overrides,
    });

    it('skips the aggregate entirely when no habit tracks an amount', async () => {
        const stub = sinon.stub(Store.habitCheckins, 'getSavingsTotalsByGoalForUser').resolves({});

        const [result] = await attachAmountTotals([habit({})]);

        expect(stub.called).to.equal(false);
        expect(result).to.not.have.property('weekAmount');
        expect(result).to.not.have.property('totalAmount');
        expect(result).to.not.have.property('amountThisWeek');
    });

    it('gives a measured habit its week and all-time amounts, and a savings habit its total', async () => {
        sinon.stub(Store.habitCheckins, 'getSavingsTotalsByGoalForUser').resolves({
            'goal-1': { totalSaved: 1200, contributionCount: 10 },
            'goal-2': { totalSaved: 300, contributionCount: 3 },
        });

        const [measured, savings] = await attachAmountTotals([
            habit({ amountUnit: 'minutes', targetAmount: '180.00', amountThisWeek: '95.50' }),
            habit({ habitGoalId: 'goal-2', goalType: HabitGoalTypes.SAVINGS_GOAL, targetAmount: '500.00' }),
        ]);

        expect(measured).to.include({ weekAmount: 95.5, totalAmount: 1200, targetAmount: 180 });
        expect(measured).to.not.have.property('totalSaved');
        expect(savings).to.include({ totalSaved: 300, targetAmount: 500 });
        expect(savings).to.not.have.property('weekAmount');
    });

    it('omits the week amount when the week could not be resolved', async () => {
        sinon.stub(Store.habitCheckins, 'getSavingsTotalsByGoalForUser').resolves({});

        const [measured] = await attachAmountTotals([habit({ amountUnit: 'km', amountThisWeek: null })]);

        expect(measured).to.not.have.property('weekAmount');
        expect(measured).to.include({ totalAmount: 0 });
    });
});
