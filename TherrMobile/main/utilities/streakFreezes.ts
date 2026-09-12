/**
 * The streak-freeze allowance, mirrored from users-service.
 *
 * Source of truth is the backend: `StreaksStore.getOrCreate` seeds
 * `gracePeriodDays: 1`, `habitCheckins` grants one more at every 7+ day
 * milestone, and `streakHelpers.MAX_GRACE_PERIOD_DAYS` caps it at 3. These are
 * duplicated here because the rule has to be *stated* before a user has a
 * streak at all — at habit creation there is no `habits.streaks` row to read it
 * from, and a rule the user only learns after the fact is not a rule agreed in
 * advance.
 *
 * If the backend numbers move, this copy starts lying rather than breaking, so
 * change both together.
 */
export const STARTING_STREAK_FREEZES = 1;
export const STREAK_FREEZE_EARN_INTERVAL_DAYS = 7;
export const MAX_STREAK_FREEZES = 3;

/** Translate params for the "here is the allowance" copy. */
export const streakFreezeRuleParams = {
    starting: STARTING_STREAK_FREEZES,
    interval: STREAK_FREEZE_EARN_INTERVAL_DAYS,
    max: MAX_STREAK_FREEZES,
};

/**
 * Whether a check-in response reports that a freeze was spent on it.
 *
 * `graceDaysConsumed` was added to the `POST /habits/checkins` 201 after this
 * screen shipped, so an older server simply omits it — which must read as "no
 * freeze was spent", never as one. Announcing a save that did not happen is
 * worse than staying quiet: it tells the user the net caught them on a day it
 * did not.
 */
export const getFreezeConsumed = (checkin: any): number => {
    const consumed = Number(checkin?.graceDaysConsumed);
    return Number.isFinite(consumed) && consumed > 0 ? consumed : 0;
};

/** The streak length a freeze preserved, for the confirmation copy. */
export const getStreakSavedByFreeze = (checkin: any): number => {
    const saved = Number(checkin?.streakSavedByFreeze);
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
};
