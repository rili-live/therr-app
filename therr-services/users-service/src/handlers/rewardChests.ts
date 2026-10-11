import { randomInt } from 'crypto';
import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import {
    addDays,
    getLatestReportableLocalDate,
    getWeekEnd,
    getWeekStart,
    isDailyStreakMilestone,
    isDateString,
} from '../utilities/dailyStreak';
import { getRewardChestTier, isRewardChestEnabled, rollRewardChest } from '../utilities/rewardChest';
import { buildWeek, getPendingCelebration } from './helpers/dailyStreak';
import { awardLeaderboardPoints } from './helpers/leaderboards';

/**
 * POST /habits/daily-streak/me/reward-chest { date, timeZone? }
 *
 * Open the day's reward chest: roll its XP, record it, pay it onto the leaderboard. `date` is the
 * `today` the client was handed with the celebration, clamped like `markDailyStreakCelebrated`.
 *
 * A chest exists only for a day the user upheld their streak (`lastUpheldDate === date`), and no
 * further back than yesterday, so a past chest cannot be collected later. The roll is written
 * before it is paid, and the (user, source, day) UNIQUE constraint decides the race: a double
 * tap, a retry or a second device gets the first roll back with `alreadyOpened: true` and is paid
 * nothing.
 *
 * 404 when chests are switched off, 409 when no chest is owed for that day.
 */
const openDailyRewardChest: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const { date: requestedDate, timeZone: deviceTimezone } = req.body || {};

    if (!userId) {
        return handleHttpError({ res, message: 'Unauthorized', statusCode: 401 });
    }
    if (!isRewardChestEnabled()) {
        return handleHttpError({
            res, message: 'Reward chests are disabled', statusCode: 404, errorCode: ErrorCodes.NOT_FOUND,
        });
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
        const localToday = getLatestReportableLocalDate({
            settingsTimezone: user?.settingsTimezone,
            deviceTimezone,
        });
        const date = requestedDate > localToday ? localToday : requestedDate;

        const existing = await Store.rewardChests.get(userId, 'daily-streak', date);
        if (existing) {
            return res.status(200).send({ ...existing, alreadyOpened: true });
        }

        const state = await Store.userDailyStreaks.getOrCreate(userId);
        if (date < addDays(localToday, -1) || state.lastUpheldDate !== date) {
            return handleHttpError({
                res,
                message: 'No reward chest is owed for this day',
                statusCode: 409,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        // The tier is judged the way the celebration that offered the chest judged it, but
        // without its "not yet celebrated" gate: the chest can be opened either side of the
        // dismissal that marks the day celebrated.
        const rows = await Store.dailyStreakDays.getRange(userId, getWeekStart(date), getWeekEnd(date));
        const celebration = getPendingCelebration({ ...state, lastCelebratedDate: null }, date, buildWeek(date, rows));
        const tier = getRewardChestTier({
            isMilestone: isDailyStreakMilestone(state.currentStreak),
            isPerfectWeek: !!celebration?.isPerfectWeek,
        });
        const roll = rollRewardChest(tier, randomInt);

        const claimed = await Store.rewardChests.claim({
            userId,
            brandVariation,
            source: 'daily-streak',
            sourceKey: date,
            ...roll,
        });
        if (!claimed) {
            // Lost the race to a concurrent open; replay the winner's roll.
            const winner = await Store.rewardChests.get(userId, 'daily-streak', date, true);
            return res.status(200).send({ ...winner, alreadyOpened: true });
        }

        // Awaited so the leaderboard the client refetches next already includes it. Never
        // throws: a failed award is logged inside and the opened chest stands.
        await awardLeaderboardPoints(req.headers, claimed.rewardXp, `reward-chest:${claimed.id}`);

        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Reward chest opened'],
            traceArgs: {
                'user.id': userId,
                'rewardChest.tier': claimed.tier,
                'rewardChest.rarity': claimed.rarity,
                'rewardChest.rewardXp': claimed.rewardXp,
                'rewardChest.streak': state.currentStreak,
            },
        });

        return res.status(201).send({ ...claimed, alreadyOpened: false });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:REWARD_CHEST_ROUTES:ERROR' });
    }
};

export {
    openDailyRewardChest,
};
