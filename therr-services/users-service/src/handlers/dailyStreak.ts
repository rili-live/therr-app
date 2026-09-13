import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import { clampCelebratedDate, isDateString } from '../utilities/dailyStreak';
import { evaluateAllDailyStreaks, getDailyStreakSummary } from './helpers/dailyStreak';
import { closeElapsedLeaderboardPeriods } from './helpers/leaderboardPeriods';

/**
 * GET /habits/daily-streak/me?timeZone=<IANA>
 *
 * The app-level daily streak for the requesting user: current/longest, this week's strip, and
 * what the client owes the user right now — a pending celebration (server-decided: last upheld
 * day is today and today has not been celebrated) and any unacknowledged leaderboard
 * placements. Lazily finalizes every day through the user's local yesterday first, so the
 * numbers are right even for a user the scheduled pass has not reached.
 *
 * `timeZone` is the device zone, used only when the account has no `settingsTimezone`.
 */
const getMyDailyStreak: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }

    try {
        const [user] = await Store.users.getUserById(userId, ['id', 'settingsTimezone']);
        const summary = await getDailyStreakSummary(userId, req.headers, {
            settingsTimezone: user?.settingsTimezone,
            deviceTimezone: req.query?.timeZone,
            brand: brandVariation,
        });
        return res.status(200).send(summary);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DAILY_STREAK_ROUTES:ERROR' });
    }
};

/**
 * POST /habits/daily-streak/me/celebrated { date, timeZone? }
 *
 * The client showed today's celebration. Gates one celebration per local day: after this,
 * `pendingCelebration` is null for that day. `date` must be the local day the client was
 * celebrating (the `today` it was handed), so a dismissal cannot mark a different day.
 *
 * `date` is clamped to the user's local today (see `clampCelebratedDate`): a value in the
 * future — a skewed device clock, or a hand-made request — would otherwise hold
 * `pendingCelebration` null until that day arrives, silencing every celebration in between.
 * A date in the past is left alone; the day can legitimately roll over between the fetch that
 * offered the celebration and the dismissal that reports it.
 */
const markDailyStreakCelebrated: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { date: requestedDate, timeZone: deviceTimezone } = req.body || {};

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }
    if (!isDateString(requestedDate)) {
        return handleHttpError({
            res,
            message: 'date (YYYY-MM-DD) is required',
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    try {
        const [user] = await Store.users.getUserById(userId, ['id', 'settingsTimezone']);
        const date = clampCelebratedDate(requestedDate, {
            settingsTimezone: user?.settingsTimezone,
            deviceTimezone,
        });
        await Store.userDailyStreaks.getOrCreate(userId);
        const updated = await Store.userDailyStreaks.update(userId, { lastCelebratedDate: date });
        return res.status(200).send({ lastCelebratedDate: updated?.lastCelebratedDate || date });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DAILY_STREAK_ROUTES:ERROR' });
    }
};

/**
 * POST /habits/daily-streak/evaluate-all
 *
 * INTERNAL — not registered in the API gateway. The scheduled pass: finalizes yesterday for
 * every user with a habit streak (each in their own timezone) and closes the elapsed
 * leaderboard period for every brand. Idempotent at any cadence; hourly is the intended one, so
 * every zone is swept a few hours after its midnight without timezone bucketing. Also invoked
 * from the daily habits digest so it runs in production without a second scheduler job.
 */
const evaluateAllDailyStreaksHandler: RequestHandler = async (req: any, res: any) => {
    try {
        const [streaks, periodsClosed] = await Promise.all([
            evaluateAllDailyStreaks(),
            closeElapsedLeaderboardPeriods(),
        ]);
        const counters = { ...streaks, periodsClosed };
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Daily streak evaluate-all completed'],
            traceArgs: { ...streaks, 'leaderboard.periodsClosed': JSON.stringify(periodsClosed) },
        });
        return res.status(200).send(counters);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:DAILY_STREAK_ROUTES:ERROR' });
    }
};

export {
    getMyDailyStreak,
    markDailyStreakCelebrated,
    evaluateAllDailyStreaksHandler,
};
