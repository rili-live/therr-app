import Store from '../store';
import {
    DEFAULT_USER_HABIT_NOTIFICATION_PREFERENCES,
    IUserHabitNotificationPreferences,
} from '../store/UserHabitsStore';

/**
 * Reads the per-habit notification switches for a batch job.
 *
 * ## Why a resolver and not a direct read
 *
 * The switches live on `habits.user_habits`, one row per (user, habit) — see
 * `20260919000001_habits.user_habits.notificationPrefs.js`. The digest needs
 * them in two very different shapes:
 *
 *   - The reminder pass already holds them. `getActiveForReminders` selects the
 *     four columns as part of the single query it runs for the whole run, so
 *     asking the database again for a row it just read would be pure waste.
 *   - The pact loop does not. It walks pact *members*, and a member's habit may
 *     be archived or may have fallen outside `DIGEST_MAX_HABITS`, so it is not
 *     necessarily in the reminder pass's result set.
 *
 * So the resolver is seeded from whatever the caller already has and reads only
 * the pairs it does not, once each, memoized for the run.
 *
 * ## Failing open
 *
 * Every lookup that cannot be answered — no tracking row, a failed read —
 * returns `DEFAULT_USER_HABIT_NOTIFICATION_PREFERENCES`, i.e. everything on.
 * That is deliberate. Failing closed would turn a transient database problem
 * into silence, which is the failure mode nobody reports because it looks
 * exactly like having nothing to say.
 */

export type SeedRow = { userId: string; habitGoalId: string } & Partial<IUserHabitNotificationPreferences>;

export type HabitNotificationPreferenceResolver = {
    /** Preferences for one pair, from cache or a single read. */
    get: (userId: string, habitGoalId: string) => Promise<IUserHabitNotificationPreferences>;
    /**
     * Preferences for one pair from the cache alone — no read, no await.
     *
     * For the call sites that have just `prime`d the whole membership and then
     * ask about each member in turn: `get` would answer from cache there too,
     * but reads as a query in a loop and needs an `await` (and an
     * `eslint-disable no-await-in-loop`) that is doing nothing. A pair that
     * was never primed or seeded fails open to the defaults, exactly as `get`
     * does when the read comes back empty.
     */
    peek: (userId: string, habitGoalId: string) => IUserHabitNotificationPreferences;
    /** Warm the cache for many pairs in one read. */
    prime: (pairs: { userId: string; habitGoalId: string }[]) => Promise<void>;
    /**
     * Warm the cache from rows that already carry the columns, at no cost.
     *
     * Separate from the constructor because the digest creates the resolver
     * before it reads the reminder rows — the expired-pact sweep runs first and
     * needs to ask about pacts nobody's reminder row covers. Rows already cached
     * are left alone, so a later seed cannot overwrite a value read from the
     * database mid-run.
     */
    seed: (rows: SeedRow[]) => void;
};

export const preferenceCacheKey = (userId: string, habitGoalId: string): string => `${userId}:${habitGoalId}`;

/**
 * @param seed Rows that already carry the four columns — typically the reminder
 *             pass's `getActiveForReminders` result. Seeding is synchronous and
 *             costs no reads.
 */
export const createHabitNotificationPreferenceResolver = (
    seedRows: SeedRow[] = [],
): HabitNotificationPreferenceResolver => {
    const cache = new Map<string, IUserHabitNotificationPreferences>();

    // `!== false` rather than a truthiness check: the columns are NOT NULL
    // booleans, but a seed row may come from a query written before they
    // existed, and an absent value means "on" everywhere in this feature.
    const normalize = (row: Partial<IUserHabitNotificationPreferences>): IUserHabitNotificationPreferences => ({
        notifyReminders: row.notifyReminders !== false,
        notifyStreakAlerts: row.notifyStreakAlerts !== false,
        notifyPartnerActivity: row.notifyPartnerActivity !== false,
        notifyPactUpdates: row.notifyPactUpdates !== false,
    });

    const seed = (rows: SeedRow[]): void => {
        rows.forEach((row) => {
            const key = row?.userId && row?.habitGoalId ? preferenceCacheKey(row.userId, row.habitGoalId) : null;
            if (key && !cache.has(key)) {
                cache.set(key, normalize(row));
            }
        });
    };

    seed(seedRows);

    const prime = async (pairs: { userId: string; habitGoalId: string }[]): Promise<void> => {
        const missing = pairs.filter((pair) => pair?.userId
            && pair?.habitGoalId
            && !cache.has(preferenceCacheKey(pair.userId, pair.habitGoalId)));

        if (!missing.length) {
            return;
        }

        const found = await Store.userHabits.getNotificationPreferencesForPairs(missing).catch(() => ({}));

        // Every pair asked for is cached, including the ones with no row, so a
        // user who tracks a habit only through a pact is not re-queried once per
        // notification for the rest of the run.
        missing.forEach((pair) => {
            const key = preferenceCacheKey(pair.userId, pair.habitGoalId);
            cache.set(key, found[key] || DEFAULT_USER_HABIT_NOTIFICATION_PREFERENCES);
        });
    };

    const peek = (userId: string, habitGoalId: string): IUserHabitNotificationPreferences => {
        if (!userId || !habitGoalId) {
            return DEFAULT_USER_HABIT_NOTIFICATION_PREFERENCES;
        }

        return cache.get(preferenceCacheKey(userId, habitGoalId)) || DEFAULT_USER_HABIT_NOTIFICATION_PREFERENCES;
    };

    return {
        prime,
        seed,
        peek,
        get: async (userId: string, habitGoalId: string): Promise<IUserHabitNotificationPreferences> => {
            if (!userId || !habitGoalId) {
                return DEFAULT_USER_HABIT_NOTIFICATION_PREFERENCES;
            }

            const key = preferenceCacheKey(userId, habitGoalId);

            if (!cache.has(key)) {
                await prime([{ userId, habitGoalId }]);
            }

            return peek(userId, habitGoalId);
        },
    };
};

export default createHabitNotificationPreferenceResolver;
