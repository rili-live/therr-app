import { randomInt } from 'crypto';
import { BrandVariations } from 'therr-js-utilities/constants';
import { getBrandContext } from 'therr-js-utilities/http';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { IDBDailyBonus } from '../../store/DailyBonusesStore';
import { IDBUserDailyStreak } from '../../store/UserDailyStreaksStore';
import {
    getWeekEnd,
    getWeekStart,
    isDailyStreakMilestone,
    isWeekEnd,
    isWeekPerfectThrough,
} from '../../utilities/dailyStreak';
import {
    DailyBonusRarity,
    DailyBonusTier,
    getDailyBonusTier,
    isComebackCheckin,
    isDailyBonusEnabled,
    rollDailyBonus,
} from '../../utilities/dailyBonus';
import { getLapseBackoffDays } from '../../utilities/retentionLadder';
import { awardLeaderboardPoints } from './leaderboards';

/** What the celebration reveals. Already paid by the time anyone sees it. */
export interface IDailyBonusView {
    tier: DailyBonusTier;
    rarity: DailyBonusRarity;
    bonusXp: number;
}

export const toDailyBonusView = (row: IDBDailyBonus): IDailyBonusView => ({
    tier: row.tier as DailyBonusTier,
    rarity: row.rarity as DailyBonusRarity,
    bonusXp: row.bonusXp,
});

/**
 * Roll and pay the daily bonus for `localDate`, the day a check-in just upheld. Called from the
 * daily-streak check-in hook on the first completed check-in of that day, and awaited there so
 * the check-in response — which is what the celebration renders from — can already carry it.
 *
 * Friends with Habits only: it is the only app that shows the reveal, and a Therr check-in must
 * not grow a leaderboard bonus nobody can see. The ledger's UNIQUE constraint makes a retry, a
 * deleted-and-redone check-in or a second device pay nothing. Never throws: the check-in has
 * already committed, and losing a bonus is better than failing it.
 */
export const awardDailyBonus = async (
    userId: string,
    localDate: string,
    state: IDBUserDailyStreak,
    headers: InternalConfigHeaders,
    // The last upheld day *before* this check-in, read before the streak moved. Its gap to
    // `localDate` decides the comeback tier; absent means "not a comeback".
    previousUpheldDate: string | null = null,
): Promise<IDailyBonusView | null> => {
    const { brandVariation } = getBrandContext(headers as Record<string, any>);
    if (!isDailyBonusEnabled() || brandVariation !== BrandVariations.HABITS) {
        return null;
    }

    try {
        // Boosted on the bigger days, judged as the celebration judges them. A backdated
        // check-in (yesterday) counts as a milestone only while it is still the streak's head,
        // i.e. today is not upheld yet; once today is, `currentStreak` is today's, not its.
        const isMilestone = state.lastUpheldDate === localDate && isDailyStreakMilestone(state.currentStreak);
        let isPerfectWeek = false;
        if (isWeekEnd(localDate)) {
            const rows = await Store.dailyStreakDays.getRange(userId, getWeekStart(localDate), getWeekEnd(localDate));
            isPerfectWeek = isWeekPerfectThrough(localDate, new Map(rows.map((row) => [row.localDate, row.status])));
        }
        const isComeback = isComebackCheckin(previousUpheldDate, localDate, getLapseBackoffDays());
        const roll = rollDailyBonus(getDailyBonusTier({ isMilestone, isPerfectWeek, isComeback }), randomInt);

        const claimed = await Store.dailyBonuses.claim({
            userId,
            brandVariation,
            source: 'daily-streak',
            sourceKey: localDate,
            ...roll,
        });
        if (!claimed) {
            return null;
        }

        // Never throws: a failed award is logged inside.
        await awardLeaderboardPoints(headers, claimed.bonusXp, `daily-bonus:${claimed.id}`);
        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['Daily bonus awarded'],
            traceArgs: {
                'user.id': userId,
                'dailyBonus.tier': claimed.tier,
                'dailyBonus.rarity': claimed.rarity,
                'dailyBonus.bonusXp': claimed.bonusXp,
                'dailyBonus.streak': state.currentStreak,
            },
        });
        return toDailyBonusView(claimed);
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Daily bonus failed; the check-in stands without it'],
            traceArgs: { 'error.message': err?.message, 'user.id': userId, 'dailyBonus.localDate': localDate },
        });
        return null;
    }
};

/**
 * The bonus already paid for `today`, for the celebration to reveal. Only read while a
 * celebration is pending (once a day), and best-effort: a failed read drops the reveal, never
 * the celebration — and never the XP, which was paid at check-in.
 */
export const getDailyBonusForDay = async (userId: string, today: string): Promise<IDailyBonusView | null> => {
    if (!isDailyBonusEnabled()) {
        return null;
    }
    try {
        const row = await Store.dailyBonuses.get(userId, 'daily-streak', today);
        return row ? toDailyBonusView(row) : null;
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Daily bonus read failed; celebrating without the reveal'],
            traceArgs: { 'error.message': err?.message, 'user.id': userId },
        });
        return null;
    }
};
