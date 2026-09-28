import {
    HabitAmountUnit,
    SavingsAmountError,
    isHabitAmountUnit,
    isMeasuredHabitGoal,
    parseSavingsAmount,
} from 'therr-js-utilities/constants';

/**
 * The opt-in "track an amount" choice on a habit that is not a savings goal: off, or a unit
 * plus an optional weekly target. The model behind `AmountTrackingPicker`, shared by the
 * create wizard and the habit detail editor so both send the same fields.
 *
 * Tracking is never required. Off is the default, a unit with no target is complete, and a
 * measured habit still checks in without a number.
 */
export interface IAmountTrackingChoice {
    enabled: boolean;
    unit: HabitAmountUnit | null;
    /** Raw text, so a half-typed "12." survives a keystroke. */
    targetText: string;
}

export const AMOUNT_TRACKING_OFF: IAmountTrackingChoice = { enabled: false, unit: null, targetText: '' };

interface IAmountGoalFields {
    goalType?: string | null;
    amountUnit?: string | null;
    targetAmount?: number | null;
}

/** The editor's starting state for an existing goal. */
export const fromGoal = (goal?: IAmountGoalFields | null): IAmountTrackingChoice => {
    if (!goal || !isMeasuredHabitGoal(goal) || !isHabitAmountUnit(goal.amountUnit)) {
        return AMOUNT_TRACKING_OFF;
    }

    return {
        enabled: true,
        unit: goal.amountUnit,
        targetText: goal.targetAmount ? String(goal.targetAmount) : '',
    };
};

export type AmountTrackingProblem = 'needs-unit' | SavingsAmountError;

/** Why the choice cannot be saved yet, or null when it can. Off is always complete. */
export const getAmountTrackingProblem = (choice: IAmountTrackingChoice): AmountTrackingProblem | null => {
    if (!choice.enabled) {
        return null;
    }
    if (!choice.unit) {
        return 'needs-unit';
    }
    const trimmed = choice.targetText.trim();
    if (!trimmed.length) {
        return null;
    }
    const parsed = parseSavingsAmount(trimmed);
    if (parsed.error) {
        return parsed.error;
    }
    return parsed.amount === undefined ? 'not-a-number' : null;
};

/**
 * The goal fields to send, or `{}` when there is nothing to say.
 *
 * `wasMeasured` is whether the goal being edited already tracks an amount. Turning tracking
 * off then sends `amountUnit: null`, which the server reads as "clear the unit and its
 * target". On create, or on an edit of a goal that never tracked, off sends nothing at all,
 * so an ordinary habit's request is exactly what it was before this feature existed.
 */
export const toGoalFields = (
    choice: IAmountTrackingChoice,
    wasMeasured = false,
): { amountUnit?: HabitAmountUnit | null; targetAmount?: number | null } => {
    if (!choice.enabled || !choice.unit) {
        return wasMeasured ? { amountUnit: null } : {};
    }

    const parsed = parseSavingsAmount(choice.targetText.trim());
    const targetAmount = !parsed.error && parsed.amount !== undefined && parsed.amount > 0
        ? parsed.amount
        : null;

    return { amountUnit: choice.unit, targetAmount };
};

/** Whether saving `next` over `goal` would change anything, so an editor can skip a no-op PUT. */
export const isSameAmountTracking = (next: IAmountTrackingChoice, goal?: IAmountGoalFields | null): boolean => {
    const current = toGoalFields(fromGoal(goal));
    const proposed = toGoalFields(next);
    return (current.amountUnit ?? null) === (proposed.amountUnit ?? null)
        && (current.targetAmount ?? null) === (proposed.targetAmount ?? null);
};
