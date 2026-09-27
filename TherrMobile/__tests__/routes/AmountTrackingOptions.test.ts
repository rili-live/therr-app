import { it, describe, expect } from '@jest/globals';
import {
    AMOUNT_TRACKING_OFF,
    fromGoal,
    getAmountTrackingProblem,
    isSameAmountTracking,
    toGoalFields,
} from '../../main/routes/Pacts/amountTrackingOptions';
import { formatHabitAmount } from '../../main/utilities/habitAmountFormat';

/**
 * Amount tracking is optional for every habit except a savings goal. These pin the three
 * things that keep it optional: off sends nothing on create, a unit with no target is
 * complete, and turning it off on an edit clears the unit rather than leaving it.
 */
describe('amountTrackingOptions', () => {
    it('sends nothing for a new habit that does not track an amount', () => {
        expect(toGoalFields(AMOUNT_TRACKING_OFF)).toEqual({});
        expect(getAmountTrackingProblem(AMOUNT_TRACKING_OFF)).toBeNull();
    });

    it('sends the unit and a null target when no target is typed', () => {
        const choice = { enabled: true, unit: 'pages' as const, targetText: '' };

        expect(getAmountTrackingProblem(choice)).toBeNull();
        expect(toGoalFields(choice)).toEqual({ amountUnit: 'pages', targetAmount: null });
    });

    it('parses a weekly target with the shared parser', () => {
        const choice = { enabled: true, unit: 'km' as const, targetText: '12,5' };

        expect(toGoalFields(choice)).toEqual({ amountUnit: 'km', targetAmount: 12.5 });
    });

    it('asks for a unit once tracking is switched on', () => {
        expect(getAmountTrackingProblem({ enabled: true, unit: null, targetText: '' })).toBe('needs-unit');
    });

    it('reports an unparseable target instead of dropping it', () => {
        expect(getAmountTrackingProblem({ enabled: true, unit: 'minutes', targetText: 'abc' })).toBe('not-a-number');
    });

    it('clears the unit when an edit turns tracking off on a measured habit', () => {
        expect(toGoalFields(AMOUNT_TRACKING_OFF, true)).toEqual({ amountUnit: null });
    });

    it('opens the editor from a measured goal and ignores a savings goal', () => {
        expect(fromGoal({ goalType: 'build_good', amountUnit: 'minutes', targetAmount: 180 }))
            .toEqual({ enabled: true, unit: 'minutes', targetText: '180' });
        expect(fromGoal({ goalType: 'savings_goal', amountUnit: null, targetAmount: 500 }))
            .toEqual(AMOUNT_TRACKING_OFF);
        expect(fromGoal({ goalType: 'build_good', amountUnit: null })).toEqual(AMOUNT_TRACKING_OFF);
    });

    it('recognises an unchanged choice so the editor can skip a no-op save', () => {
        const goal = { goalType: 'build_good', amountUnit: 'km', targetAmount: 20 };

        expect(isSameAmountTracking({ enabled: true, unit: 'km', targetText: '20' }, goal)).toBe(true);
        expect(isSameAmountTracking({ enabled: true, unit: 'km', targetText: '25' }, goal)).toBe(false);
        expect(isSameAmountTracking(AMOUNT_TRACKING_OFF, goal)).toBe(false);
    });
});

describe('formatHabitAmount', () => {
    const translate = (key: string) => (key === 'pages.habits.amounts.units.minutes.short' ? 'min' : key);

    it('prints the unit after the number and drops needless decimals', () => {
        expect(formatHabitAmount(95, 'minutes', translate, 'en-US')).toBe('95 min');
        expect(formatHabitAmount(12.5, 'minutes', translate, 'en-US')).toBe('12.5 min');
    });

    it('prints a bare number for an unknown unit', () => {
        expect(formatHabitAmount(3, 'furlongs', translate, 'en-US')).toBe('3');
    });
});
