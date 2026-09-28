import { HabitGoalTypes } from './enums/HabitGoalTypes';

/**
 * Measured habits: an optional amount recorded against a habit that is not about money.
 *
 * "Read" is a yes/no habit until the user says *how much* — 20 pages, 45 minutes. A
 * savings habit always tracks an amount (it is what the habit is), so for savings the
 * amount is the currency and nothing here applies. For every other goal type amount
 * tracking is **opt-in**: a goal with no `amountUnit` is an ordinary check-in habit and
 * never asks for a number, and one with a unit still accepts a check-in without an
 * amount. A number is extra detail, never the price of a check-in.
 *
 * The recorded amount lives in the same `habits.habit_checkins."savedAmount"` column a
 * savings check-in writes, and is parsed by the same `parseSavingsAmount`: two decimals,
 * never negative, and tolerant of "30 min" or "5,5 km" typed into a notification
 * quick-reply. The unit comes from the goal, so the column means "money" on a savings
 * goal and "this goal's unit" everywhere else.
 */

/**
 * The units a measured habit can be counted in. A fixed list, not free text: each one is
 * a translation key on the client (`habitAmountUnits.<unit>`), which a user-typed label
 * could not be, and a ranking across members (see WORK_IN_PROGRESS § 2.7) only makes
 * sense between people counting the same thing.
 */
export enum HabitAmountUnits {
    MINUTES = 'minutes',
    HOURS = 'hours',
    PAGES = 'pages',
    STEPS = 'steps',
    REPS = 'reps',
    SETS = 'sets',
    KM = 'km',
    MILES = 'miles',
    GLASSES = 'glasses',
    SERVINGS = 'servings',
}

export type HabitAmountUnit = `${HabitAmountUnits}`;

/** In display order for a unit picker. */
export const HABIT_AMOUNT_UNITS: HabitAmountUnit[] = Object.values(HabitAmountUnits);

export const isHabitAmountUnit = (value: unknown): value is HabitAmountUnit => (
    typeof value === 'string' && (HABIT_AMOUNT_UNITS as string[]).includes(value)
);

interface IAmountGoalFields {
    goalType?: string | null;
    amountUnit?: string | null;
}

/**
 * A non-savings habit whose owner chose to track an amount. Its `targetAmount`, when set,
 * is a **weekly** target for each member, unlike a savings target, which is cumulative.
 * A habit repeats, so the target resets every Monday with the rest of the habit's week.
 */
export const isMeasuredHabitGoal = (goal: IAmountGoalFields | null | undefined): boolean => (
    !!goal
    && goal.goalType !== HabitGoalTypes.SAVINGS_GOAL
    && isHabitAmountUnit(goal.amountUnit)
);

/** Whether a check-in on this goal can carry an amount at all: savings, or measured. */
export const tracksHabitAmount = (goal: IAmountGoalFields | null | undefined): boolean => (
    goal?.goalType === HabitGoalTypes.SAVINGS_GOAL || isMeasuredHabitGoal(goal)
);
