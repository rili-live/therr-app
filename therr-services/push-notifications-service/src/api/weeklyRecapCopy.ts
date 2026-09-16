/**
 * Which `weeklyRecap` body to render.
 *
 * Split out of `firebaseAdmin.ts` for the same reason as `streakCopy.ts`: the
 * rule can then be tested without importing firebase-admin, which initializes a
 * credential at module load.
 *
 * ## The rule is "do as you are told"
 *
 * Unlike every other selector here, this one does **not** look at the numbers.
 * users-service already decided which story the week tells
 * (`pickWeeklyRecapHeadline`, users-service/utilities/weeklyRecap.ts) and put
 * the answer on the queue row, because the mobile recap screen renders a header
 * from the same decision. Re-deriving it here from `checkinCount` and
 * `perfectDays` would give two services two chances to disagree — and they
 * would, the first time either side's thresholds moved: a push reading "your
 * best week yet" that opens a screen headed "steady week".
 *
 * So the only judgement made here is whether the value is one we have copy for.
 * An unrecognised headline — an older users-service, a hand-made request —
 * falls back to `steady`, which is the one variant that is true of any week
 * with activity in it and interpolates nothing a fallback could get wrong.
 */

export const WEEKLY_RECAP_HEADLINES = [
    'perfectWeek',
    'firstWeek',
    'improved',
    'steady',
    'declined',
] as const;

export type WeeklyRecapHeadline = typeof WEEKLY_RECAP_HEADLINES[number];

const KNOWN_HEADLINES = new Set<string>(WEEKLY_RECAP_HEADLINES);

export const DEFAULT_WEEKLY_RECAP_HEADLINE: WeeklyRecapHeadline = 'steady';

export const resolveWeeklyRecapHeadline = (headline: unknown): WeeklyRecapHeadline => (
    typeof headline === 'string' && KNOWN_HEADLINES.has(headline)
        ? headline as WeeklyRecapHeadline
        : DEFAULT_WEEKLY_RECAP_HEADLINE
);

export const selectWeeklyRecapBodyKey = (headline: unknown): string => (
    `notifications.weeklyRecap.body.${resolveWeeklyRecapHeadline(headline)}`
);

/**
 * The title varies with the headline too — "Your Best Week Yet" and "Last Week
 * In Review" are not interchangeable — but only for the perfect week, which is
 * the one outcome worth naming in the tray before the body is read.
 */
export const selectWeeklyRecapTitleKey = (headline: unknown): string => (
    resolveWeeklyRecapHeadline(headline) === 'perfectWeek'
        ? 'notifications.weeklyRecap.titlePerfect'
        : 'notifications.weeklyRecap.title'
);
