import {
    DEFAULT_SAVINGS_CURRENCY_CODE,
    DEFAULT_SAVINGS_TARGET_SCOPE,
    HabitGoalTypes,
    SavingsAmountError,
    SavingsTargetScope,
    SavingsTargetScopes,
    hasReachedSavingsTarget,
    parseSavingsAmount,
    sumSavingsAmounts,
} from 'therr-js-utilities/constants';

/**
 * Turning per-member savings totals into the progress object the detail views render,
 * and deciding whether a savings goal has been met.
 *
 * Pure — no store, no clock. The interesting cases here are the ones a query cannot
 * show you: a group whose members are all short but whose pot is full, a per-member
 * pact where one person has finished and three have not, a member who left mid-cycle.
 * Each of those is a decision about what "reached" means, and each is a test below
 * rather than a shape inferred from whatever the join happened to return.
 */

/**
 * The translator keys behind each `parseSavingsAmount` failure.
 *
 * Mapped here rather than at each handler so that the check-in endpoint and the habit
 * goal endpoint cannot drift into telling a user two different things about the same
 * rejected number.
 */
export const SAVINGS_AMOUNT_ERROR_KEYS: Record<SavingsAmountError, string> = {
    'not-a-number': 'errorMessages.savings.amountNotANumber',
    negative: 'errorMessages.savings.amountNegative',
    'too-large': 'errorMessages.savings.amountTooLarge',
    'too-precise': 'errorMessages.savings.amountTooPrecise',
};

export interface IValidatedSavingsTarget {
    /** Present only when valid. Keys absent from the request body are absent here. */
    params?: {
        targetAmount?: number | null;
        currencyCode?: string | null;
        savingsTargetScope?: SavingsTargetScope | null;
    };
    errorKey?: string;
}

/**
 * Validate the savings-target fields off a habit goal request body.
 *
 * Absent keys stay absent so the store's `undefined` (leave alone) and `null` (clear)
 * distinction survives all the way from the wire — a PATCH that only renames a habit
 * must not wipe its target.
 *
 * The currency code is length-and-shape checked rather than validated against an ISO
 * 4217 list. It is display-only (nothing converts), the list changes, and rejecting a
 * real currency because our copy of the table is old would block a user from recording
 * their own money.
 */
export const validateSavingsTargetInput = (body: any): IValidatedSavingsTarget => {
    const params: IValidatedSavingsTarget['params'] = {};

    if ('targetAmount' in body) {
        // An explicitly empty target means "open-ended", not "invalid" — hence the
        // null/'' short-circuit before parsing.
        if (body.targetAmount === null || body.targetAmount === '') {
            params.targetAmount = null;
        } else {
            const parsed = parseSavingsAmount(body.targetAmount);
            if (parsed.error) {
                return { errorKey: SAVINGS_AMOUNT_ERROR_KEYS[parsed.error] };
            }
            params.targetAmount = parsed.amount ?? null;
        }
    }

    if ('currencyCode' in body) {
        if (body.currencyCode === null || body.currencyCode === '') {
            params.currencyCode = null;
        } else if (typeof body.currencyCode !== 'string' || !/^[A-Za-z]{3}$/.test(body.currencyCode)) {
            return { errorKey: 'errorMessages.savings.invalidCurrencyCode' };
        } else {
            params.currencyCode = body.currencyCode.toUpperCase();
        }
    }

    if ('savingsTargetScope' in body) {
        if (body.savingsTargetScope === null || body.savingsTargetScope === '') {
            params.savingsTargetScope = null;
        } else if (
            body.savingsTargetScope !== SavingsTargetScopes.PER_MEMBER
            && body.savingsTargetScope !== SavingsTargetScopes.GROUP
        ) {
            return { errorKey: 'errorMessages.savings.invalidTargetScope' };
        } else {
            params.savingsTargetScope = body.savingsTargetScope;
        }
    }

    return { params };
};

export interface ISavingsMemberTotal {
    userId: string;
    totalSaved: number;
    contributionCount: number;
}

export interface ISavingsGoalFields {
    /** Present on real goal rows; unused here, but callers pass whole rows. */
    id?: string;
    goalType?: string | null;
    targetAmount?: number | string | null;
    currencyCode?: string | null;
    savingsTargetScope?: string | null;
}

export interface ISavingsMemberProgress extends ISavingsMemberTotal {
    hasReachedTarget: boolean;
}

export interface ISavingsProgress {
    targetAmount: number | null;
    currencyCode: string;
    scope: SavingsTargetScope;
    totalSaved: number;
    members: ISavingsMemberProgress[];
    isGoalReached: boolean;
    viewerTotalSaved: number;
    remainingAmount: number | null;
}

/**
 * Whether a habit goal is one this feature applies to at all.
 *
 * Gating on `goalType` rather than on "does it have a target" is deliberate: an
 * open-ended savings habit (amounts recorded, no target) must still get a progress
 * object, and a `build_good` habit that somehow acquired a stray target must not.
 */
