/**
 * The daily bonus: the odds and the roll. Pure, so the distribution can be tested without a
 * database; handlers/helpers/dailyBonus.ts does the claiming and paying.
 *
 * The first completed check-in of a local day pays a random XP bonus on top of the check-in.
 * It is rolled and paid on the server at check-in time — the user has it whether or not they
 * ever watch the celebration that reveals it. The tapping on that screen (the chameleon catching
 * a rock that bursts into gems) is purely the reveal.
 *
 * Why a random amount at all: a fixed payout stops being noticed after a week, while a variable
 * one keeps the reveal worth watching. The leaderboard is the constraint. It ranks effort, so the
 * bonus must never be able to outrank effort:
 *
 *   - one bonus per local day, and only on a day the user checked in, so it scales with
 *     consistency and nothing else;
 *   - the expected value is ~10 XP (standard) / ~20 XP (boosted), the size of one check-in, and
 *     even a jackpot (50 XP) is less than a week of a single daily habit (70 XP);
 *   - the roll is written before it is paid, so a retry cannot re-roll.
 *
 * Boosted odds (no commons, more epics and jackpots) are what a streak milestone or a perfect
 * week adds: the bigger bonus for the bigger day.
 *
 * Comeback odds are what the first check-in after a lapse earns (a gap of
 * `HABIT_LAPSE_BACKOFF_DAYS` or more since the last upheld day — the same threshold at which the
 * digest stops daily nudges and the comeback message promises this bonus). Epic or better,
 * always, so the reveal is worth the return. It cannot be farmed into an advantage: it needs days
 * of *not* checking in to earn, and its expected ~31 XP is less than the ~40 XP of daily bonuses
 * plus 4 check-ins a consistent user earns over the same four days.
 */

export type DailyBonusTier = 'standard' | 'boosted' | 'comeback';
export type DailyBonusRarity = 'common' | 'rare' | 'epic' | 'jackpot';

interface IDailyBonusOdds {
    rarity: DailyBonusRarity;
    /** Relative weight; the weights of a tier need not sum to 100. */
    weight: number;
    minXp: number;
    maxXp: number;
}

export const DAILY_BONUS_ODDS: Record<DailyBonusTier, IDailyBonusOdds[]> = {
    standard: [
        {
            rarity: 'common', weight: 60, minXp: 3, maxXp: 8,
        },
        {
            rarity: 'rare', weight: 28, minXp: 10, maxXp: 15,
        },
        {
            rarity: 'epic', weight: 10, minXp: 20, maxXp: 30,
        },
        {
            rarity: 'jackpot', weight: 2, minXp: 50, maxXp: 50,
        },
    ],
    boosted: [
        {
            rarity: 'rare', weight: 60, minXp: 10, maxXp: 15,
        },
        {
            rarity: 'epic', weight: 32, minXp: 20, maxXp: 30,
        },
        {
            rarity: 'jackpot', weight: 8, minXp: 50, maxXp: 50,
        },
    ],
    comeback: [
        {
            rarity: 'epic', weight: 75, minXp: 20, maxXp: 30,
        },
        {
            rarity: 'jackpot', weight: 25, minXp: 50, maxXp: 50,
        },
    ],
};

/** Kill switch. On unless explicitly `false`. Older clients simply never show the reveal. */
export const isDailyBonusEnabled = (): boolean => process.env.HABIT_DAILY_BONUS_ENABLED !== 'false';

export const getDailyBonusTier = ({ isMilestone, isPerfectWeek, isComeback = false }: {
    isMilestone: boolean;
    isPerfectWeek: boolean;
    isComeback?: boolean;
}): DailyBonusTier => {
    // A comeback outranks a milestone: it is the one the user was told about in advance.
    if (isComeback) {
        return 'comeback';
    }
    return isMilestone || isPerfectWeek ? 'boosted' : 'standard';
};

/**
 * Whether a check-in on `localDate` is a comeback: there was an upheld day before, and it was
 * `lapseDays` or more ago. A first-ever check-in is not a comeback — there is nothing to come back
 * to, and the first check-in has its own celebration.
 */
export const isComebackCheckin = (
    previousUpheldDate: string | null | undefined,
    localDate: string,
    lapseDays: number,
): boolean => {
    if (!previousUpheldDate) {
        return false;
    }
    const gapMs = Date.parse(`${localDate.slice(0, 10)}T00:00:00.000Z`) - Date.parse(`${String(previousUpheldDate).slice(0, 10)}T00:00:00.000Z`);
    return Number.isFinite(gapMs) && Math.round(gapMs / (24 * 60 * 60 * 1000)) >= lapseDays;
};

export interface IDailyBonusRoll {
    tier: DailyBonusTier;
    rarity: DailyBonusRarity;
    bonusXp: number;
}

/**
 * Roll a bonus. `randomInt(maxExclusive)` must return an integer in [0, maxExclusive); it is
 * `crypto.randomInt` in production and injected in tests.
 */
export const rollDailyBonus = (
    tier: DailyBonusTier,
    randomInt: (maxExclusive: number) => number,
): IDailyBonusRoll => {
    const odds = DAILY_BONUS_ODDS[tier];
    const totalWeight = odds.reduce((sum, entry) => sum + entry.weight, 0);
    let pick = randomInt(totalWeight);
    const entry = odds.find((candidate) => {
        if (pick < candidate.weight) {
            return true;
        }
        pick -= candidate.weight;
        return false;
    }) || odds[0];

    return {
        tier,
        rarity: entry.rarity,
        bonusXp: entry.minXp + randomInt(entry.maxXp - entry.minXp + 1),
    };
};

/** The mean XP of a tier, for the doc and the tests that pin the leaderboard budget. */
export const getExpectedBonusXp = (tier: DailyBonusTier): number => {
    const odds = DAILY_BONUS_ODDS[tier];
    const totalWeight = odds.reduce((sum, entry) => sum + entry.weight, 0);
    return odds.reduce((sum, entry) => sum + (entry.weight / totalWeight) * ((entry.minXp + entry.maxXp) / 2), 0);
};
