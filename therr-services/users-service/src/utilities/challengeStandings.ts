/**
 * Ranking and date rules for join-by-link challenges. Pure, so the rules are unit-tested
 * without a database; `ChallengesStore.getStandings` supplies the tallies.
 */

export const CHALLENGE_DURATIONS_DAYS = [7, 14, 30, 60, 90];
export const DEFAULT_CHALLENGE_DURATION_DAYS = 30;
/** Running challenges one user may have created at once. A spam guard, not a product limit. */
export const MAX_ACTIVE_CHALLENGES_PER_CREATOR = 3;
/** Rows a public standings response carries. A challenge holds at most `maxMembers` (50). */
export const MAX_STANDINGS_LISTED = 50;

export interface IChallengeTally {
    userId: string;
    userName: string;
    firstName: string | null;
    joinedAt: Date | string;
    checkinDays: number;
    totalAmount: number;
    lastCheckinDate: string | null;
}

export interface IRankedChallengeTally extends IChallengeTally {
    /** Standard competition ranking: ties share a rank, and the next rank skips (1, 1, 3). */
    rank: number;
}

/**
 * Rank members by amount when the goal measures one (most km, most pages), otherwise by days
 * checked in. A ranking by days calls a 5-minute walk equal to a 10 km run, which is why a
 * measured goal ranks by its amount — and why days still break a tie in amount.
 *
 * Earlier joiners list first within a tie, but share the rank: joining first is not winning.
 */
export const rankChallengeStandings = (
    tallies: IChallengeTally[],
    isMeasured: boolean,
): IRankedChallengeTally[] => {
    const primary = (tally: IChallengeTally) => (isMeasured ? tally.totalAmount : tally.checkinDays);
    const sorted = [...tallies].sort((a, b) => (primary(b) - primary(a))
        || (b.checkinDays - a.checkinDays)
        || (new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()));

    return sorted.map((tally, index) => {
        let rank = index + 1;
        if (index > 0) {
            const previous = sorted[index - 1];
            if (primary(previous) === primary(tally) && previous.checkinDays === tally.checkinDays) {
                // Walk back to the first of the tie; its position is the shared rank.
                let first = index - 1;
                while (first > 0
                    && primary(sorted[first - 1]) === primary(tally)
                    && sorted[first - 1].checkinDays === tally.checkinDays) {
                    first -= 1;
                }
                rank = first + 1;
            }
        }
        return { ...tally, rank };
    });
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcMs = (isoDate: string): number => {
    const [year, month, day] = isoDate.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
};

const toIsoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The inclusive last day of a challenge that starts on `startDate` and runs `durationDays`. */
export const getChallengeEndDate = (startDate: string, durationDays: number): string => toIsoDate(
    toUtcMs(startDate) + (durationDays - 1) * MS_PER_DAY,
);

export interface IChallengeTiming {
    hasStarted: boolean;
    hasEnded: boolean;
    /** Days left including today; 0 once ended. */
    daysLeft: number;
    durationDays: number;
}

/** Where `today` (the viewer's own calendar day, YYYY-MM-DD) falls in the challenge window. */
export const describeChallengeTiming = (startDate: string, endDate: string, today: string): IChallengeTiming => {
    const start = toUtcMs(startDate);
    const end = toUtcMs(endDate);
    const now = toUtcMs(today);
    const durationDays = Math.round((end - start) / MS_PER_DAY) + 1;

    return {
        hasStarted: now >= start,
        hasEnded: now > end,
        daysLeft: now > end ? 0 : Math.round((end - Math.max(now, start)) / MS_PER_DAY) + 1,
        durationDays,
    };
};

/** Short, URL-safe and unguessable: 12 base62 characters is ~71 bits. */
export const JOIN_TOKEN_RE = /^[A-Za-z0-9]{12}$/;
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const generateJoinToken = (randomBytes: (size: number) => Buffer): string => {
    // Rejection sampling: 248 is the largest multiple of 62 below 256, so every character is
    // uniformly distributed instead of favouring the first few letters.
    let token = '';
    while (token.length < 12) {
        const bytes = randomBytes(24);
        for (let i = 0; i < bytes.length && token.length < 12; i += 1) {
            if (bytes[i] < 248) {
                token += BASE62[bytes[i] % 62];
            }
        }
    }
    return token;
};