export const isSavingsGoal = (goal: ISavingsGoalFields | null | undefined): boolean => goal?.goalType === HabitGoalTypes.SAVINGS_GOAL;

/** Reads a stored scope, falling back for the null/legacy/garbage cases alike. */
export const resolveSavingsTargetScope = (scope?: string | null): SavingsTargetScope => (
    scope === SavingsTargetScopes.GROUP ? SavingsTargetScopes.GROUP : DEFAULT_SAVINGS_TARGET_SCOPE
);

/**
 * Normalizes a target to a positive number, or null.
 *
 * Zero and negatives collapse to null rather than being preserved, because "a target of
 * 0" is not a finish line anyone can be short of — treating it as one would mark every
 * savings pact complete on creation.
 */
const resolveTargetAmount = (targetAmount?: number | string | null): number | null => {
    if (targetAmount === null || targetAmount === undefined || targetAmount === '') {
        return null;
    }

    const value = typeof targetAmount === 'string' ? Number(targetAmount) : targetAmount;
    if (!Number.isFinite(value) || value <= 0) {
        return null;
    }

    return value;
};

export interface IBuildSavingsProgressArgs {
    goal: ISavingsGoalFields;
    /** One entry per participant, including those who have contributed nothing. */
    memberTotals: ISavingsMemberTotal[];
    /** Whose `viewerTotalSaved` to report. Omit for a context with no single viewer. */
    viewerUserId?: string;
    /**
     * Which members count toward `isGoalReached` under per-member scope.
     *
     * A pact's *active* members, normally. Someone who left after saving $300 keeps
     * their row and their money in the totals (see the store's comment), but they can no
     * longer check in, so leaving them in the completion test would hold the goal open
     * on a person who is gone. Omit to count everyone in `memberTotals`.
     */
    activeUserIds?: string[];
}

/**
 * Build the progress object for one savings goal.
 *
 * `isGoalReached` is the load-bearing field, and the two scopes answer it differently:
 *
 *   - `group`: the combined pot has reached the target. Who put in what does not matter.
 *   - `per_member`: *every* counted member has reached it individually. Not "any", and
 *     not the average — a pact where one person hit their number and three did not has
 *     not finished, and saying otherwise would complete the pact out from under them.
 *
 * A pact with no counted members is never reached, whatever the totals say. That is the
 * degenerate case of `Array.every`, which is vacuously true on an empty array and would
 * otherwise complete an empty pact the moment it was created.
 */
export const buildSavingsProgress = ({
    goal,
    memberTotals,
    viewerUserId,
    activeUserIds,
}: IBuildSavingsProgressArgs): ISavingsProgress => {
    const scope = resolveSavingsTargetScope(goal.savingsTargetScope);
    const targetAmount = resolveTargetAmount(goal.targetAmount);
    const totalSaved = sumSavingsAmounts(memberTotals.map((member) => member.totalSaved));

    const members: ISavingsMemberProgress[] = memberTotals
        .map((member) => ({
            ...member,
            // Under group scope no individual has met "the" target — the target is the
            // pact's, and flagging a member who happens to exceed it alone would read as
            // "done" next to a pot that is still half empty.
            hasReachedTarget: scope === SavingsTargetScopes.PER_MEMBER
                && hasReachedSavingsTarget(member.totalSaved, targetAmount),
        }))
        .sort((a, b) => b.totalSaved - a.totalSaved);

    const countedMembers = activeUserIds
        ? members.filter((member) => activeUserIds.includes(member.userId))
        : members;

    let isGoalReached = false;
    if (targetAmount !== null) {
        if (scope === SavingsTargetScopes.GROUP) {
            isGoalReached = hasReachedSavingsTarget(totalSaved, targetAmount);
        } else {
            isGoalReached = countedMembers.length > 0
                && countedMembers.every((member) => member.hasReachedTarget);
        }
    }

    const viewerTotalSaved = (viewerUserId
        && members.find((member) => member.userId === viewerUserId)?.totalSaved) || 0;

    // What is left, from the perspective the scope implies: the group's shortfall on a
    // shared pot, the viewer's own on a per-member target. Floored at zero — an
    // overshoot is worth celebrating, not reporting as negative remaining.
    let remainingAmount: number | null = null;
    if (targetAmount !== null) {
        const against = scope === SavingsTargetScopes.GROUP ? totalSaved : viewerTotalSaved;
        remainingAmount = Math.max(0, sumSavingsAmounts([targetAmount, -against]));
    }

    return {
        targetAmount,
        currencyCode: goal.currencyCode || DEFAULT_SAVINGS_CURRENCY_CODE,
        scope,
        totalSaved,
        members,
        isGoalReached,
        viewerTotalSaved,
        remainingAmount,
    };
};
