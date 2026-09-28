import { expect } from 'chai';
import {
    HABIT_AMOUNT_UNITS,
    isHabitAmountUnit,
    isMeasuredHabitGoal,
    tracksHabitAmount,
} from '../src/constants/habitAmounts';

describe('habit amounts', () => {
    it('recognises only the listed units', () => {
        expect(isHabitAmountUnit('minutes')).to.equal(true);
        expect(isHabitAmountUnit('km')).to.equal(true);
        expect(isHabitAmountUnit('furlongs')).to.equal(false);
        expect(isHabitAmountUnit('')).to.equal(false);
        expect(isHabitAmountUnit(null)).to.equal(false);
        expect(HABIT_AMOUNT_UNITS).to.include('pages');
    });

    it('treats a non-savings goal as measured only when it has a unit', () => {
        // Opt-in: an ordinary habit with no unit is a plain yes/no check-in.
        expect(isMeasuredHabitGoal({ goalType: 'build_good', amountUnit: null })).to.equal(false);
        expect(isMeasuredHabitGoal({ goalType: 'build_good', amountUnit: 'pages' })).to.equal(true);
        expect(isMeasuredHabitGoal({ goalType: undefined, amountUnit: 'minutes' })).to.equal(true);
        expect(isMeasuredHabitGoal(null)).to.equal(false);
    });

    it('never treats a savings goal as measured, even with a stray unit', () => {
        // A savings goal is counted in its currency; a unit on it must not turn its
        // cumulative target into a weekly one.
        expect(isMeasuredHabitGoal({ goalType: 'savings_goal', amountUnit: 'minutes' })).to.equal(false);
    });

    it('reports amount tracking for savings goals always and other goals by opt-in', () => {
        expect(tracksHabitAmount({ goalType: 'savings_goal' })).to.equal(true);
        expect(tracksHabitAmount({ goalType: 'build_good', amountUnit: 'km' })).to.equal(true);
        expect(tracksHabitAmount({ goalType: 'build_good' })).to.equal(false);
    });
});
