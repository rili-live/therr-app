import Store from '../store';

/**
 * The names habits notification copy interpolates.
 *
 * Every habits push body is name-anchored — "{partnerName} hit Day
 * {streakCount} on {habitName}" — and `translate` leaves a placeholder it was
 * not given standing verbatim (therr-js-utilities/src/localization.ts). So a
 * caller that skips one of these does not render a slightly generic
 * notification; it renders braces, or a sentence with a hole in it. Both
 * shipped: `partnerCheckedIn` and `streakMilestone` were sent inline with no
 * names at all.
 *
 * Centralized so the digest and the inline check-in path agree on what a person
 * is called. They disagreed before — the digest preferred `firstName`, the
 * inline senders passed the header `userName` or nothing — which meant the same
 * partner was named two different ways depending on which notification arrived.
 */

const FALLBACK_PARTNER_NAME = 'Your partner';
const FALLBACK_HABIT_NAME = 'your habit';

/**
 * First name where we have one, handle otherwise.
 *
 * Deliberately not the full name: these strings sit in a notification title
 * that Android truncates at roughly 40 characters, and the title is the half
 * the user reads from the lock screen.
 */
export const resolveUserDisplayName = async (userId: string): Promise<string> => {
    if (!userId) {
        return FALLBACK_PARTNER_NAME;
    }
    const rows = await Store.users.findUser({ id: userId }, ['userName', 'firstName']).catch(() => []);

    return rows?.[0]?.firstName || rows?.[0]?.userName || FALLBACK_PARTNER_NAME;
};

export const resolveHabitDisplayName = async (habitGoalId: string): Promise<string> => {
    if (!habitGoalId) {
        return FALLBACK_HABIT_NAME;
    }
    const goal = await Store.habitGoals.getById(habitGoalId).catch(() => null);

    return goal?.name || FALLBACK_HABIT_NAME;
};

/**
 * Memoized wrappers for a batch job.
 *
 * The digest walks up to 500 pacts and 2000 habits in one run and names the
 * same handful of people and habits over and over; without a cache that is a
 * read per notification, against the same rows.
 */
export const createNameResolvers = () => {
    const userNameCache = new Map<string, string>();
    const habitNameCache = new Map<string, string>();

    return {
        getUserDisplayName: async (userId: string): Promise<string> => {
            if (!userNameCache.has(userId)) {
                userNameCache.set(userId, await resolveUserDisplayName(userId));
            }
            return userNameCache.get(userId) as string;
        },
        getHabitName: async (habitGoalId: string): Promise<string> => {
            if (!habitNameCache.has(habitGoalId)) {
                habitNameCache.set(habitGoalId, await resolveHabitDisplayName(habitGoalId));
            }
            return habitNameCache.get(habitGoalId) as string;
        },
    };
};
