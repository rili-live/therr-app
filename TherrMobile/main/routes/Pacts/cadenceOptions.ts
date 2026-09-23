/**
 * The cadence a habit is created (or edited) with.
 *
 * Extracted from the wizard for the same reason as `wizardSteps.ts` and `soloHabitUnlock.ts`:
 * the rules survive a refactor of the screen and can be unit-tested without dragging in the
 * React Native module graph.
 *
 * ## What this mirrors, and what it deliberately does not
 *
 * The backend owns cadence outright — `users-service/src/utilities/habitCadence.ts` is the
 * single definition of what `frequencyType` / `frequencyCount` / `targetDaysOfWeek` mean, after
 * four implementations of it disagreed. Nothing here re-implements that engine. `isRequiredOn`,
 * quota arithmetic and "is this week met" all stay server-side and arrive on the API as
 * `weekProgress`.
 *
 * What IS mirrored is the three-line **precedence** — which column wins when more than one is
 * set. That has to exist client-side because the picker has to be able to read an existing goal
 * back into the control the user chose it with. It is the same trade-off, and the same "change
 * both together" warning, that `utilities/streakFreezes.ts` already carries for the freeze
 * constants.
 *
 * `HabitCard`'s cadence label used to get this precedence wrong in exactly the way the old
 * backend did — it required `frequencyType === 'weekly'` before honouring a weekday schedule, so
 * a `custom` goal with fixed days rendered "3x per custom" and a `daily` goal with fixed days
 * rendered "Every day" while the server scheduled it on those weekdays. `fromGoal` is now the
 * one place that decision is made.
 */

/** Sunday-first, matching JS `getDay()` and the `targetDaysOfWeek` column. */
export const MIN_WEEKLY_COUNT = 1;
export const MAX_WEEKLY_COUNT = 7;
export const DEFAULT_WEEKLY_COUNT = 3;

export type CadenceChoice =
    | { kind: 'daily' }
    | { kind: 'weeklyCount'; count: number }
    | { kind: 'weekdays'; days: number[] };

export type CadenceKind = CadenceChoice['kind'];

/** The shape `fromGoal` reads — a habit goal, or the goal fields joined onto a tracked habit. */
export interface ICadenceGoalFields {
    frequencyType?: string | null;
    frequencyCount?: number | null;
    targetDaysOfWeek?: number[] | null;
}

export const DAILY_CADENCE: CadenceChoice = { kind: 'daily' };

/**
 * Where the user stands in this habit's week, as the server computed it.
 *
 * Declared here rather than imported from `therr-react/types`, and that is deliberate. The
 * shared `IHabitWeekProgress` ships with the API change that populates this field, which is a
 * separate PR against `general`. Importing it now would make this branch fail to compile until
 * that one merges *and* `general` is merged down here — for a field that is optional and, until
 * then, always absent. A local structural copy keeps the mobile half independently mergeable:
 * the chip stays dark, and lights up on its own the day the server starts sending the object,
 * because the shapes match.
 *
 * So: change both together. If the server's shape moves, this copy starts lying rather than
 * breaking — the same trade-off, for the same reason, that `utilities/streakFreezes.ts` carries
 * for the freeze constants.
 */
export interface IWeekProgress {
    /** Check-ins already logged this week, not counting today. */
    done: number;
    /** The week's target. 7 for a daily habit. */
    target: number;
    /** Days left in the week, today included. */
    daysLeft: number;
    /** Whether skipping today would put the target out of reach. */
    isRequiredToday: boolean;
    /** Whether the target is already met. */
    isMet: boolean;
}

export const clampWeeklyCount = (value: unknown): number => {
    const count = Math.round(Number(value));
    if (!Number.isFinite(count)) {
        return DEFAULT_WEEKLY_COUNT;
    }
    return Math.max(MIN_WEEKLY_COUNT, Math.min(MAX_WEEKLY_COUNT, count));
};

/** Discard junk, de-duplicate, and order — matching the server's `sanitizeTargetDays`. */
export const sanitizeWeekdays = (value: unknown): number[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const days = value
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return Array.from(new Set(days)).sort((a, b) => a - b);
};

/**
 * Read a goal back into the choice the user made.
 *
 * Precedence, identical to the server's `getCadence`: an explicit weekday schedule wins over
 * `frequencyType` **in both directions**, then `daily`, then a per-week count.
 */
