import { IWeekProgress } from '../Pacts/cadenceOptions';

/**
 * How much attention a habit needs right now, for ordering the dashboard list and colouring its
 * card. Most pressing first:
 *
 *   - `streakAtRisk` a live streak on a day the habit requires. Skipping tonight costs it.
 *   - `dueToday`     a required day with no streak yet, on a habit with a weekly target
 *                    (a quota or fixed weekdays). Skipping it misses the week.
 *   - `dueSoon`      a quota that can skip today, but not today *and* tomorrow.
 *   - `onTrack`      room to spare, or a daily habit with no streak to lose.
 *   - `restDay`      a fixed-weekday habit on one of its off days.
 *   - `done`         checked in today, or the week's quota is already met.
 *
 * Whether a day is required is the server's call (`weekProgress.isRequiredToday` / `urgency`,
 * from users-service `habitCadence.ts`), never re-derived here. With no `weekProgress` at all the
 * habit is `onTrack`: unknown is not the same as at risk, and a warning colour we cannot back up
 * is the same noise the push reminders were changed to stop making.
 *
 * Kept free of react-native imports so it is unit-testable without the native module graph.
 */
export type HabitRisk = 'streakAtRisk' | 'dueToday' | 'dueSoon' | 'onTrack' | 'restDay' | 'done';

const RISK_RANK: Record<HabitRisk, number> = {
    streakAtRisk: 0,
    dueToday: 1,
    dueSoon: 2,
    onTrack: 3,
    restDay: 4,
    done: 5,
};

export interface IHabitRiskInput {
    isCompletedToday: boolean;
    weekProgress?: IWeekProgress;
    /** The habit's live streak, 0 when it has none or the streak is inactive. */
    streakCount: number;
}

export const getHabitRisk = ({ isCompletedToday, weekProgress, streakCount }: IHabitRiskInput): HabitRisk => {
    if (isCompletedToday) {
        return 'done';
    }
    if (!weekProgress) {
        return 'onTrack';
    }

    const urgency = weekProgress.urgency
        // A server that predates `urgency` still sends the two booleans it is built from.
        || (weekProgress.isMet ? 'met' : (weekProgress.isRequiredToday ? 'required' : 'flexible'));

    if (urgency === 'met') {
        return 'done';
    }
    if (urgency === 'rest') {
        return 'restDay';
    }
    if (urgency === 'soon') {
        return 'dueSoon';
    }
    if (urgency === 'required') {
        if (streakCount > 0) {
            return 'streakAtRisk';
        }
        // A daily habit is required every day, so without a streak "due today" would put a
        // warning outline on every daily habit a new user has. Only a weekly target is lost by
        // skipping today with nothing built yet.
        return weekProgress.target < 7 ? 'dueToday' : 'onTrack';
    }
    return 'onTrack';
};

/**
 * Local hour from which a streak at risk is outlined in red rather than amber. Before it the day
 * still has room, and a screen of red cards at breakfast for someone with five daily streaks
 * would make red mean nothing by the evening, when it matters.
 */
export const STREAK_DANGER_FROM_HOUR = 18;

/** Whether the card gets a warning outline, and which. */
export const getHabitRiskTone = (risk: HabitRisk, localHour: number): 'danger' | 'warning' | null => {
    if (risk === 'streakAtRisk') {
        return localHour >= STREAK_DANGER_FROM_HOUR ? 'danger' : 'warning';
    }
    if (risk === 'dueToday' || risk === 'dueSoon') {
        return 'warning';
    }
    return null;
};

/**
 * Most pressing first; within a tier, the longer streak first (more to lose), then the order the
 * list came in, so two renders of the same data never reshuffle.
 */
export const sortByHabitRisk = <T>(
    items: T[],
    describe: (item: T) => { risk: HabitRisk; streakCount: number },
): T[] => items
        .map((item, index) => ({ item, index, ...describe(item) }))
        .sort((a, b) => (RISK_RANK[a.risk] - RISK_RANK[b.risk])
        || (b.streakCount - a.streakCount)
        || (a.index - b.index))
        .map(({ item }) => item);
