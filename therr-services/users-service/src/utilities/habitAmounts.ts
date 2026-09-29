import {
    HabitAmountUnit,
    HabitGoalTypes,
    hasReachedSavingsTarget,
    isHabitAmountUnit,
    isMeasuredHabitGoal,
    sumSavingsAmounts,
} from 'therr-js-utilities/constants';

/**
 * Measured habits: validating the opt-in amount unit on a habit goal, and turning a
 * measured pact's per-member amounts into what the detail view renders.
 *
 * Pure, like `savingsProgress.ts` beside it. A measured habit differs from a savings one
 * in the two ways that matter here:
 *
 *   - Tracking is opt-in. A goal with no unit is an ordinary habit, and a check-in on one
 *     with a unit is still valid without an amount.
 *   - The target is **weekly and per member**. A habit repeats, so "180 minutes" means
 *     180 each week, reset every Monday. Reaching it is reported and never completes a
 *     pact, since a habit pact ends on its duration.
 */

export interface IAmountGoalState {
    goalType?: string | null;
    amountUnit?: string | null;
    targetAmount?: number | string | null;
}

export interface IValidatedAmountTracking {
    /** Keys absent from the request stay absent, so a PATCH leaves them alone. */
    params?: {
        amountUnit?: HabitAmountUnit | null;
        targetAmount?: number | null;
    };
    errorKey?: string;
}

/**
 * Validate `amountUnit` off a habit goal request, alongside the `targetAmount` the savings
 * validator has already parsed.
 *
 * `existingGoal` is the row being edited, or undefined on create. It is needed because a
 * PATCH may send only one of goalType, unit and target, and the rules are about the
 * combination:
 *
 *   - A savings goal is counted in its currency, so a unit on one is rejected.
 *   - A weekly target on a non-savings goal needs a unit. "Target: 180" of nothing is not
 *     a target anyone can be shown progress against.
 *   - Clearing the unit on a measured goal clears its target too. Otherwise a stray
 *     number stays on a habit that no longer measures anything, and switching tracking
 *     back on later resurrects a target the user thought they had removed.
 *   - Moving a goal across the savings boundary, in either direction, clears its target
 *     unless the same request sends a new one, and moving to savings clears the unit. A
 *     weekly amount and a cumulative sum of money don't convert into each other, so a
 *     "180 minutes" target kept as 180 in the goal's currency could complete a pact.
 */
export const validateAmountTrackingInput = (
    body: any,
    parsedTargetAmount: number | null | undefined,
    existingGoal?: IAmountGoalState | null,
): IValidatedAmountTracking => {
    const params: IValidatedAmountTracking['params'] = {};
    const goalType = body.goalType ?? existingGoal?.goalType ?? HabitGoalTypes.BUILD_GOOD;
    const isSavings = goalType === HabitGoalTypes.SAVINGS_GOAL;
    const wasSavings = existingGoal?.goalType === HabitGoalTypes.SAVINGS_GOAL;
    const crossesSavingsBoundary = !!existingGoal && isSavings !== wasSavings;

    let effectiveUnit: string | null = existingGoal?.amountUnit ?? null;
    if ('amountUnit' in body) {
        if (body.amountUnit === null || body.amountUnit === '') {
            params.amountUnit = null;
            effectiveUnit = null;
        } else if (!isHabitAmountUnit(body.amountUnit)) {
            return { errorKey: 'errorMessages.habitGoals.invalidAmountUnit' };
        } else {
            params.amountUnit = body.amountUnit;
            effectiveUnit = body.amountUnit;
        }
    }

    if (isSavings) {
        if (params.amountUnit) {
            return { errorKey: 'errorMessages.habitGoals.amountUnitOnSavings' };
        }
        if (crossesSavingsBoundary) {
            if (effectiveUnit) {
                params.amountUnit = null;
            }
            if (parsedTargetAmount === undefined) {
                params.targetAmount = null;
            }
        }
        return { params };
    }

    // Leaving savings: the stored target is money, not a weekly amount, so it is dropped
    // rather than judged against the new type's rules.
    let effectiveTarget = parsedTargetAmount !== undefined
        ? parsedTargetAmount
        : (existingGoal?.targetAmount ?? null);
    if (crossesSavingsBoundary && parsedTargetAmount === undefined) {
        params.targetAmount = null;
        effectiveTarget = null;
    }

    if (!effectiveUnit && effectiveTarget !== null && effectiveTarget !== undefined) {
        // Turning measuring off on a goal that had a target: take the target with it,
        // unless the same request is trying to set a new one, which is a real mistake.
        if (existingGoal && params.amountUnit === null && parsedTargetAmount === undefined) {
            params.targetAmount = null;
            return { params };
        }
        return { errorKey: 'errorMessages.habitGoals.targetNeedsAmountUnit' };
    }

    return { params };
};

export interface IAmountMemberTotal {
    userId: string;
    weekAmount: number;
    totalAmount: number;
}

export interface IAmountMemberProgress extends IAmountMemberTotal {
    hasReachedWeeklyTarget: boolean;
}

export interface IAmountProgress {
    amountUnit: HabitAmountUnit;
    /** Per member, per week. Null when the goal has a unit and no target. */
    weeklyTargetAmount: number | null;
    /** Monday (YYYY-MM-DD) of the week `weekAmount` covers, in the viewer's own zone. */
    weekStart: string;
    /** Sorted by this week's amount, highest first. */
    members: IAmountMemberProgress[];
    viewerWeekAmount: number;
    viewerTotalAmount: number;
    groupWeekAmount: number;
}

const resolveWeeklyTarget = (targetAmount?: number | string | null): number | null => {
    if (targetAmount === null || targetAmount === undefined || targetAmount === '') {
        return null;
    }
    const value = typeof targetAmount === 'string' ? Number(targetAmount) : targetAmount;
    return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Progress for one measured goal across a pact's members, or null when the goal is not a
 * measured one. Each member's `weekAmount` is summed over the viewer's week; the few hours
 * a member in another zone is off by at a week boundary are not worth a per-member zone
 * lookup on a detail read.
 */
export const buildAmountProgress = ({
    goal,
    memberTotals,
    weekStart,
    viewerUserId,
}: {
    goal: IAmountGoalState;
    memberTotals: IAmountMemberTotal[];
    weekStart: string;
    viewerUserId?: string;
}): IAmountProgress | null => {
    if (!isMeasuredHabitGoal(goal)) {
        return null;
    }

    const weeklyTargetAmount = resolveWeeklyTarget(goal.targetAmount);
    const members = memberTotals
        .map((member) => ({
            ...member,
            hasReachedWeeklyTarget: hasReachedSavingsTarget(member.weekAmount, weeklyTargetAmount),
        }))
        // Ties broken by userId: the rows arrive in no guaranteed SQL order, and a ranking
        // that reshuffles equal members between loads reads as a bug.
        .sort((a, b) => b.weekAmount - a.weekAmount || a.userId.localeCompare(b.userId));
    const viewer = viewerUserId ? members.find((member) => member.userId === viewerUserId) : undefined;

    return {
        amountUnit: goal.amountUnit as HabitAmountUnit,
        weeklyTargetAmount,
        weekStart,
        members,
        viewerWeekAmount: viewer?.weekAmount || 0,
        viewerTotalAmount: viewer?.totalAmount || 0,
        groupWeekAmount: sumSavingsAmounts(members.map((member) => member.weekAmount)),
    };
};