export const fromGoal = (goal?: ICadenceGoalFields | null): CadenceChoice => {
    const days = sanitizeWeekdays(goal?.targetDaysOfWeek);
    if (days.length) {
        return { kind: 'weekdays', days };
    }

    if (!goal?.frequencyType || goal.frequencyType === 'daily') {
        return DAILY_CADENCE;
    }

    return { kind: 'weeklyCount', count: clampWeeklyCount(goal.frequencyCount) };
};

/**
 * The three columns to send on create or update.
 *
 * `targetDaysOfWeek` is an **empty array**, never `undefined`, for the two shapes that have no
 * weekday schedule. Knex's `.update()` skips `undefined` keys, so sending `undefined` when a
 * user switches from "Mon/Wed/Fri" to "4x per week" would leave the old array in place — and
 * since a populated `targetDaysOfWeek` outranks `frequencyType`, the habit would silently keep
 * its old schedule while the app showed the new one. An empty array clears it, and the server
 * reads it as "no fixed days" for the same reason `sanitizeTargetDays` does.
 */
export const toGoalFields = (choice: CadenceChoice) => {
    if (choice.kind === 'weekdays') {
        const days = sanitizeWeekdays(choice.days);
        return {
            frequencyType: 'weekly',
            // Kept in step with the schedule so the weekly target is still right if the array
            // is ever dropped in transit.
            frequencyCount: days.length,
            targetDaysOfWeek: days,
        };
    }

    if (choice.kind === 'weeklyCount') {
        return {
            frequencyType: 'weekly',
            frequencyCount: clampWeeklyCount(choice.count),
            targetDaysOfWeek: [] as number[],
        };
    }

    return {
        frequencyType: 'daily',
        frequencyCount: 1,
        targetDaysOfWeek: [] as number[],
    };
};

/**
 * Whether the choice is submittable. Only `weekdays` can be incomplete — "specific days" with
 * nothing selected asks for a schedule with no days in it, which the server would read as a
 * once-a-week habit rather than refusing, so the client has to stop it.
 */
export const isComplete = (choice: CadenceChoice): boolean => {
    if (choice.kind === 'weekdays') {
        return sanitizeWeekdays(choice.days).length > 0;
    }
    return true;
};

/** Toggle one weekday in a `weekdays` choice, leaving the others alone. */
export const toggleWeekday = (choice: CadenceChoice, day: number): CadenceChoice => {
    const current = choice.kind === 'weekdays' ? sanitizeWeekdays(choice.days) : [];
    const days = current.includes(day)
        ? current.filter((d) => d !== day)
        : sanitizeWeekdays([...current, day]);

    return { kind: 'weekdays', days };
};

/**
 * A stable string for a choice, folded into the wizard's goal cache key.
 *
 * `resolveHabitGoalId` caches the goal it created under the step-1 selection so that retrying a
 * failed invite does not create a second goal (and a second charge against the free-tier cap).
 * Cadence was not part of that key, so changing the cadence and resubmitting would silently
 * reuse the goal built with the *old* one — no error, just a habit on the wrong schedule.
 */
export const cacheKey = (choice: CadenceChoice): string => {
    if (choice.kind === 'weekdays') {
        return `weekdays:${sanitizeWeekdays(choice.days).join(',')}`;
    }
    if (choice.kind === 'weeklyCount') {
        return `weekly:${clampWeeklyCount(choice.count)}`;
    }
    return 'daily';
};

/** Whether two choices describe the same cadence — used to skip a no-op update request. */
export const isSameCadence = (a: CadenceChoice, b: CadenceChoice): boolean => cacheKey(a) === cacheKey(b);

/**
 * Whether this user may change the goal's cadence. The server refuses an edit (403) from anyone
 * but the goal's creator, and on a template outright — and a pact partner tracks the goal the
 * inviter created, so offering them the control only leads to a generic failure toast. Hide it
 * instead of letting it fail.
 */
export const canEditCadence = (
    goal?: { createdByUserId?: string | null; isTemplate?: boolean | null } | null,
    userId?: string | null,
): boolean => !!goal && !!userId && !goal.isTemplate && goal.createdByUserId === userId;
