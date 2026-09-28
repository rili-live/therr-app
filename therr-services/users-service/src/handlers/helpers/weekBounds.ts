import Store from '../../store';
import { getLocalDate, getWeekStart, resolveCheckinTimeZone } from '../../utilities/dailyStreak';

/**
 * The user's own Monday and their own today, resolved the same way every other habits read
 * resolves a day: saved `settingsTimezone` first, then the zone the client reported on this
 * request, then the service fallback (`resolveCheckinTimeZone`).
 *
 * A week is a *local* week. Using the server's would put the Monday boundary in the wrong
 * place for most of the world, and a weekly quota that resets on the wrong day is worse than
 * one that is not reported at all.
 *
 * Fails soft: a failed user read returns `undefined`, the tally column comes back NULL, and
 * the response simply carries no `weekProgress` — the habits list itself still renders.
 */
const resolveWeekBounds = async (
    userId: string,
    deviceTimezone?: unknown,
): Promise<{ weekStart: string; today: string } | undefined> => {
    const [user] = await Store.users
        .getUserById(userId, ['id', 'settingsTimezone'])
        .catch(() => [] as any[]);

    const timeZone = resolveCheckinTimeZone(user?.settingsTimezone, deviceTimezone);
    const today = getLocalDate(timeZone);

    return { weekStart: getWeekStart(today), today };
};

export default resolveWeekBounds;
