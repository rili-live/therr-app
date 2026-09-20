import { PushNotifications } from 'therr-js-utilities/constants';

/**
 * Copy and action rules for the daily "go check in" nudge.
 *
 * Split out of `firebaseAdmin.ts` for the same reason as `streakCopy.ts`: that
 * module initializes a Firebase credential at import time, so nothing there is
 * testable in isolation.
 *
 * The rules here exist because the habits digest now rolls every check-in
 * reminder for a user into ONE notification per day
 * (`users-service/src/handlers/habitsDigest.ts`). That roll-up is what removed
 * the burst of near-identical pushes, and it is also what makes both rules
 * below necessary: a nudge that covers three habits cannot use the singular
 * copy, and it has nothing unambiguous to check into.
 */

/** How many habit names the plural copy lists before it stops. */
export const MAX_LISTED_HABIT_NAMES = 3;

/**
 * True when the notification names exactly one habit goal, and therefore when a
 * "Check In" button can complete something without asking the user which habit
 * they meant.
 *
 * Both halves matter. `habitCount > 1` is a roll-up covering several habits;
 * a missing `habitGoalId` is a notification whose producer never resolved one
 * (every inline sender predates the field). Offering the button in either case
 * would give the user an action that silently does nothing or, worse, checks in
 * the wrong habit.
 */
export const shouldOfferOnePressCheckin = (
    habitGoalId: unknown,
    habitCount: unknown,
): boolean => {
    if (!habitGoalId || typeof habitGoalId !== 'string') {
        return false;
    }
    // `undefined` means "not a roll-up" — a single-habit producer that never
    // set the field. Only an explicit count above one suppresses the action.
    const count = habitCount === undefined || habitCount === null ? 1 : Number(habitCount);

    return !Number.isNaN(count) && count <= 1;
};

/**
 * The dictionary namespace each check-in nudge type renders its copy from.
 *
 * Three types, one notification: the digest's roll-up picks between them per
 * user per slot (`users-service/src/utilities/checkinNudgeRollup.ts` and the
 * evening slot in `habitsDigest.ts`). Keeping the mapping in one table rather
 * than a ternary is what let `eveningCheckIn` join without the plural copy for
 * the new type silently resolving to `dailyHabitReminder`'s — which would have
 * rendered "one check-in gets you started" as a last-chance warning, with
 * nothing failing anywhere.
 */
const CHECKIN_NUDGE_COPY_NAMESPACES: Partial<Record<PushNotifications.Types, string>> = {
    [PushNotifications.Types.streakAtRisk]: 'notifications.streakAtRisk',
    [PushNotifications.Types.dailyHabitReminder]: 'notifications.dailyHabitReminder',
    [PushNotifications.Types.eveningCheckIn]: 'notifications.eveningCheckIn',
};

/**
 * The dictionary namespace for a nudge type. Unlisted types fall back to
 * `dailyHabitReminder`, which is the neutral framing and what the ternary this
 * replaced already did for everything that was not `streakAtRisk`.
 */
export const getCheckinNudgeCopyNamespace = (
    type: PushNotifications.Types,
): string => CHECKIN_NUDGE_COPY_NAMESPACES[type] || 'notifications.dailyHabitReminder';

/**
 * Whether a nudge should render the weekly-progress body rather than the daily one.
 *
 * True only for a habit whose cadence asks for fewer than seven check-ins a week. "Log it today"
 * is the right sentence for a daily habit; for "4x per week" the useful sentence is where the
 * user stands in the week, because that is the thing they are actually being held to.
 *
 * A target of 7 (or absent, or junk) means daily, and daily copy is unchanged — which is what
 * keeps this inert for nearly every notification the digest sends today.
 */
export const hasWeeklyTargetCopy = (weekTarget: unknown): boolean => {
    const target = Number(weekTarget);
    return Number.isInteger(target) && target > 0 && target < 7;
};

/**
 * Which body copy a check-in nudge renders.
 *
 * Precedence, and each step is there for a reason:
 *
 *   1. A roll-up covering several habits must use the plural copy — the singular body names one
 *      habit and would misrepresent the rest.
 *   2. A freeze-aware singular body wins over the weekly one. Both `streakAtRisk` and
 *      `eveningCheckIn` pass a key already resolved by `streakCopy.ts`, and "a freeze will cover
 *      tonight" is more urgent and more actionable than a progress count — telling someone their
 *      streak is on the line while silently holding a net is the whole failure that copy exists
 *      to prevent.
 *   3. Otherwise a non-daily habit gets the weekly-progress body.
 *   4. Otherwise the daily singular body, exactly as before.
 */
export const selectCheckinNudgeBodyKey = (
    type: PushNotifications.Types,
    habitCount: unknown,
    singularKey: string,
    weekTarget?: unknown,
): string => {
    const count = Number(habitCount || 0);

    if (count > 1) {
        return `${getCheckinNudgeCopyNamespace(type)}.bodyMultiple`;
    }

    if (!singularKey.endsWith('.bodyWithFreeze') && hasWeeklyTargetCopy(weekTarget)) {
        return `${getCheckinNudgeCopyNamespace(type)}.bodyWeekly`;
    }

    return singularKey;
};

/**
 * Renders the habit list the plural copy interpolates.
 *
 * Truncated rather than paginated: the point of naming habits at all is
 * recognition, and a notification body that lists nine of them is read as a
 * wall of text and dismissed. The count is carried separately, so the copy can
 * still say how many there are in total.
 *
 * Accepts the JSON-string form too — the notification queue round-trips its
 * payload through `jsonb` and the FCM `data` map is string->string, so this
 * value reaches the service as an array on one path and a string on the other.
 */
export const formatHabitNames = (habitNames: unknown): string => {
    let names: unknown = habitNames;

    if (typeof names === 'string') {
        try {
            names = JSON.parse(names);
        } catch (e) {
            // A bare, un-encoded name. Treat it as a one-element list rather
            // than dropping it — the copy reads correctly either way.
            return String(habitNames);
        }
    }

    if (!Array.isArray(names)) {
        return '';
    }

    return names
        .filter((name) => typeof name === 'string' && name.length)
        .slice(0, MAX_LISTED_HABIT_NAMES)
        .join(', ');
};
