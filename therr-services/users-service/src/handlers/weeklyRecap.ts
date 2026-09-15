import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import { getLocalDate, resolveCheckinTimeZone } from '../utilities/dailyStreak';
import { resolveRequestedWeekStart } from '../utilities/weeklyRecap';
import { buildWeeklyRecap } from './helpers/weeklyRecap';

/**
 * GET /habits/weekly-recap/me?weekStart=<YYYY-MM-DD>&timeZone=<IANA>
 *
 * One Monday–Sunday week of the user's habit activity: the day strip, per-day and
 * per-habit check-in counts, the streak as it stood when the week closed, and the
 * same totals for the week before.
 *
 * `weekStart` may be any date inside the week the caller wants — the notification
 * payload carries the Monday, but a client that has a Thursday in hand should get
 * the same answer. Omitted, it means the most recently *closed* week, which is
 * what the notification is about and therefore the right default for a cold open
 * from the tray.
 *
 * `timeZone` is the device zone, used only when the account has no
 * `settingsTimezone` — the same precedence as the daily streak, so the two screens
 * can never disagree about which days belong to which week.
 */
const getMyWeeklyRecap: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    try {
        const [user] = await Store.users.getUserById(userId, ['id', 'settingsTimezone']);
        const timeZone = resolveCheckinTimeZone(user?.settingsTimezone, req.query?.timeZone);
        const today = getLocalDate(timeZone);
        // Junk in `weekStart` resolves to the default week rather than answering
        // 400. The one caller that always sets it is a notification tap, and a
        // recap screen that refuses to open because a payload was malformed is
        // strictly worse than one that opens on last week.
        const weekStartDate = resolveRequestedWeekStart(req.query?.weekStart, today);

        const recap = await buildWeeklyRecap({ userId, weekStartDate, timeZone });

        return res.status(200).send(recap);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:WEEKLY_RECAP_ROUTES:ERROR' });
    }
};

export {
    getMyWeeklyRecap,
};
